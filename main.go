// fmgit: git for FileMaker. Exports .fmp12 files into one XML file per object,
// so branches, diffs, pull requests, reviews and merges work like for code,
// and turns merged changes back into FMUpgradeTool patches.
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime/debug"
	"slices"
	"sort"
	"strings"
	"time"
)

const usage = `fmgit - git for FileMaker

Daily work
  fmgit ui                       open the web interface (everything below, in a browser)
  fmgit init [-file App.fmp12]   set up a project (git repo, config, CI)
  fmgit start <branch>           new feature branch from the latest main
  fmgit save -m "message"        export the FileMaker file and commit it
  fmgit diff [git range]         what changed, in FileMaker terms
  fmgit pr                       push and open a pull request (auto-merges once approved)
  fmgit pull                     get teammates' changes and patch them into your file

Review (GitHub via gh, Forgejo via FMGIT_FORGE_TOKEN)
  fmgit approve <pr> [-m text]   approve a pull request
  fmgit reject <pr> -m text      request changes
  fmgit merge <pr> [-auto]       merge now, or as soon as approvals and checks pass
  fmgit protect                  require approvals + checks on main, enable auto-merge

Plumbing
  fmgit snapshot [-xml file]     export into src/ without committing
  fmgit apply [-from rev|-mark]  patch your file up to HEAD (FMUpgradeTool)
  fmgit patch [-o f] <from> [to] write an FMUpgradeTool patch between two commits
  fmgit build [-o file]          reassemble the full XML from src/
  fmgit check                    validate src/ (runs in CI)
  fmgit comment <range>          post/update the FileMaker diff on the current PR (runs in CI)
  fmgit render < file.xml        HTML view of an object file (Forgejo external renderer)

Password: set FMGIT_PASSWORD (and FMGIT_EAR_KEY for encrypted files).
`

type Config struct {
	File       string   `json:"file"`
	Files      []string `json:"files,omitempty"` // a solution of several .fmp12 files, each in src/<name>/
	Account    string   `json:"account"`
	Src        string   `json:"src"`
	XML        string   `json:"xml,omitempty"`
	Main       string   `json:"mainBranch"`
	Approvals  int      `json:"approvals"`
	PatchRoot  string   `json:"patchRoot"`
	Forge      string   `json:"forge,omitempty"`    // github | forgejo; empty = guess from the remote
	ForgeURL   string   `json:"forgeURL,omitempty"` // Forgejo web URL if it differs from the remote host
	ExportCmd  []string `json:"exportCmd"`
	UpgradeCmd []string `json:"upgradeCmd"`
}

func defaults() Config {
	return Config{
		Account: "Admin", Src: "src", Main: "main", Approvals: 1, PatchRoot: "FMUpgradeToolPatch",
		ExportCmd: []string{"FMDeveloperTool", "--saveAsXML", "{file}", "{account}", "{password}",
			"-target_filename", "{out}", "-force"},
		UpgradeCmd: []string{"FMUpgradeTool", "--update", "-src_path", "{file}", "-dest_path", "{out}",
			"-patch_path", "{patch}", "-src_account", "{account}", "-src_pwd", "{password}"},
	}
}

const configFile = "fmgit.json"

var cfg Config

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(2)
	}
	cmd, args := os.Args[1], os.Args[2:]
	switch cmd {
	case "init":
		cmdInit(args)
		return
	case "textconv": // called by git diff, see .gitattributes
		cmdTextconv(args)
		return
	case "render": // called by Forgejo to show object files, see README
		cmdRender(args)
		return
	case "help", "-h", "--help":
		fmt.Print(usage)
		return
	}
	loadConfig()
	cmds := map[string]func([]string){
		"start": cmdStart, "save": cmdSave, "diff": cmdDiff, "pr": cmdPR, "pull": cmdPull,
		"approve": cmdApprove, "reject": cmdReject, "protect": cmdProtect,
		"snapshot": cmdSnapshot, "apply": cmdApply, "patch": cmdPatch, "build": cmdBuild, "check": cmdCheck,
		"ui": cmdUI, "merge": cmdMerge, "comment": cmdComment,
	}
	f, ok := cmds[cmd]
	if !ok {
		die("unknown command %q\n\n%s", cmd, usage)
	}
	f(args)
}

