package main

import (
	"crypto/rand"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// The web UI: a local server on 127.0.0.1 that only answers requests carrying
// the random token from the printed link, so other websites can't drive it.

//go:embed ui
var uiFiles embed.FS

type uiServer struct {
	token    string
	hosts    map[string]bool
	busy     sync.Mutex // one command at a time, like a terminal
	password string     // FMGIT_PASSWORD for this session only, never written to disk
}

func cmdUI(args []string) {
	fs := flag.NewFlagSet("ui", flag.ExitOnError)
	port := fs.Int("port", 0, "port (default: any free port)")
	noOpen := fs.Bool("no-open", false, "don't open the browser")
	parse(fs, args)
	b := make([]byte, 16)
	_, err := rand.Read(b)
	must(err)
	s := &uiServer{token: hex.EncodeToString(b)}
	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(*port)))
	must(err)
	p := ln.Addr().(*net.TCPAddr).Port
	s.hosts = map[string]bool{fmt.Sprintf("127.0.0.1:%d", p): true, fmt.Sprintf("localhost:%d", p): true}
	url := fmt.Sprintf("http://127.0.0.1:%d/?t=%s", p, s.token)
	fmt.Printf("fmgit UI running at\n  %s\n(ctrl+c to stop)\n", url)
	if !*noOpen {
		openBrowser(url)
	}
	must(http.Serve(ln, s.routes()))
}

func openBrowser(url string) {
	var c *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		c = exec.Command("open", url)
	case "windows":
		c = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		c = exec.Command("xdg-open", url)
	}
	_ = c.Start()
}

func (s *uiServer) routes() http.Handler {
	mux := http.NewServeMux()
	static, _ := fs.Sub(uiFiles, "ui")
	mux.Handle("GET /", http.FileServerFS(static))
	for p, h := range map[string]func(*http.Request) (any, error){
		"GET /api/status":    s.status,
		"GET /api/changes":   s.changes,
		"GET /api/diff":      s.diff,
		"GET /api/log":       s.log,
		"GET /api/commit":    s.commit,
		"GET /api/branches":  s.branches,
		"GET /api/objects":   s.objects,
		"GET /api/object":    s.object,
		"GET /api/search":    s.search,
		"GET /api/prs":       s.prs,
		"GET /api/pr":        s.pr,
		"GET /api/check":     s.check,
		"GET /api/config":    func(*http.Request) (any, error) { return cfg, nil },
		"POST /api/config":   s.saveConfig,
		"POST /api/password": s.setPassword,
		"POST /api/token":    s.setToken,
	} {
		mux.HandleFunc(p, s.api(h))
	}
	mux.HandleFunc("POST /api/run", s.run)
	mux.HandleFunc("GET /api/download", s.download)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.hosts[r.Host] { // DNS rebinding
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'")
		mux.ServeHTTP(w, r)
	})
}

func (s *uiServer) authed(r *http.Request, tok string) bool {
	return subtle.ConstantTimeCompare([]byte(tok), []byte(s.token)) == 1
}

