package main

import (
	"encoding/xml"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

// Layout of src/:
//
//	skeleton.xml              the export with every catalog emptied
//	<Catalog>/<name>.<id>.xml one file per FileMaker object (script, table, layout, ...)
//	<Catalog>/_order.txt      object order (merge=union, so parallel additions never conflict)
//
// Catalogs outside Structure/AddAction get a prefixed dir, e.g. ModifyAction.LayoutCatalog.
const (
	skeletonFile = "skeleton.xml"
	orderFile    = "_order.txt"
	dirAttr      = "fmgit-dir"
)

// Catalog children that describe the catalog itself, not a FileMaker object.
var metaTags = map[string]bool{"UUID": true, "TagList": true, "Options": true, "PasteIndexList": true}

// normalize strips what changes on every save without meaning anything,
// so diffs show only real changes and parallel edits merge cleanly.
// build/finish recompute membercount and step indexes.
func normalize(root *Node) {
	for _, a := range perDev {
		root.Del(a)
	}
	root.Walk(func(n *Node) bool {
		switch n.Name {
		case "UUID":
			for _, a := range []string{"modifications", "timestamp", "userName", "accountName"} {
				n.Del(a)
			}
		case "ObjectList":
			blank(n)
			for _, k := range n.Kids {
				if k.Name == "Step" { // script steps; button steps keep their index
					k.Del("index")
				}
			}
		case "INSECURE_PASSWORD": // account passwords and the auto-login password: never commit them
			n.Kids, n.Text = nil, ""
			return false
		}
		return true
	})
}

// Root attributes that differ per developer (file name, FileMaker version, UI language).
var perDev = []string{"File", "Source", "locale"}

func blank(n *Node) {
	if n.Has("membercount") {
		n.Set("membercount", "")
	}
}

// container is where a catalog keeps its objects: an ObjectList child or the catalog itself.
func container(cat *Node) *Node {
	if ol := cat.Child("ObjectList"); ol != nil {
		return ol
	}
	return cat
}

// split turns a "Save a Copy as XML" document into one file per FileMaker object.
func split(root *Node) map[string][]byte {
	normalize(root)
	files := map[string][]byte{}
	dirs := map[string]bool{}
	for _, sec := range root.Kids {
		if sec.Name != "Structure" {
			continue
		}
		blank(sec)
		for _, act := range sec.Kids {
			blank(act)
			for _, cat := range act.Kids {
				dir := cat.Name
				if act.Name != "AddAction" {
					dir = act.Name + "." + dir
				}
				for i, base := 2, dir; dirs[strings.ToLower(dir)]; i++ {
					dir = fmt.Sprintf("%s~%d", base, i)
				}
				dirs[strings.ToLower(dir)] = true
				blank(cat)
				cat.Set(dirAttr, dir)
				c := container(cat)
				var keep []*Node
				var order []string
				used := map[string]bool{}
				for i, o := range c.Kids {
					if metaTags[o.Name] {
						keep = append(keep, o)
						continue
					}
					f := fileName(o, i, used)
					files[dir+"/"+f] = o.XML()
					order = append(order, f)
				}
				c.Kids = keep
				if len(order) > 0 {
					files[dir+"/"+orderFile] = []byte(strings.Join(order, "\n") + "\n")
				}
			}
		}
	}
	files[skeletonFile] = root.XML()
	return files
}

// ident returns name, id and UUID of a FileMaker object. Objects carry them
// as attributes, or (StepsForScripts, FieldsForTables, ...) via a *Reference child.
func ident(o *Node) (name, id, uuid string) {
	name, id = o.Get("name"), o.Get("id")
	if u := o.Child("UUID"); u != nil {
		uuid = u.Text
	}
	if name == "" && id == "" {
		for _, k := range o.Kids {
			if strings.HasSuffix(k.Name, "Reference") {
				name, id = k.Get("name"), k.Get("id")
				if uuid == "" {
					uuid = k.Get("UUID")
				}
				break
			}
		}
	}
	return
}

var winReserved = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com\d|lpt\d)$`)

// safeName makes a FileMaker object name a valid file name on Windows, macOS and Linux.
func safeName(s string) string {
	s = strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, s)
	if r := []rune(s); len(r) > 60 {
		s = string(r[:60])
	}
	s = strings.TrimRight(s, ". ")
	if winReserved.MatchString(s) {
		s = "_" + s
	}
	return s
}

func fileName(o *Node, i int, used map[string]bool) string {
	name, id, _ := ident(o)
	base := safeName(name)
	if id != "" {
		if base != "" {
			base += "."
		}
		base += id
	}
	if base == "" {
		base = fmt.Sprintf("%s-%d", o.Name, i)
	}
	f := base + ".xml"
	for n := 2; used[strings.ToLower(f)]; n++ { // case-insensitive file systems
		f = fmt.Sprintf("%s~%d.xml", base, n)
	}
	used[strings.ToLower(f)] = true
	return f
}

var fileLabel = regexp.MustCompile(`^(.*?)(\.\d+)?(~\d+)?\.xml$`)

// objectName recovers the display name from a split file name.
func objectName(file string) string {
	if m := fileLabel.FindStringSubmatch(file); m != nil && m[1] != "" {
		return m[1]
	}
	return file
}

// build reassembles the full "Save a Copy as XML" document from split files.
func build(fsys fs.FS) (*Node, error) {
	sk, err := fs.ReadFile(fsys, skeletonFile)
	if err != nil {
		return nil, err
	}
	root, err := ParseXML(sk)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", skeletonFile, err)
	}
	var ferr error
	root.Walk(func(n *Node) bool {
		dir := n.Get(dirAttr)
		if dir == "" || ferr != nil {
			return ferr == nil
		}
		n.Del(dirAttr)
		objs, err := readDir(fsys, dir)
		if err != nil {
			ferr = err
			return false
		}
		c := container(n)
		c.Kids = append(c.Kids, objs...)
		if n.Has("membercount") {
			n.Set("membercount", strconv.Itoa(len(objs)))
		}
		return false
	})
	if ferr != nil {
		return nil, ferr
	}
	finish(root)
	return root, nil
}

// orderedFiles lists a catalog's object files in FileMaker order (_order.txt first, then new ones).
func orderedFiles(fsys fs.FS, dir string) ([]string, error) {
	ents, err := fs.ReadDir(fsys, dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	present := map[string]bool{}
	for _, e := range ents {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".xml") {
			present[e.Name()] = true
		}
	}
	var names []string
	if b, err := fs.ReadFile(fsys, path.Join(dir, orderFile)); err == nil {
		for _, l := range strings.Split(string(b), "\n") {
			if l = strings.TrimSpace(l); present[l] {
				names = append(names, l)
				delete(present, l) // union merges can duplicate lines
			}
		}
	}
	rest := make([]string, 0, len(present))
	for f := range present {
		rest = append(rest, f)
	}
	sort.Strings(rest)
	return append(names, rest...), nil
}

func readDir(fsys fs.FS, dir string) ([]*Node, error) {
	files, err := orderedFiles(fsys, dir)
	if err != nil {
		return nil, err
	}
	var objs []*Node
	for _, f := range files {
		b, err := fs.ReadFile(fsys, path.Join(dir, f))
		if err != nil {
			return nil, err
		}
		o, err := ParseXML(b)
		if err != nil {
			return nil, fmt.Errorf("%s/%s: %w", dir, f, err)
		}
		objs = append(objs, o)
	}
	return objs, nil
}

// finish recomputes what normalize blanked: membercounts and step indexes.
func finish(root *Node) {
	root.Walk(func(n *Node) bool {
		if n.Has("membercount") && n.Get("membercount") == "" {
			n.Set("membercount", strconv.Itoa(len(n.Kids)))
		}
		if n.Name == "ObjectList" {
			for i, s := range n.Kids {
				if s.Name == "Step" {
					s.Del("index")
					at := 0
					if len(s.Attr) > 0 && s.Attr[0].Name.Local == "hash" {
						at = 1
					}
					s.Attr = slices.Insert(s.Attr, at, xml.Attr{Name: xml.Name{Local: "index"}, Value: strconv.Itoa(i)})
				}
			}
		}
		return true
	})
}

// Names FileMaker itself requires to be unique within their catalog/table.
var uniqueNames = map[string]bool{"BaseTable": true, "TableOccurrence": true, "CustomFunction": true, "ValueList": true, "Field": true}

// check validates src/: well-formed XML, no leftover conflict markers, and no
// id/name collisions. Collisions happen when two branches each create a new
// object in their own copy of the file and FileMaker hands out the same id;
// git merges both files cleanly but FMUpgradeTool would reject the result.
func check(fsys fs.FS) []string {
	var errs []string
	type seen struct{ file, uuid string }
	ids := map[string]seen{}     // dir|tag#id
	names := map[string]string{} // dir|tag#name
	err := fs.WalkDir(fsys, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(p, ".xml") {
			return err
		}
		b, err := fs.ReadFile(fsys, p)
		if err != nil {
			return err
		}
		for _, l := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(l, "<<<<<<< ") || strings.HasPrefix(l, ">>>>>>> ") {
				errs = append(errs, p+": unresolved merge conflict")
				return nil
			}
		}
		o, err := ParseXML(b)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: invalid XML: %v", p, err))
			return nil
		}
		dir := path.Dir(p)
		if dir == "." {
			return nil
		}
		name, id, uuid := ident(o)
		if id != "" {
			k := dir + "|" + o.Name + "#" + id
			if prev, ok := ids[k]; ok && prev.uuid != uuid {
				errs = append(errs, fmt.Sprintf("%s: id %s already used by %s (two branches created different objects with the same id; recreate one of them)", p, id, prev.file))
			}
			ids[k] = seen{p, uuid}
		}
		if uniqueNames[o.Name] {
			k := dir + "|" + o.Name + "#" + strings.ToLower(name)
			if prev, ok := names[k]; ok {
				errs = append(errs, fmt.Sprintf("%s: name %q already used by %s", p, name, prev))
			}
			names[k] = p
		}
		errs = append(errs, dupKids(o, p)...)
		return nil
	})
	if err != nil {
		errs = append(errs, err.Error())
	}
	if _, err := build(fsys); err != nil {
		errs = append(errs, "rebuild failed: "+err.Error())
	}
	return errs
}

// dupKids finds id/name collisions inside an object, e.g. two branches adding field id 12 to the same table.
func dupKids(o *Node, file string) []string {
	var errs []string
	o.Walk(func(e *Node) bool {
		if e.Name == "Step" {
			return false
		}
		if e.Name != "ObjectList" {
			return true
		}
		ids, names := map[string]string{}, map[string]bool{}
		for _, k := range e.Kids {
			id, name := k.Get("id"), k.Get("name")
			if id != "" && k.Name != "Step" {
				if prev, ok := ids[k.Name+"#"+id]; ok {
					errs = append(errs, fmt.Sprintf("%s: %s id %s used by both %q and %q", file, k.Name, id, prev, name))
				}
				ids[k.Name+"#"+id] = name
			}
			if uniqueNames[k.Name] && name != "" {
				if names[k.Name+"#"+strings.ToLower(name)] {
					errs = append(errs, fmt.Sprintf("%s: duplicate %s name %q", file, k.Name, name))
				}
				names[k.Name+"#"+strings.ToLower(name)] = true
			}
		}
		return true
	})
	return errs
}

// Rev reads files of a git revision; tests and the CLI both use git.
type Rev interface {
	Changes(from, to, src string) ([][2]string, error) // status, path
	Show(rev, path string) ([]byte, error)
}

type catInfo struct {
	action string
	cat    *Node
}

// makePatch builds an FMUpgradeTool patch holding every object that differs
// between two commits: new → AddAction, changed/renamed → ReplaceAction,
// removed → DeleteAction. Objects FileMaker exports in a second pass
// (ModifyAction.*) go back into ModifyAction.
// ponytail: patch grammar follows the export grammar; verify on a copy with your FMUpgradeTool version.
func makePatch(g Rev, from, to, src, rootName string) (*Node, error) {
	changes, err := g.Changes(from, to, src)
	if err != nil {
		return nil, err
	}
	type pair struct {
		dir      string
		old, new *Node
	}
	pairs := map[string]*pair{}
	var keys []string
	for _, ch := range changes {
		status, p := ch[0], ch[1]
		rel := strings.TrimPrefix(p, src+"/")
		dir, file := path.Split(rel)
		dir = strings.TrimSuffix(dir, "/")
		if dir == "" || !strings.HasSuffix(file, ".xml") {
			continue
		}
		load := func(rev string) (*Node, error) {
			b, err := g.Show(rev, p)
			if err != nil {
				return nil, err
			}
			return ParseXML(b)
		}
		var o, n *Node
		if status != "A" {
			if o, err = load(from); err != nil {
				return nil, fmt.Errorf("%s@%s: %w", p, from, err)
			}
		}
		if status != "D" {
			if n, err = load(to); err != nil {
				return nil, fmt.Errorf("%s@%s: %w", p, to, err)
			}
		}
		for _, x := range []*Node{o, n} {
			if x == nil {
				continue
			}
			_, id, uuid := ident(x)
			k := dir + "|" + first(uuid, id, file)
			pr := pairs[k]
			if pr == nil {
				pr = &pair{dir: dir}
				pairs[k] = pr
				keys = append(keys, k)
			}
			if x == o {
				pr.old = o
			} else {
				pr.new = n
			}
		}
	}

	cats := map[string]catInfo{}
	var order []string
	var head *Node
	for _, rev := range []string{to, from} {
		b, err := g.Show(rev, src+"/"+skeletonFile)
		if err != nil {
			continue // skeleton may not exist in the first commit
		}
		sk, err := ParseXML(b)
		if err != nil {
			return nil, err
		}
		if head == nil {
			head = sk
		}
		for _, sec := range sk.Kids {
			if sec.Name != "Structure" {
				continue
			}
			for _, act := range sec.Kids {
				for _, cat := range act.Kids {
					if d := cat.Get(dirAttr); d != "" && cats[d].cat == nil {
						cats[d] = catInfo{act.Name, cat}
						order = append(order, d)
					}
				}
			}
		}
	}

	byDir := map[string]map[string][]*Node{}
	for _, k := range keys {
		p := pairs[k]
		ci, ok := cats[p.dir]
		if !ok {
			return nil, fmt.Errorf("%s/%s is not in %s", src, p.dir, skeletonFile)
		}
		act, obj := "ReplaceAction", p.new
		if hasPassword(p.old) || hasPassword(p.new) {
			// passwords are stripped from src/, patching would blank them
			fmt.Fprintf(os.Stderr, "skipped %s in %s: change accounts in FileMaker directly\n", k[strings.Index(k, "|")+1:], p.dir)
			continue
		}
		switch {
		case p.old == nil:
			act = "AddAction"
		case p.new == nil:
			act, obj = "DeleteAction", p.old
		}
		if ci.action != "AddAction" {
			if p.new == nil {
				continue // the AddAction twin carries the delete
			}
			act = ci.action
		}
		if byDir[p.dir] == nil {
			byDir[p.dir] = map[string][]*Node{}
		}
		byDir[p.dir][act] = append(byDir[p.dir][act], obj)
	}

	root := &Node{Name: rootName}
	if head != nil && head.Get("version") != "" {
		root.Set("version", head.Get("version"))
	}
	st := &Node{Name: "Structure"}
	st.Set("membercount", "")
	for _, act := range []string{"AddAction", "ReplaceAction", "ModifyAction", "DeleteAction"} {
		an := &Node{Name: act}
		an.Set("membercount", "")
		for _, d := range order {
			objs := byDir[d][act]
			if len(objs) == 0 {
				continue
			}
			cat := cats[d].cat.Clone()
			cat.Del(dirAttr)
			c := container(cat)
			c.Kids = append(c.Kids, objs...)
			if cat.Has("membercount") {
				cat.Set("membercount", strconv.Itoa(len(objs)))
			}
			an.Kids = append(an.Kids, cat)
		}
		if len(an.Kids) > 0 {
			st.Kids = append(st.Kids, an)
		}
	}
	root.Kids = []*Node{st}
	finish(root)
	return root, nil
}

func hasPassword(n *Node) bool {
	found := false
	if n != nil {
		n.Walk(func(e *Node) bool { found = found || e.Name == "INSECURE_PASSWORD"; return !found })
	}
	return found
}

func first(s ...string) string {
	for _, v := range s {
		if v != "" {
			return v
		}
	}
	return ""
}

var (
	blockOpen = map[string]bool{"If": true, "Loop": true, "Open Transaction": true}
	blockMid  = map[string]bool{"Else": true, "Else If": true}
	blockEnd  = map[string]bool{"End If": true, "End Loop": true, "Commit Transaction": true}
)

// renderScript prints steps roughly the way the Script Workspace shows them,
// so script diffs are reviewable by humans. Review aid only, the XML stays the truth.
func renderScript(o *Node) string {
	var b strings.Builder
	name, _, _ := ident(o)
	fmt.Fprintf(&b, "Script: %s\n", name)
	depth := 0
	o.Walk(func(s *Node) bool {
		if s.Name != "Step" {
			return true
		}
		step := s.Get("name")
		if blockEnd[step] || blockMid[step] {
			depth = max(depth-1, 0)
		}
		line := step
		if p := params(s); strings.HasPrefix(step, "#") {
			line = strings.TrimRight("# "+p, " ")
		} else if p != "" {
			line += " [ " + p + " ]"
		}
		if s.Get("enable") == "False" {
			line = "// " + line
		}
		pad := strings.Repeat("    ", depth)
		// continuation lines get 6 extra spaces (not a multiple of 4) so the UI can tell them from steps
		b.WriteString(pad + strings.ReplaceAll(line, "\n", "\n"+pad+"      ") + "\n")
		if blockOpen[step] || blockMid[step] {
			depth++
		}
		return false
	})
	return b.String()
}

func params(s *Node) string {
	pv := s.Child("ParameterValues")
	if pv == nil {
		return ""
	}
	var out []string
	for _, p := range pv.Kids {
		if v := param(p); v != "" {
			out = append(out, v)
		}
	}
	return strings.Join(out, " ; ")
}

func param(p *Node) string {
	if p.Get("type") == "Variable" {
		s := ""
		if n := p.Child("Name"); n != nil {
			s = n.Get("value")
		}
		if r := p.Child("repetition"); r != nil && strings.TrimSpace(textOf(r)) != "1" {
			s += "[" + textOf(r) + "]"
		}
		if v := p.Child("value"); v != nil {
			s += " ; Value: " + textOf(v)
		}
		return s
	}
	var parts []string
	if v := p.Get("value"); v != "" {
		parts = append(parts, v)
	}
	var visit func(e *Node)
	visit = func(e *Node) {
		switch {
		case e.Name == "Comment" || e.Name == "Name":
			parts = append(parts, e.Get("value"))
			return
		case e.Name == "Boolean":
			v := map[string]string{"True": "On", "False": "Off"}[e.Get("value")]
			if t := e.Get("type"); t != "" {
				v = t + ": " + v
			}
			parts = append(parts, v)
			return
		case e.Name == "repetition":
			if t := strings.TrimSpace(textOf(e)); t != "1" {
				parts = append(parts, "["+t+"]")
			}
			return
		case e.Name == "FieldReference":
			s := e.Get("name")
			if t := e.Child("TableOccurrenceReference"); t != nil {
				s = t.Get("name") + "::" + s
			}
			parts = append(parts, s)
			if r := e.Child("repetition"); r != nil {
				visit(r)
			}
			return
		case e.Name == "Text" && len(e.Kids) == 0:
			parts = append(parts, e.Text)
			return
		case strings.HasSuffix(e.Name, "Reference") && e.Get("name") != "":
			parts = append(parts, e.Get("name"))
			return
		}
		if c := e.Get("criteria"); c != "" {
			parts = append(parts, c)
		}
		for _, k := range e.Kids {
			visit(k)
		}
	}
	for _, k := range p.Kids {
		visit(k)
	}
	return strings.Join(parts, " ; ")
}

func textOf(n *Node) string {
	var parts []string
	n.Walk(func(e *Node) bool {
		if e.Name == "Text" && len(e.Kids) == 0 {
			parts = append(parts, e.Text)
		}
		return true
	})
	return strings.Join(parts, " ")
}