func die(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "fmgit: "+format+"\n", a...)
	os.Exit(1)
}

func must(err error) {
	if err != nil {
		die("%v", err)
	}
}

// parse lets flags and positional args mix: fmgit diff main -md
func parse(fs *flag.FlagSet, args []string) []string {
	var pos []string
	for {
		must(fs.Parse(args))
		if args = fs.Args(); len(args) == 0 {
			return pos
		}
		pos, args = append(pos, args[0]), args[1:]
	}
}

// loadConfig finds fmgit.json upwards and runs everything from that directory.
func loadConfig() {
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, configFile)); err == nil {
			break
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			die("no %s found, run `fmgit init` first", configFile)
		}
		dir = parent
	}
	must(os.Chdir(dir))
	b, err := os.ReadFile(configFile)
	must(err)
	cfg = defaults()
	if err := json.Unmarshal(b, &cfg); err != nil {
		die("%s: %v", configFile, err)
	}
	src, err := validSrc(cfg.Src)
	if err != nil {
		die("%s: %v", configFile, err)
	}
	cfg.Src = src
	if err := validFiles(cfg); err != nil {
		die("%s: %v", configFile, err)
	}
}

func validFiles(c Config) error {
	if len(c.Files) == 0 {
		return nil
	}
	if c.File != "" {
		return errors.New("set either \"file\" or \"files\", not both")
	}
	if c.XML != "" && !strings.Contains(c.XML, "{name}") {
		return errors.New("with several files, \"xml\" needs a {name} placeholder, e.g. \"exports/{name}.xml\"")
	}
	seen := map[string]bool{}
	for _, f := range c.Files {
		n := stem(f)
		if n == "" || n == "." || n == ".." || seen[strings.ToLower(n)] {
			return fmt.Errorf("\"files\": %q is empty or its name is used twice", f)
		}
		seen[strings.ToLower(n)] = true
	}
	return nil
}

// target is one .fmp12 of the solution and the folder its objects live in.
// Name is empty for a single "file": its objects stay directly in src/.
type target struct{ Name, File, Src, XML string }

func targets() []target {
	if len(cfg.Files) == 0 {
		return []target{{File: cfg.File, Src: cfg.Src, XML: cfg.XML}}
	}
	var ts []target
	for _, f := range cfg.Files {
		n := stem(f)
		ts = append(ts, target{Name: n, File: f, Src: cfg.Src + "/" + n, XML: strings.ReplaceAll(cfg.XML, "{name}", n)})
	}
	return ts
}

func stem(f string) string { return strings.TrimSuffix(filepath.Base(f), filepath.Ext(f)) }

// out names a per-file output: build/patch.xml becomes build/UI.patch.xml.
func (t target) out(p string) string {
	if t.Name == "" {
		return p
	}
	return filepath.Join(filepath.Dir(p), t.Name+"."+filepath.Base(p))
}

func (t target) String() string { return first(filepath.Base(t.File), "your FileMaker file") }

func fileNames() string {
	var n []string
	for _, t := range targets() {
		n = append(n, filepath.Base(t.File))
	}
	return strings.Join(n, " + ")
}

// validSrc guards the folder that gets wiped on every export: never the repo itself.
func validSrc(src string) (string, error) {
	if c := filepath.Clean(src); c == "." || filepath.IsAbs(c) || strings.HasPrefix(c, "..") {
		return "", fmt.Errorf("\"src\" must be a sub-folder like \"src\", got %q", src)
	}
	return filepath.ToSlash(filepath.Clean(src)), nil
}

// run executes a command with the terminal attached.
func run(name string, args ...string) error {
	c := exec.Command(name, args...)
	c.Stdin, c.Stdout, c.Stderr = os.Stdin, os.Stdout, os.Stderr
	return c.Run()
}