func (s *uiServer) api(h func(*http.Request) (any, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.authed(r, r.Header.Get("X-Fmgit-Token")) {
			http.Error(w, "missing token: open the link printed by `fmgit ui`", http.StatusUnauthorized)
			return
		}
		v, err := h(r)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			v = map[string]string{"error": err.Error()}
		}
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Request values end up as git arguments: refuse anything git would read as an option.
var (
	safeArg = regexp.MustCompile(`^[^-\s][^\s]*$`)
	hexRe   = regexp.MustCompile(`^[0-9a-f]{4,64}$`)
	digits  = regexp.MustCompile(`^[0-9]+$`)
)

func rangeArgs(r *http.Request) ([]string, error) {
	var rng []string
	for _, a := range r.URL.Query()["range"] {
		if a == "" {
			continue
		}
		if !safeArg.MatchString(a) {
			return nil, fmt.Errorf("invalid range %q", a)
		}
		rng = append(rng, a)
	}
	return rng, nil
}

// srcPath validates a path relative to src/.
func srcPath(p string) (string, error) {
	c := path.Clean("/" + p)[1:]
	if c == "" || c != p || strings.HasPrefix(c, "..") {
		return "", fmt.Errorf("invalid path %q", p)
	}
	return c, nil
}

func gitq(args ...string) string {
	s, _ := out("git", args...)
	return strings.TrimSpace(s)
}

func found(tool string) bool {
	_, err := exec.LookPath(tool)
	return err == nil
}

func (s *uiServer) status(*http.Request) (any, error) {
	wd, _ := os.Getwd()
	st := map[string]any{
		"repo": filepath.Base(wd), "dir": wd, "main": cfg.Main, "approvals": cfg.Approvals, "file": fileNames(), "files": cfg.Files, "names": []string{}, "src": cfg.Src, "xmlMode": cfg.XML != "",
		"branch": gitq("branch", "--show-current"), "head": gitq("rev-parse", "--short", "HEAD"),
		"headSubject": gitq("log", "-1", "--format=%s"), "merging": merging(),
		"remote": gitq("remote") != "", "upstream": gitq("rev-parse", "--abbrev-ref", "@{u}"),
		"forge": forgeKind(), "forgeTokenSet": os.Getenv("FMGIT_FORGE_TOKEN") != "",
		"tools": map[string]bool{
			"git": true, "gh": found("gh"),
			"export": cfg.XML != "" || found(cfg.ExportCmd[0]), "upgrade": found(cfg.UpgradeCmd[0]),
		},
		"passwordSet": s.password != "" || os.Getenv("FMGIT_PASSWORD") != "",
		"synced":      allSynced(), "fileBehind": behind(),
	}
	for _, t := range targets() {
		if t.Name != "" {
			st["names"] = append(st["names"].([]string), t.Name) // folder names: src/<name>/, build/<name>.patch.xml
		}
	}
	if base, owner, name, err := parseRemote(remoteURL()); err == nil {
		if cfg.ForgeURL != "" {
			base = strings.TrimRight(cfg.ForgeURL, "/")
		}
		st["webURL"], st["owner"], st["repo"] = base+"/"+owner+"/"+name, owner, name
	}
	_, ferr := newForge()
	st["forgeReady"] = ferr == nil
	if ferr != nil {
		st["forgeError"] = ferr.Error()
	}
	if fi, err := os.Stat(cfg.File); err == nil {
		st["fileModified"] = fi.ModTime()
		st["fileSize"] = fi.Size()
	}
	if s := gitq("status", "--porcelain", "--", cfg.Src); s != "" {
		st["dirty"] = len(strings.Split(s, "\n"))
	}
	base := cfg.Main
	if gitq("rev-parse", "--verify", "-q", "origin/"+cfg.Main) != "" {
		base = "origin/" + cfg.Main
	}
	if f := strings.Fields(gitq("rev-list", "--left-right", "--count", base+"...HEAD")); len(f) == 2 {
		st["base"], st["behindMain"], st["aheadMain"] = base, atoi(f[0]), atoi(f[1])
	}
	if st["upstream"] != "" {
		if f := strings.Fields(gitq("rev-list", "--left-right", "--count", "@{u}...HEAD")); len(f) == 2 {
			st["behindUpstream"], st["unpushed"] = atoi(f[0]), atoi(f[1])
		}
	}
	return st, nil
}

// allSynced is the commit every file was last synced to, "" if one was never synced.
func allSynced() string {
	s := ""
	for _, t := range targets() {
		if s = synced(t); s == "" {
			return ""
		}
	}
	return s
}

func atoi(s string) int { n, _ := strconv.Atoi(s); return n }

func (s *uiServer) changes(r *http.Request) (any, error) {
	rng, err := rangeArgs(r)
	if err != nil {
		return nil, err
	}
	c, err := changes(rng)
	if c == nil {
		c = []change{}
	}
	return c, err
}

func (s *uiServer) diff(r *http.Request) (any, error) {
	rng, err := rangeArgs(r)
	if err != nil {
		return nil, err
	}
	p, err := srcPath(r.URL.Query().Get("path"))
	if err != nil {
		return nil, err
	}
	d, err := out("git", append([]string{"-c", "color.ui=false"}, diffArgs(rng, cfg.Src+"/"+p)...)...)
	if len(d) > 2<<20 {
		d = d[:2<<20] + "\n… (truncated)\n"
	}
	return map[string]string{"diff": d}, err
}

type commitInfo struct {
	Hash    string   `json:"hash"`
	Short   string   `json:"short"`
	Parents []string `json:"parents"`
	Author  string   `json:"author"`
	Email   string   `json:"email"`
	Date    string   `json:"date"`
	Subject string   `json:"subject"`
	Body    string   `json:"body,omitempty"`
	Refs    string   `json:"refs"`
}

const logFormat = "--pretty=format:%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s%x1f%D%x1f%b%x1e"

func parseLog(s string) []commitInfo {
	res := []commitInfo{}
	for _, rec := range strings.Split(s, "\x1e") {
		f := strings.Split(strings.TrimLeft(rec, "\n"), "\x1f")
		if len(f) < 9 {
			continue
		}
		res = append(res, commitInfo{Hash: f[0], Short: f[1], Parents: strings.Fields(f[2]), Author: f[3], Email: f[4],
			Date: f[5], Subject: f[6], Refs: f[7], Body: strings.TrimSpace(f[8])})
	}
	return res
}

func (s *uiServer) log(r *http.Request) (any, error) {
	q := r.URL.Query()
	args := []string{"log", "-n", "300", "--date-order", "--date=iso-strict", logFormat}
	if q.Get("all") == "1" {
		args = append(args, "--all")
	}
	if ref := q.Get("ref"); ref != "" {
		if !safeArg.MatchString(ref) {
			return nil, fmt.Errorf("invalid ref")
		}
		args = append(args, ref)
	}
	args = append(args, "--")
	if p := q.Get("path"); p != "" {
		p, err := srcPath(p)
		if err != nil {
			return nil, err
		}
		args = append(args, cfg.Src+"/"+p)
	}
	o, err := out("git", args...)
	if err != nil && strings.Contains(err.Error(), "does not have any commits") {
		return []commitInfo{}, nil
	}
	return parseLog(o), err
}

const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

func (s *uiServer) commit(r *http.Request) (any, error) {
	h := r.URL.Query().Get("hash")
	if !hexRe.MatchString(h) {
		return nil, errors.New("invalid commit")
	}
	o, err := out("git", "show", "-s", "--date=iso-strict", logFormat, h)
	if err != nil {
		return nil, err
	}
	cs := parseLog(o)
	if len(cs) == 0 {
		return nil, errors.New("commit not found")
	}
	c := cs[0]
	rng := []string{emptyTree, c.Hash}
	if len(c.Parents) > 0 {
		rng[0] = c.Parents[0] // for merges: what the merge brought in
	}
	ch, err := changes(rng)
	return map[string]any{"commit": c, "range": rng, "changes": ch}, err
}

func (s *uiServer) branches(*http.Request) (any, error) {
	o, err := out("git", "for-each-ref", "--sort=-committerdate",
		"--format=%(refname:short)%1f%(objectname:short)%1f%(committerdate:iso-strict)%1f%(subject)%1f%(upstream:short)%1f%(upstream:track)%1f%(authorname)", "refs/heads")
	if err != nil {
		return nil, err
	}
	cur := gitq("branch", "--show-current")
	base := cfg.Main
	if gitq("rev-parse", "--verify", "-q", "origin/"+cfg.Main) != "" {
		base = "origin/" + cfg.Main
	}
	res := []map[string]any{}
	for _, l := range strings.Split(strings.TrimSpace(o), "\n") {
		f := strings.Split(l, "\x1f")
		if len(f) < 7 {
			continue
		}
		b := map[string]any{"name": f[0], "head": f[1], "date": f[2], "subject": f[3], "upstream": f[4], "track": f[5],
			"author": f[6], "current": f[0] == cur, "main": f[0] == cfg.Main}
		if n := strings.Fields(gitq("rev-list", "--left-right", "--count", base+"..."+f[0])); len(n) == 2 {
			b["behind"], b["ahead"] = atoi(n[0]), atoi(n[1])
		}
		res = append(res, b)
	}
	return res, nil
}

// Dirs holding the second half of an object (steps of a script, fields of a table, ...):
// the UI shows them as parts of the primary object instead of on their own.
func secondary(dir string) bool {
	switch dir = path.Base(dir); dir {
	case "StepsForScripts", "CalcsForCustomFunctions", "FieldsForTables", "OptionsForValueLists":
		return true
	}
	return strings.Contains(dir, ".")
}

var catOrder = []string{"Table", "Table occurrence", "Relationship", "Script", "Layout", "Custom function", "Value list",
	"Theme", "Custom menu", "Custom menu set", "Account", "Privilege set", "Extended privilege", "Library item"}

func (s *uiServer) objects(*http.Request) (any, error) {
	type obj struct {
		Name   string `json:"name"`
		Path   string `json:"path"`
		Folder string `json:"folder,omitempty"`
	}
	type cat struct {
		Dir       string `json:"dir"` // relative to src/: ScriptCatalog, or UI/ScriptCatalog in a multi-file solution
		Label     string `json:"label"`
		Secondary bool   `json:"secondary"`
		Objects   []obj  `json:"objects"`
	}
	rank := func(dir string) int {
		if i := slices.Index(catOrder, label(path.Base(dir))); i >= 0 {
			return i
		}
		return len(catOrder)
	}
	fsys := os.DirFS(cfg.Src)
	cats := []cat{}
	for _, t := range targets() {
		ents, err := os.ReadDir(t.Src)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return nil, err
		}
		var tc []cat
		for _, e := range ents {
			if !e.IsDir() {
				continue
			}
			dir := path.Join(t.Name, e.Name())
			files, err := orderedFiles(fsys, dir)
			if err != nil {
				return nil, err
			}
			c := cat{Dir: dir, Label: label(dir), Secondary: secondary(dir), Objects: []obj{}}
			for _, f := range files {
				o := obj{Name: objectName(f), Path: dir + "/" + f}
				if e.Name() == "ScriptCatalog" || e.Name() == "LayoutCatalog" { // folders live in the first line
					if b, err := readHead(filepath.Join(t.Src, e.Name(), f)); err == nil {
						if m := regexp.MustCompile(`isFolder="(\w+)"`).FindSubmatch(b); m != nil {
							o.Folder = string(m[1])
						}
					}
				}
				c.Objects = append(c.Objects, o)
			}
			tc = append(tc, c)
		}
		sort.SliceStable(tc, func(a, b int) bool { return rank(tc[a].Dir) < rank(tc[b].Dir) })
		cats = append(cats, tc...)
	}
	return cats, nil
}