// out executes a command and returns its stdout.
func out(name string, args ...string) (string, error) {
	c := exec.Command(name, args...)
	var stderr bytes.Buffer
	c.Stderr = &stderr
	b, err := c.Output()
	if err != nil {
		return string(b), fmt.Errorf("%s", redact(fmt.Sprintf("%s %s: %v %s", name, strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))))
	}
	return string(b), nil
}

// redact hides secrets that the command templates put on the command line.
func redact(s string) string {
	for _, k := range []string{"FMGIT_PASSWORD", "FMGIT_EAR_KEY"} {
		if v := os.Getenv(k); v != "" {
			s = strings.ReplaceAll(s, v, "***")
		}
	}
	return s
}

func git(args ...string) string {
	s, err := out("git", args...)
	must(err)
	return strings.TrimSpace(s)
}

// gitRev implements Rev on the real repository.
type gitRev struct{}

func (gitRev) Changes(from, to, src string) ([][2]string, error) {
	s, err := out("git", "diff", "--relative", "--name-status", "--no-renames", "-z", from, to, "--", src)
	if err != nil {
		return nil, err
	}
	f := strings.Split(strings.TrimRight(s, "\x00"), "\x00")
	var res [][2]string
	for i := 0; i+1 < len(f); i += 2 {
		res = append(res, [2]string{f[i][:1], f[i+1]})
	}
	return res, nil
}

func (gitRev) Show(rev, p string) ([]byte, error) {
	s, err := out("git", "show", rev+":./"+p) // ./ = relative to fmgit.json, not the repo root
	return []byte(s), err
}

func expand(tmpl []string, vars map[string]string) []string {
	res := make([]string, len(tmpl))
	for i, a := range tmpl {
		for k, v := range vars {
			a = strings.ReplaceAll(a, "{"+k+"}", v)
		}
		res[i] = a
	}
	return res
}

func toolVars(extra map[string]string) map[string]string {
	v := map[string]string{"account": cfg.Account, "password": os.Getenv("FMGIT_PASSWORD"), "earKey": os.Getenv("FMGIT_EAR_KEY")}
	for k, x := range extra {
		v[k] = x
	}
	return v
}

func abs(p string) string {
	a, err := filepath.Abs(p)
	must(err)
	return a
}

func merging() bool {
	_, err := out("git", "rev-parse", "-q", "--verify", "MERGE_HEAD")
	return err == nil
}

func hasRemote() bool { return git("remote") != "" }

// The commit each local .fmp12 matches. Saving a file that is behind HEAD
// would silently revert teammates' work, so save refuses until apply.
func syncedPath(t target) string {
	return git("rev-parse", "--git-path", strings.TrimSuffix("fmgit-synced-"+t.Name, "-"))
}

func synced(t target) string {
	b, _ := os.ReadFile(syncedPath(t))
	return strings.TrimSpace(string(b))
}

func markSynced(ts ...target) {
	head := git("rev-parse", "HEAD")
	for _, t := range ts {
		must(os.WriteFile(syncedPath(t), []byte(head+"\n"), 0o644))
	}
}

// behind reports whether HEAD's src differs from what a local file was last synced to.
func behind() bool {
	for _, t := range targets() {
		if s := synced(t); s != "" {
			if _, err := out("git", "diff", "--quiet", s, "HEAD", "--", t.Src); err != nil {
				return true
			}
		}
	}
	return false
}

func cmdInit(args []string) {
	fs := flag.NewFlagSet("init", flag.ExitOnError)
	file := fs.String("file", "", "the .fmp12 file to track")
	module := fs.String("module", "", "go install path of fmgit for CI (default: how this binary was installed)")
	parse(fs, args)

	if _, err := out("git", "rev-parse", "--git-dir"); err != nil {
		must(run("git", "init", "-b", "main"))
	}
	if _, err := os.Stat(configFile); err != nil {
		c := defaults()
		c.File = *file
		if c.File == "" {
			switch m, _ := filepath.Glob("*.fmp12"); {
			case len(m) == 1:
				c.File = m[0]
			case len(m) > 1:
				c.Files = m
				fmt.Printf("note: tracking %s; edit \"files\" in fmgit.json if that's wrong\n", strings.Join(m, ", "))
			}
		}
		b, _ := json.MarshalIndent(c, "", "  ")
		must(os.WriteFile(configFile, append(b, '\n'), 0o644))
		if c.File == "" && len(c.Files) == 0 {
			fmt.Println("note: set \"file\" in fmgit.json to your .fmp12 (or \"files\" for a multi-file solution)")
		}
	}
	mod := *module
	if bi, ok := debug.ReadBuildInfo(); ok && mod == "" && strings.Contains(bi.Path, ".") {
		mod = bi.Path + "@" + strings.TrimPrefix(bi.Main.Version, "(devel)")
		mod = strings.TrimSuffix(mod, "@")
	}
	if mod == "" {
		mod = "CHANGE_ME/fmgit"
		fmt.Println("note: edit .github/workflows/fmgit.yml and .forgejo/workflows/fmgit.yml: set the go install path of fmgit (or rerun with -module)")
	} else if !strings.Contains(mod, "@") {
		mod += "@latest"
	}
	writeNew(".gitignore", "*.fmp12\nbuild/\n")
	writeNew(".gitattributes", gitattributes)
	wf := strings.ReplaceAll(workflow, "{{MODULE}}", mod)
	writeNew(".github/workflows/fmgit.yml", strings.ReplaceAll(wf, "{{RUNNER}}", "ubuntu-latest"))
	writeNew(".forgejo/workflows/fmgit.yml", strings.ReplaceAll(wf, "{{RUNNER}}", "docker"))
	must(run("git", "add", configFile, ".gitignore", ".gitattributes", ".github", ".forgejo"))
	fmt.Println("ready. next: export FMGIT_PASSWORD=... && fmgit save -m \"initial import\"")
}

const gitattributes = `# fmgit: FileMaker sources
src/** text eol=lf
src/**/_order.txt merge=union
src/**/*StepsForScripts/*.xml diff=fmgit
`

// One workflow for GitHub Actions and Forgejo Actions (same syntax); only the runner label differs.
const workflow = `# fmgit: validates FileMaker sources and posts a readable diff on every pull request.
# Make it a required check (fmgit protect) so PRs only auto-merge when it passes.
name: fmgit
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  fmgit:
    runs-on: {{RUNNER}}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v5
        with:
          go-version: stable
      - run: go install {{MODULE}}
      - name: Validate FileMaker sources (merge result)
        run: $(go env GOPATH)/bin/fmgit check
      - name: Post FileMaker diff
        continue-on-error: true
        env:
          FMGIT_FORGE_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: $(go env GOPATH)/bin/fmgit comment origin/${{ github.base_ref }}...HEAD
`

func writeNew(p, content string) {
	if _, err := os.Stat(p); err == nil {
		return
	}
	must(os.MkdirAll(filepath.Dir(p), 0o755))
	must(os.WriteFile(p, []byte(content), 0o644))
}

func cmdStart(args []string) {
	pos := parse(flag.NewFlagSet("start", flag.ExitOnError), args)
	if len(pos) != 1 {
		die("usage: fmgit start <branch>")
	}
	base := cfg.Main
	if hasRemote() {
		must(run("git", "fetch", "origin"))
		base = "origin/" + cfg.Main
	}
	must(run("git", "switch", "--no-track", "-c", pos[0], base))
	if behind() {
		fmt.Println("your FileMaker file is behind this branch: close it and run `fmgit apply`")
	}
}