func readHead(p string) ([]byte, error) {
	f, err := os.Open(p)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	b := make([]byte, 400)
	n, _ := f.Read(b)
	return b[:n], nil
}

type field struct {
	Name      string `json:"name"`
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Type      string `json:"type"`
	Comment   string `json:"comment,omitempty"`
	Calc      string `json:"calc,omitempty"`
	AutoEnter string `json:"autoEnter,omitempty"`
	Global    bool   `json:"global,omitempty"`
	Index     string `json:"index,omitempty"`
	Reps      string `json:"reps,omitempty"`
	Required  bool   `json:"required,omitempty"`
	Unique    bool   `json:"unique,omitempty"`
}

type part struct {
	Dir    string  `json:"dir"`
	Label  string  `json:"label"`
	Path   string  `json:"path"`
	Kind   string  `json:"kind"` // script | fields | calc | xml
	Text   string  `json:"text,omitempty"`
	Fields []field `json:"fields,omitempty"`
	XML    string  `json:"xml"`
}

func describe(dir, p string, raw []byte) part {
	pt := part{Dir: dir, Label: label(dir), Path: p, Kind: "xml", XML: string(raw)}
	n, err := ParseXML(raw)
	if err != nil {
		return pt
	}
	switch {
	case strings.Contains(pt.XML, "<Step "):
		pt.Kind, pt.Text = "script", renderScript(n)
	case n.Name == "FieldCatalog":
		pt.Kind = "fields"
		if ol := n.Child("ObjectList"); ol != nil {
			for _, f := range ol.Kids {
				fd := field{Name: f.Get("name"), ID: f.Get("id"), Kind: f.Get("fieldtype"), Type: f.Get("datatype"), Comment: f.Get("comment")}
				f.Walk(func(e *Node) bool {
					if e.Name == "Calculation" && fd.Calc == "" {
						fd.Calc = textOf(e)
					}
					return true
				})
				if a := f.Child("AutoEnter"); a != nil {
					fd.AutoEnter = a.Get("type")
				}
				if st := f.Child("Storage"); st != nil {
					fd.Global, fd.Index, fd.Reps = st.Get("global") == "True", st.Get("index"), st.Get("maxRepetitions")
				}
				if v := f.Child("Validation"); v != nil {
					fd.Required, fd.Unique = v.Get("notEmpty") == "True", v.Get("unique") == "True"
				}
				pt.Fields = append(pt.Fields, fd)
			}
		}
	case n.Name == "CustomFunctionCalc":
		pt.Kind, pt.Text = "calc", textOf(n)
	case n.Name == "CustomFunction":
		if d := n.Child("Display"); d != nil {
			pt.Kind, pt.Text = "calc", d.Text
		}
	case n.Name == "ValueList" && n.Child("CustomValues") != nil:
		pt.Kind, pt.Text = "calc", textOf(n.Child("CustomValues"))
	}
	return pt
}