// snapshot exports every file of the solution into src/ (or, with xmlPath, the one
// file that export belongs to) and returns what it exported.
func snapshot(xmlPath string) []target {
	ts := targets()
	if len(cfg.Files) > 0 {
		if _, err := os.Stat(filepath.Join(cfg.Src, skeletonFile)); err == nil {
			die("%[1]s/ still has the single-file layout. move it once:\n  git mv %[1]s tmp && mkdir %[1]s && git mv tmp %[1]s/%[2]s && git commit -m \"fmgit: multi-file layout\"\nthen `fmgit apply -mark`", cfg.Src, ts[0].Name)
		}
	}
	if xmlPath != "" {
		root := readExport(xmlPath)
		t := ts[0]
		if len(ts) > 1 {
			i := slices.IndexFunc(ts, func(t target) bool { return strings.EqualFold(t.Name, stem(root.Get("File"))) })
			if i < 0 {
				die("%s is an export of %q, which is not in \"files\"", xmlPath, root.Get("File"))
			}
			t = ts[i]
		}
		writeSrc(t, root)
		return []target{t}
	}
	roots := make([]*Node, len(ts)) // export everything first: a failed export leaves src/ untouched
	for i, t := range ts {
		roots[i] = readExport(export(t))
	}
	for i, t := range ts {
		writeSrc(t, roots[i])
	}
	return ts
}

// export runs FMDeveloperTool (or returns the configured XML path) for one file.
func export(t target) string {
	if t.XML != "" {
		return t.XML
	}
	if t.File == "" {
		die("set \"file\" in %s", configFile)
	}
	if _, err := os.Stat(t.File); err != nil {
		die("%v", err)
	}
	must(os.MkdirAll("build", 0o755))
	xmlPath := abs(t.out(filepath.Join("build", "export.xml")))
	os.Remove(xmlPath)
	cmd := expand(cfg.ExportCmd, toolVars(map[string]string{"file": abs(t.File), "out": xmlPath}))
	if s, err := out(cmd[0], cmd[1:]...); err != nil {
		die("export of %s failed (is the file closed? is FMDeveloperTool on PATH or set in exportCmd?)\n%s%v", t.File, s, err)
	}
	return xmlPath
}

func readExport(xmlPath string) *Node {
	data, err := os.ReadFile(xmlPath)
	must(err)
	root, err := ParseXML(data)
	if err != nil {
		die("%s: %v", xmlPath, err)
	}
	if root.Name != "FMSaveAsXML" {
		die("%s is not a FileMaker \"Save a Copy as XML\" file", xmlPath)
	}
	return root
}

func writeSrc(t target, root *Node) {
	files := split(root)
	must(os.RemoveAll(t.Src))
	n := 0
	for p, b := range files {
		full := filepath.Join(t.Src, filepath.FromSlash(p))
		must(os.MkdirAll(filepath.Dir(full), 0o755))
		must(os.WriteFile(full, b, 0o644))
		if strings.HasSuffix(p, ".xml") && p != skeletonFile {
			n++
		}
	}
	fmt.Printf("exported %d FileMaker objects to %s/\n", n, t.Src)
}

func cmdSnapshot(args []string) {
	fs := flag.NewFlagSet("snapshot", flag.ExitOnError)
	x := fs.String("xml", "", "use an existing \"Save a Copy as XML\" file instead of running FMDeveloperTool")
	parse(fs, args)
	snapshot(*x)
}

func cmdSave(args []string) {
	fs := flag.NewFlagSet("save", flag.ExitOnError)
	msg := fs.String("m", "", "commit message")
	x := fs.String("xml", "", "use an existing \"Save a Copy as XML\" file")
	parse(fs, args)
	if *msg == "" {
		die("usage: fmgit save -m \"what you changed\"")
	}
	if merging() {
		die("a merge is in progress: resolve conflicts in %s/, run `git commit`, then `fmgit apply`", cfg.Src)
	}
	if behind() {
		die("your FileMaker file is behind %s, saving would undo those changes.\nclose the file and run `fmgit apply` first", git("rev-parse", "--short", "HEAD"))
	}
	ts := snapshot(*x)
	must(run("git", "add", "-A", "--", cfg.Src))
	if _, err := out("git", "diff", "--cached", "--quiet"); err == nil {
		fmt.Println("nothing changed")
		markSynced(ts...)
		return
	}
	must(run("git", "commit", "-q", "-m", *msg))
	markSynced(ts...)
	fmt.Println("saved", git("rev-parse", "--short", "HEAD"))
}

var labels = map[string]string{
	"BaseTableCatalog": "Table", "TableOccurrenceCatalog": "Table occurrence", "RelationshipCatalog": "Relationship",
	"FieldsForTables": "Fields of table", "ScriptCatalog": "Script", "StepsForScripts": "Script steps",
	"LayoutCatalog": "Layout", "CustomFunctionsCatalog": "Custom function", "CalcsForCustomFunctions": "Custom function",
	"ValueListCatalog": "Value list", "OptionsForValueLists": "Value list", "ThemeCatalog": "Theme",
	"CustomMenuCatalog": "Custom menu", "CustomMenuSetCatalog": "Custom menu set", "AccountsCatalog": "Account",
	"PrivilegeSetsCatalog": "Privilege set", "ExtendedPrivilegesCatalog": "Extended privilege",
	"LibraryCatalog": "Library item", "ExternalDataSourceCatalog": "Data source", "BaseDirectoryCatalog": "Base directory",
	"FileAccessCatalog": "File access",
}

type change struct {
	Status string `json:"status"` // + - ~
	Type   string `json:"type"`
	Name   string `json:"name"`
	Path   string `json:"path"` // relative to src/
}

// label names a catalog dir; in a multi-file solution prefixed with the file: "UI · Script".
func label(dir string) string {
	file, cat := path.Split(dir)
	cat = cat[strings.LastIndex(cat, ".")+1:]
	if l := labels[cat]; l != "" {
		cat = l
	}
	if file != "" {
		return strings.TrimSuffix(file, "/") + " · " + cat
	}
	return cat
}

// changes lists changed object files in a git range (none = uncommitted work).
func changes(rng []string) ([]change, error) {
	if len(rng) == 0 {
		out("git", "add", "--intent-to-add", "--ignore-removal", "--", cfg.Src) // show new objects too, keep deletions unstaged so they show
	}
	s, err := out("git", append(append([]string{"diff", "--relative", "--name-status", "--no-renames", "-z"}, rng...), "--", cfg.Src)...)
	if err != nil {
		return nil, err
	}
	f := strings.Split(strings.TrimRight(s, "\x00"), "\x00")
	var res []change
	for i := 0; i+1 < len(f); i += 2 {
		rel := strings.TrimPrefix(f[i+1], cfg.Src+"/")
		dir, file := path.Dir(rel), path.Base(rel)
		if file == orderFile {
			continue
		}
		c := change{Status: map[string]string{"A": "+", "D": "-"}[f[i][:1]], Type: label(dir), Name: objectName(file), Path: rel}
		if c.Status == "" {
			c.Status = "~"
		}
		if dir == "." {
			c.Type, c.Name = "File settings", file
		} else if len(cfg.Files) > 0 && !strings.Contains(dir, "/") {
			c.Type, c.Name = dir+" · File settings", file
		}
		res = append(res, c)
	}
	sort.SliceStable(res, func(a, b int) bool { return res[a].Type < res[b].Type })
	return res, nil
}

// diffArgs runs git diff with the readable script view (see .gitattributes).
func diffArgs(rng []string, paths ...string) []string {
	exe, err := os.Executable()
	must(err)
	a := append([]string{"-c", "diff.fmgit.textconv=\"" + filepath.ToSlash(exe) + "\" textconv", "diff"}, rng...)
	if len(paths) == 0 {
		paths = []string{cfg.Src}
	}
	return append(append(a, "--"), paths...)
}

func cmdDiff(args []string) {
	fs := flag.NewFlagSet("diff", flag.ExitOnError)
	md := fs.Bool("md", false, "markdown (for pull request comments)")
	rng := parse(fs, args)
	if *md {
		m, err := diffMarkdown(rng)
		must(err)
		fmt.Print(m)
		return
	}
	all, err := changes(rng)
	must(err)
	type row struct{ status, typ, name string }
	var rows []row
	seen := map[row]bool{}
	for _, c := range all {
		if r := (row{c.Status, c.Type, c.Name}); !seen[r] {
			seen[r] = true
			rows = append(rows, r)
		}
	}
	if len(rows) == 0 {
		fmt.Println("no FileMaker changes")
		return
	}
	for _, r := range rows {
		fmt.Printf("  %s %-18s %s\n", r.status, r.typ, r.name)
	}
	fmt.Println()
	run("git", diffArgs(rng)...)
}