func (s *uiServer) object(r *http.Request) (any, error) {
	rel, err := srcPath(r.URL.Query().Get("path"))
	if err != nil {
		return nil, err
	}
	dir, file := path.Split(rel)
	dir = strings.TrimSuffix(dir, "/")
	raw, err := os.ReadFile(filepath.Join(cfg.Src, filepath.FromSlash(rel)))
	if err != nil {
		return nil, err
	}
	parts := []part{describe(dir, rel, raw)}
	// the other halves share the file name: Invoices.129.xml in BaseTableCatalog and FieldsForTables
	root := path.Dir(dir) // "." or the file's folder in a multi-file solution
	ents, _ := os.ReadDir(filepath.Join(cfg.Src, filepath.FromSlash(root)))
	for _, e := range ents {
		d := path.Join(root, e.Name())
		if !e.IsDir() || d == dir {
			continue
		}
		if b, err := os.ReadFile(filepath.Join(cfg.Src, filepath.FromSlash(d), file)); err == nil {
			parts = append(parts, describe(d, d+"/"+file, b))
		}
	}
	// show the human part first: steps before script settings, fields before table settings
	sort.SliceStable(parts, func(a, b int) bool { return parts[a].Kind != "xml" && parts[b].Kind == "xml" })
	return map[string]any{"path": rel, "name": objectName(file), "type": label(dir), "parts": parts}, nil
}

func (s *uiServer) search(r *http.Request) (any, error) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	type hit struct {
		N    int    `json:"n"`
		Text string `json:"text"`
	}
	type res struct {
		Path string `json:"path"`
		Type string `json:"type"`
		Name string `json:"name"`
		Hits []hit  `json:"hits"`
	}
	results := []*res{}
	if len(q) < 2 {
		return results, nil
	}
	o, err := out("git", "grep", "-n", "-I", "-i", "-F", "--untracked", "-e", q, "--", cfg.Src)
	if err != nil && o == "" {
		return results, nil // no matches
	}
	byPath := map[string]*res{}
	for _, l := range strings.Split(o, "\n") {
		f := strings.SplitN(l, ":", 3)
		if len(f) < 3 || strings.HasSuffix(f[0], orderFile) {
			continue
		}
		rel := strings.TrimPrefix(f[0], cfg.Src+"/")
		x := byPath[rel]
		if x == nil {
			if len(results) >= 200 {
				continue
			}
			dir := path.Dir(rel)
			x = &res{Path: rel, Type: label(dir), Name: objectName(path.Base(rel))}
			byPath[rel] = x
			results = append(results, x)
		}
		if len(x.Hits) < 8 {
			t := strings.TrimSpace(f[2])
			if r := []rune(t); len(r) > 220 {
				t = string(r[:220]) + "…"
			}
			x.Hits = append(x.Hits, hit{atoi(f[1]), t})
		}
	}
	return results, nil
}

func (s *uiServer) prs(r *http.Request) (any, error) {
	state := r.URL.Query().Get("state")
	if state != "open" && state != "merged" && state != "closed" && state != "all" {
		state = "open"
	}
	f, err := newForge()
	if err != nil {
		return nil, err
	}
	l, err := f.ListPRs(state)
	if l == nil {
		l = []map[string]any{}
	}
	return l, err
}

func (s *uiServer) pr(r *http.Request) (any, error) {
	n := r.URL.Query().Get("n")
	if !digits.MatchString(n) {
		return nil, errors.New("invalid pull request number")
	}
	f, err := newForge()
	if err != nil {
		return nil, err
	}
	pr, err := f.ViewPR(atoi(n))
	if err != nil {
		return nil, err
	}
	res := map[string]any{"pr": pr, "changes": []change{}}
	base, _ := pr["baseRefName"].(string)
	if !safeArg.MatchString(base) {
		return res, nil
	}
	// GitHub and Forgejo both publish refs/pull/N/head
	ref := "refs/fmgit/pr/" + n
	if _, err := out("git", "fetch", "-q", "origin", "+refs/pull/"+n+"/head:"+ref, base); err != nil {
		res["fetchError"] = err.Error()
		return res, nil
	}
	rng := []string{"origin/" + base + "..." + ref}
	ch, err := changes(rng)
	if err != nil {
		res["fetchError"] = err.Error()
	} else {
		res["changes"], res["range"] = ch, rng
	}
	return res, nil
}

func (s *uiServer) check(*http.Request) (any, error) {
	errs := checkAll()
	if errs == nil {
		errs = []string{}
	}
	return map[string]any{"errors": errs, "at": time.Now()}, nil
}