// diffMarkdown is the pull request comment: changed objects plus the readable diff.
func diffMarkdown(rng []string) (string, error) {
	all, err := changes(rng)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	b.WriteString("### FileMaker changes\n\n")
	if len(all) == 0 {
		b.WriteString("No FileMaker changes.\n")
		return b.String(), nil
	}
	b.WriteString("| | Type | Name |\n|---|---|---|\n")
	seen := map[change]bool{}
	for _, c := range all {
		if r := (change{Status: c.Status, Type: c.Type, Name: c.Name}); !seen[r] {
			seen[r] = true
			fmt.Fprintf(&b, "| %s | %s | %s |\n", c.Status, c.Type, strings.ReplaceAll(c.Name, "|", "\\|"))
		}
	}
	d, err := out("git", append([]string{"-c", "color.ui=false"}, diffArgs(rng)...)...)
	if err != nil {
		return "", err
	}
	if len(d) > 50000 {
		d = d[:50000] + "\n... (truncated, run `fmgit diff` locally)\n"
	}
	b.WriteString("\n<details><summary>Full diff</summary>\n\n```diff\n" + d + "```\n</details>\n")
	return b.String(), nil
}

func cmdTextconv(args []string) {
	if len(args) != 1 {
		die("usage: fmgit textconv <file>")
	}
	b, err := os.ReadFile(args[0])
	must(err)
	if n, err := ParseXML(b); err == nil && bytes.Contains(b, []byte("<Step ")) {
		fmt.Print(renderScript(n))
		return
	}
	os.Stdout.Write(b)
}

func cmdPull(args []string) {
	parse(flag.NewFlagSet("pull", flag.ExitOnError), args)
	if merging() {
		die("a merge is in progress: resolve conflicts in %s/, run `git commit`, then `fmgit apply`", cfg.Src)
	}
	if behind() {
		die("your FileMaker file is already behind HEAD: run `fmgit apply` first")
	}
	snapshot("") // catch FileMaker work that was never saved
	if s := git("status", "--porcelain", "--", cfg.Src); s != "" {
		die("your FileMaker file has changes that are not saved yet: run `fmgit save -m ...` first")
	}
	// on main: update main; on a feature branch: bring main's merged work into it
	if err := run("git", "pull", "--no-rebase", "origin", cfg.Main); err != nil {
		die("pull stopped. if there are conflicts: fix them in %s/ (or `git checkout --theirs/--ours <file>`), `git commit`, then `fmgit apply`", cfg.Src)
	}
	cmdApply(nil)
}

func cmdApply(args []string) {
	fs := flag.NewFlagSet("apply", flag.ExitOnError)
	from := fs.String("from", "", "commit your FileMaker file currently matches")
	mark := fs.Bool("mark", false, "only record that your file now matches HEAD (after applying a patch by hand)")
	parse(fs, args)
	if merging() {
		die("a merge is in progress: finish it with `git commit` first")
	}
	if *mark {
		markSynced(targets()...)
		return
	}
	head := git("rev-parse", "HEAD")
	type job struct {
		t     target
		patch string
	}
	var jobs []job
	for _, t := range targets() {
		f := *from
		if f == "" {
			if f = synced(t); f == "" {
				die("unknown which commit %s matches: use -from <commit>, or -mark if it already matches HEAD", t)
			}
		}
		if _, err := out("git", "diff", "--quiet", f, head, "--", t.Src); err == nil {
			fmt.Printf("%s is up to date\n", t)
			markSynced(t)
			continue
		}
		patch, err := makePatch(gitRev{}, f, head, t.Src, cfg.PatchRoot)
		must(err)
		must(os.MkdirAll("build", 0o755))
		pf := t.out(filepath.Join("build", "patch.xml"))
		must(os.WriteFile(pf, patch.XML(), 0o644))
		jobs = append(jobs, job{t, pf})
	}
	if len(jobs) == 0 {
		return
	}
	if _, err := exec.LookPath(cfg.UpgradeCmd[0]); err != nil {
		var ps []string
		for _, j := range jobs {
			ps = append(ps, j.patch+" → "+j.t.File)
		}
		die("patches written, but %s was not found:\n  %s\napply them with FMUpgradeTool (or set upgradeCmd in %s), then run `fmgit apply -mark`", cfg.UpgradeCmd[0], strings.Join(ps, "\n  "), configFile)
	}
	for _, j := range jobs {
		upgrade(j.t, j.patch)
	}
}

// upgrade patches one file with FMUpgradeTool. The original is never edited in place.
func upgrade(t target, pf string) {
	name := filepath.Base(t.File)
	tmp := filepath.Join("build", "patched-"+name)
	os.Remove(tmp)
	cmd := expand(cfg.UpgradeCmd, toolVars(map[string]string{"file": abs(t.File), "out": abs(tmp), "patch": abs(pf)}))
	if err := run(cmd[0], cmd[1:]...); err != nil {
		die("FMUpgradeTool failed on %s (is the file closed?): %v\nthat file is unchanged; the patch is in %s", t.File, err, pf)
	}
	if _, err := os.Stat(tmp); err != nil {
		die("FMUpgradeTool produced no file; %s is unchanged", t.File)
	}
	backup := filepath.Join("build", strings.TrimSuffix(name, ".fmp12")+"."+time.Now().Format("20060102-150405")+".backup.fmp12")
	must(os.Rename(t.File, backup))
	if err := os.Rename(tmp, t.File); err != nil {
		die("could not move %s to %s: %v (your original is in %s)", tmp, t.File, err, backup)
	}
	markSynced(t)
	fmt.Printf("patched %s (backup: %s)\n", t.File, backup)
}

func cmdPatch(args []string) {
	fs := flag.NewFlagSet("patch", flag.ExitOnError)
	o := fs.String("o", "build/patch.xml", "output file")
	pos := parse(fs, args)
	if len(pos) < 1 || len(pos) > 2 {
		die("usage: fmgit patch [-o file] <from> [to]")
	}
	to := "HEAD"
	if len(pos) == 2 {
		to = pos[1]
	}
	for _, t := range targets() {
		p, err := makePatch(gitRev{}, pos[0], to, t.Src, cfg.PatchRoot)
		must(err)
		writeOut(t.out(*o), p.XML())
	}
}

func cmdBuild(args []string) {
	fs := flag.NewFlagSet("build", flag.ExitOnError)
	o := fs.String("o", "build/full.xml", "output file")
	parse(fs, args)
	for _, t := range targets() {
		root, err := build(os.DirFS(t.Src))
		must(err)
		writeOut(t.out(*o), root.XML())
	}
}

func writeOut(p string, b []byte) {
	must(os.MkdirAll(filepath.Dir(p), 0o755))
	must(os.WriteFile(p, b, 0o644))
	fmt.Println("wrote", p)
}

func cmdCheck(args []string) {
	parse(flag.NewFlagSet("check", flag.ExitOnError), args)
	errs := checkAll()
	for _, e := range errs {
		fmt.Println("✗", e)
	}
	if len(errs) > 0 {
		os.Exit(1)
	}
	fmt.Println("✓ FileMaker sources are consistent")
}

// checkAll runs check on every file of the solution.
func checkAll() []string {
	var errs []string
	for _, t := range targets() {
		if _, err := os.Stat(t.Src); err != nil {
			errs = append(errs, t.Src+"/ does not exist yet: fmgit save first")
			continue
		}
		for _, e := range check(os.DirFS(t.Src)) {
			if t.Name != "" {
				e = t.Name + "/" + e
			}
			errs = append(errs, e)
		}
	}
	return errs
}