func (s *uiServer) saveConfig(r *http.Request) (any, error) {
	c := defaults()
	c.Files = cfg.Files // the form doesn't edit the file list; fmgit.json does
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		return nil, err
	}
	src, err := validSrc(c.Src)
	if err != nil {
		return nil, err
	}
	c.Src = src
	if err := validFiles(c); err != nil {
		return nil, err
	}
	if len(c.ExportCmd) == 0 || len(c.UpgradeCmd) == 0 || c.Main == "" || !safeArg.MatchString(c.Main) {
		return nil, errors.New("exportCmd, upgradeCmd and a valid mainBranch are required")
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	if err := os.WriteFile(configFile, append(b, '\n'), 0o644); err != nil {
		return nil, err
	}
	cfg = c
	return cfg, nil
}

func (s *uiServer) setPassword(r *http.Request) (any, error) {
	var v struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		return nil, err
	}
	s.password = v.Password
	return map[string]bool{"ok": true}, nil
}

// setToken keeps the Forgejo token in this process's environment, so commands started from the UI see it too.
func (s *uiServer) setToken(r *http.Request) (any, error) {
	var v struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		return nil, err
	}
	return map[string]bool{"ok": true}, os.Setenv("FMGIT_FORGE_TOKEN", strings.TrimSpace(v.Token))
}

// patch.xml, full.xml, or per file of a multi-file solution: UI.patch.xml
var buildFile = regexp.MustCompile(`^([^/\\]+\.)?(patch|full)\.xml$`)

func (s *uiServer) download(w http.ResponseWriter, r *http.Request) {
	if !s.authed(r, r.URL.Query().Get("t")) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	f := r.URL.Query().Get("f")
	if !buildFile.MatchString(f) {
		http.Error(w, "unknown file", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+f)
	http.ServeFile(w, r, filepath.Join("build", f))
}

// Commands the UI may run: fmgit subcommands (same safety rails as the CLI) plus a few git/gh calls.
var uiCommands = map[string]bool{"save": true, "start": true, "pull": true, "apply": true, "pr": true, "approve": true,
	"reject": true, "merge": true, "protect": true, "snapshot": true, "patch": true, "build": true, "check": true}

type flushWriter struct{ w http.ResponseWriter }

func (f flushWriter) Write(p []byte) (int, error) {
	n, err := f.w.Write(p)
	if fl, ok := f.w.(http.Flusher); ok {
		fl.Flush()
	}
	return n, err
}

// run streams a command's output; the last line is "\x00<exit code>".
func (s *uiServer) run(w http.ResponseWriter, r *http.Request) {
	if !s.authed(r, r.Header.Get("X-Fmgit-Token")) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var req struct {
		Cmd  string   `json:"cmd"`
		Args []string `json:"args"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	one := len(req.Args) == 1
	var name string
	var args []string
	switch {
	case uiCommands[req.Cmd]:
		exe, err := os.Executable()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		name, args = exe, append([]string{req.Cmd}, req.Args...)
	case req.Cmd == "switch" && one && safeArg.MatchString(req.Args[0]):
		name, args = "git", []string{"switch", req.Args[0]}
	case req.Cmd == "fetch":
		name, args = "git", []string{"fetch", "--prune", "origin"}
	case req.Cmd == "push":
		name, args = "git", []string{"push", "-u", "origin", "HEAD"}
	default:
		http.Error(w, "command not allowed", http.StatusBadRequest)
		return
	}
	if !s.busy.TryLock() {
		http.Error(w, "another command is still running", http.StatusConflict)
		return
	}
	defer s.busy.Unlock()

	c := exec.Command(name, args...)
	c.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0", "GH_PROMPT_DISABLED=1", "NO_COLOR=1", "GIT_EDITOR=true")
	if s.password != "" {
		c.Env = append(c.Env, "FMGIT_PASSWORD="+s.password)
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fw := flushWriter{w}
	c.Stdout, c.Stderr = fw, fw
	shown := name
	if uiCommands[req.Cmd] {
		shown = "fmgit"
	}
	fmt.Fprintf(fw, "$ %s %s\n", shown, strings.Join(args, " "))
	code := 0
	if err := c.Run(); err != nil {
		code = -1
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			code = ee.ExitCode()
		} else {
			fmt.Fprintln(fw, err)
		}
	}
	fmt.Fprintf(fw, "\n\x00%d", code)
}
