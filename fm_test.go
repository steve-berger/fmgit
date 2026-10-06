package main

import (
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"unicode/utf16"
)

// Trimmed-down copy of a real FileMaker 2024 "Save a Copy as XML" export.
const fixture = `<?xml version="1.0"?>
<FMSaveAsXML version="2.2.2.0" Source="21.1.8" File="app.fmp12" UUID="F1">
	<Structure membercount="2">
		<AddAction membercount="5">
			<BaseTableCatalog membercount="1">
				<UUID modifications="4" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:59:07">C1</UUID>
				<TagList></TagList>
				<BaseTable id="129" name="Invoices">
					<UUID modifications="2" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:59:07">T1</UUID>
					<TagList></TagList>
				</BaseTable>
			</BaseTableCatalog>
			<CustomFunctionsCatalog membercount="1">
				<UUID modifications="9" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:59:07">C2</UUID>
				<TagList></TagList>
				<ObjectList membercount="1">
					<CustomFunction id="1" name="ValidJSON" access="All">
						<UUID modifications="0" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:59:07">CF1</UUID>
						<Display><![CDATA[ValidJSON ( json )]]></Display>
					</CustomFunction>
				</ObjectList>
			</CustomFunctionsCatalog>
			<FieldsForTables membercount="1">
				<FieldCatalog>
					<UUID modifications="6" userName="Dev" accountName="Admin" timestamp="2026-05-21T13:03:12">FC1</UUID>
					<BaseTableReference id="129" name="Invoices" UUID="T1"></BaseTableReference>
					<ObjectList membercount="2">
						<Field id="1" name="PrimaryKey" fieldtype="Normal" datatype="Text" comment="">
							<UUID modifications="0" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:58:37">F1</UUID>
						</Field>
						<Field id="2" name="Total" fieldtype="Normal" datatype="Number" comment="">
							<UUID modifications="0" userName="Dev" accountName="Admin" timestamp="2026-05-21T08:58:37">F2</UUID>
						</Field>
					</ObjectList>
				</FieldCatalog>
			</FieldsForTables>
			<ScriptCatalog membercount="2">
				<UUID modifications="450" userName="Dev" accountName="Admin" timestamp="2026-05-29T09:43:06">C3</UUID>
				<TagList></TagList>
				<Script id="2" name="Create Invoice">
					<UUID modifications="9" userName="Dev" accountName="Admin" timestamp="2026-05-22T14:12:07">S2</UUID>
				</Script>
				<Script id="3" name="Print: Invoice?">
					<UUID modifications="1" userName="Dev" accountName="Admin" timestamp="2026-05-22T14:12:07">S3</UUID>
				</Script>
			</ScriptCatalog>
			<StepsForScripts membercount="1">
				<Script>
					<ScriptReference id="2" name="Create Invoice" UUID="S2"></ScriptReference>
					<ObjectList membercount="4">
						<Step hash="A" index="0" id="141" name="Set Variable" enable="True">
							<ParameterValues membercount="1">
								<Parameter type="Variable">
									<value><Calculation datatype="1"><Calculation><Text><![CDATA[Get ( ScriptParameter ) & "x"]]></Text></Calculation></Calculation></value>
									<Name value="$param"></Name>
									<repetition><Calculation datatype="1"><Calculation><Text>1</Text></Calculation></Calculation></repetition>
								</Parameter>
							</ParameterValues>
						</Step>
						<Step hash="B" index="1" id="68" name="If" enable="True">
							<ParameterValues membercount="1">
								<Parameter type="Calculation"><Calculation datatype="7"><Calculation><Text>IsEmpty ( $param )</Text></Calculation></Calculation></Parameter>
							</ParameterValues>
						</Step>
						<Step hash="C" index="2" id="103" name="Exit Script" enable="False"></Step>
						<Step hash="D" index="3" id="70" name="End If" enable="True"></Step>
					</ObjectList>
				</Script>
			</StepsForScripts>
		</AddAction>
		<ModifyAction membercount="1">
			<LayoutCatalog membercount="1">
				<Layout>
					<LayoutReference id="2" name="Invoices" UUID="L2"></LayoutReference>
				</Layout>
			</LayoutCatalog>
		</ModifyAction>
	</Structure>
	<Metadata membercount="1">
		<AddAction membercount="1">
			<Login type="1"><INSECURE_PASSWORD><INSECURE_TEXT>hunter2</INSECURE_TEXT></INSECURE_PASSWORD></Login>
		</AddAction>
	</Metadata>
</FMSaveAsXML>
`

func utf16le(s string) []byte {
	u := utf16.Encode([]rune(s))
	b := []byte{0xFF, 0xFE}
	for _, c := range u {
		b = binary.LittleEndian.AppendUint16(b, c)
	}
	return b
}

// diff returns the path of the first difference between two trees, "" if equal.
func diff(a, b *Node, at string) string {
	at += "/" + a.Name
	if a.Name != b.Name || a.Text != b.Text || len(a.Attr) != len(b.Attr) || len(a.Kids) != len(b.Kids) {
		return fmt.Sprintf("%s: %v %q %d kids vs %s %v %q %d kids", at, a.Attr, a.Text, len(a.Kids), b.Name, b.Attr, b.Text, len(b.Kids))
	}
	for _, x := range a.Attr {
		if !b.Has(x.Name.Local) || b.Get(x.Name.Local) != x.Value {
			return fmt.Sprintf("%s@%s: %q vs %q", at, x.Name.Local, x.Value, b.Get(x.Name.Local))
		}
	}
	for i := range a.Kids {
		if d := diff(a.Kids[i], b.Kids[i], at); d != "" {
			return d
		}
	}
	return ""
}

// split → build must give back the export, minus the volatile UUID attributes and the password.
func roundTrip(t *testing.T, name string, data []byte) map[string][]byte {
	orig, err := ParseXML(data)
	if err != nil {
		t.Fatal(name, err)
	}
	want, _ := ParseXML(data)
	for _, a := range perDev {
		want.Del(a)
	}
	want.Walk(func(n *Node) bool {
		if n.Name == "UUID" {
			for _, a := range []string{"modifications", "timestamp", "userName", "accountName"} {
				n.Del(a)
			}
		}
		if n.Name == "INSECURE_PASSWORD" {
			n.Kids, n.Text = nil, ""
		}
		return true
	})
	files := split(orig)
	fsys := fstest.MapFS{}
	for p, b := range files {
		fsys[p] = &fstest.MapFile{Data: b}
	}
	got, err := build(fsys)
	if err != nil {
		t.Fatal(name, err)
	}
	if d := diff(want, got, ""); d != "" {
		t.Fatalf("%s: rebuilt XML differs from export at %s", name, d)
	}
	if errs := check(fsys); len(errs) > 0 {
		t.Fatalf("%s: check on a clean export: %v", name, errs)
	}
	return files
}

func TestRoundTrip(t *testing.T) {
	files := roundTrip(t, "fixture", utf16le(fixture))
	for _, f := range []string{"ScriptCatalog/Create Invoice.2.xml", "ScriptCatalog/Print_ Invoice_.3.xml",
		"StepsForScripts/Create Invoice.2.xml", "FieldsForTables/Invoices.129.xml", "ModifyAction.LayoutCatalog/Invoices.2.xml"} {
		if files[f] == nil {
			t.Errorf("missing %s", f)
		}
	}
	if strings.Contains(string(files[skeletonFile]), "hunter2") {
		t.Error("auto-login password leaked into the repo")
	}
	steps, _ := ParseXML(files["StepsForScripts/Create Invoice.2.xml"])
	want := "Script: Create Invoice\nSet Variable [ $param ; Value: Get ( ScriptParameter ) & \"x\" ]\nIf [ IsEmpty ( $param ) ]\n    // Exit Script\nEnd If\n"
	if got := renderScript(steps); got != want {
		t.Errorf("render:\n%s\nwant:\n%s", got, want)
	}
	// FMGIT_SAMPLES=a.xml,b.xml go test  → round-trip real exports too
	for _, p := range strings.Split(os.Getenv("FMGIT_SAMPLES"), ",") {
		if p != "" {
			b, err := os.ReadFile(p)
			if err != nil {
				t.Fatal(err)
			}
			roundTrip(t, p, b)
		}
	}
}

// Two developers change the same script and the same table in parallel: git
// merges cleanly, check passes, and the patch carries exactly the merged changes.
// Then two branches create different objects with the same id: check must catch it.
func TestMergeAndPatch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	t.Chdir(t.TempDir())
	sh := func(args ...string) string {
		t.Helper()
		s, err := out("git", args...)
		if err != nil {
			t.Fatal(err)
		}
		return strings.TrimSpace(s)
	}
	write := func(p, s string) {
		t.Helper()
		os.MkdirAll(filepath.Dir(p), 0o755)
		if err := os.WriteFile(p, []byte(s), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	edit := func(p, old, new string) {
		t.Helper()
		b, _ := os.ReadFile(p)
		if !strings.Contains(string(b), old) {
			t.Fatalf("%s: %q not found", p, old)
		}
		write(p, strings.Replace(string(b), old, new, 1))
	}
	sh("init", "-q", "-b", "main")
	sh("config", "user.email", "t@t")
	sh("config", "user.name", "t")
	write(".gitattributes", gitattributes)
	root, _ := ParseXML([]byte(fixture))
	for p, b := range split(root) {
		write("src/"+p, string(b))
	}
	sh("add", "-A")
	sh("commit", "-qm", "base")
	base := sh("rev-parse", "HEAD")

	steps := "src/StepsForScripts/Create Invoice.2.xml"
	sh("switch", "-qc", "alice")
	edit(steps, `<Step hash="D"`, `<Step hash="E" id="89" name="# (comment)" enable="True"></Step>
				<Step hash="D"`)
	edit("src/FieldsForTables/Invoices.129.xml", "</ObjectList>", `	<Field id="3" name="Tax" fieldtype="Normal" datatype="Number" comment=""></Field>
		</ObjectList>`)
	sh("commit", "-qam", "alice")

	sh("switch", "-q", "main")
	sh("switch", "-qc", "bob")
	edit(steps, `<Step hash="A"`, `<Step hash="F" id="86" name="Set Error Capture" enable="True"></Step>
				<Step hash="A"`)
	write("src/ScriptCatalog/Send Invoice.4.xml", "<Script id=\"4\" name=\"Send Invoice\">\n\t<UUID>S4</UUID>\n</Script>\n")
	edit("src/ScriptCatalog/_order.txt", "Print_ Invoice_.3.xml\n", "Print_ Invoice_.3.xml\nSend Invoice.4.xml\n")
	sh("add", "-A")
	sh("commit", "-qm", "bob")

	sh("switch", "-q", "alice")
	sh("merge", "-q", "--no-edit", "bob") // must not conflict
	if errs := check(os.DirFS("src")); len(errs) > 0 {
		t.Fatalf("check after clean merge: %v", errs)
	}

	p, err := makePatch(gitRev{}, base, "HEAD", "src", "FMUpgradeToolPatch")
	if err != nil {
		t.Fatal(err)
	}
	x := string(p.XML())
	for _, want := range []string{
		`<AddAction membercount="1">`, `<Script id="4" name="Send Invoice">`, // new script
		`<ReplaceAction membercount="2">`, `<Field id="3" name="Tax"`, `hash="F" index="0"`, `hash="E" index="4"`, // both edits, reindexed
		`<ObjectList membercount="6">`, // 4 steps + 2 new
	} {
		if !strings.Contains(x, want) {
			t.Errorf("patch is missing %s\n%s", want, x)
		}
	}
	if strings.Contains(x, "DeleteAction") || strings.Contains(x, "fmgit-dir") {
		t.Errorf("unexpected content in patch:\n%s", x)
	}

	// Parallel branches both create custom function id 2.
	sh("switch", "-qc", "carol", base)
	write("src/CustomFunctionsCatalog/Tax.2.xml", "<CustomFunction id=\"2\" name=\"Tax\">\n\t<UUID>CF2</UUID>\n</CustomFunction>\n")
	sh("add", "-A")
	sh("commit", "-qm", "carol")
	sh("switch", "-qc", "dave", base)
	write("src/CustomFunctionsCatalog/Discount.2.xml", "<CustomFunction id=\"2\" name=\"Discount\">\n\t<UUID>CF3</UUID>\n</CustomFunction>\n")
	sh("add", "-A")
	sh("commit", "-qm", "dave")
	sh("merge", "-q", "--no-edit", "carol")
	errs := check(os.DirFS("src"))
	if len(errs) != 1 || !strings.Contains(errs[0], "id 2 already used") {
		t.Fatalf("expected id collision, got %v", errs)
	}
}

func TestParseRemote(t *testing.T) {
	for in, want := range map[string][3]string{
		"https://github.com/acme/app.git":                    {"https://github.com", "acme", "app"},
		"http://steve:tok@localhost:3300/steve/invoices.git": {"http://localhost:3300", "steve", "invoices"},
		"git@codeberg.org:team/app.git":                      {"https://codeberg.org", "team", "app"},
		"ssh://git@git.example.com:2222/team/app.git":        {"https://git.example.com", "team", "app"},
	} {
		b, o, r, err := parseRemote(in)
		if err != nil || [3]string{b, o, r} != want {
			t.Errorf("parseRemote(%q) = %q %q %q %v, want %v", in, b, o, r, err, want)
		}
	}
}

// A solution of two files: each lives in src/<name>/, a change in one file only
// shows up (and patches) there, and the sync state is tracked per file.
func TestMultiFile(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	t.Chdir(t.TempDir())
	for _, a := range [][]string{{"init", "-q", "-b", "main"}, {"config", "user.email", "t@t"}, {"config", "user.name", "t"}} {
		if _, err := out("git", a...); err != nil {
			t.Fatal(err)
		}
	}
	os.WriteFile(configFile, []byte(`{"files": ["UI.fmp12", "Data.fmp12"]}`), 0o644)
	loadConfig()
	exp := func(file, from, to string) string {
		p := file + ".xml"
		os.WriteFile(p, []byte(strings.Replace(strings.Replace(fixture, `File="app.fmp12"`, `File="`+file+`"`, 1), from, to, 1)), 0o644)
		return p
	}
	if ts := snapshot(exp("UI.fmp12", "", "")); len(ts) != 1 || ts[0].Name != "UI" {
		t.Fatalf("UI export went to %v", ts)
	}
	snapshot(exp("Data.fmp12", "", ""))
	for _, f := range []string{"src/UI/ScriptCatalog/Create Invoice.2.xml", "src/Data/StepsForScripts/Create Invoice.2.xml", "src/Data/" + skeletonFile} {
		if _, err := os.Stat(f); err != nil {
			t.Error(err)
		}
	}
	git("add", "-A")
	git("commit", "-qm", "base")
	base := git("rev-parse", "HEAD")
	markSynced(targets()...)
	if errs := checkAll(); len(errs) > 0 {
		t.Fatal(errs)
	}

	snapshot(exp("Data.fmp12", `name="Print: Invoice?"`, `name="Print Invoice"`))
	ch, err := changes(nil)
	if err != nil || len(ch) != 2 || ch[0].Type != "Data · Script" {
		t.Fatalf("changes = %+v %v", ch, err)
	}
	git("add", "-A")
	git("commit", "-qm", "rename")
	if !behind() {
		t.Error("files synced to the old commit must be behind")
	}
	ts := targets()
	for i, want := range []bool{false, true} {
		p, err := makePatch(gitRev{}, base, "HEAD", ts[i].Src, cfg.PatchRoot)
		if err != nil {
			t.Fatal(err)
		}
		if got := strings.Contains(string(p.XML()), `name="Print Invoice"`); got != want {
			t.Errorf("%s patch carries the rename: %v, want %v", ts[i].Name, got, want)
		}
	}
	markSynced(ts[1])
	if behind() {
		t.Error("UI is unchanged, Data is synced: nothing is behind")
	}
	if got := label("UI/ModifyAction.LayoutCatalog"); got != "UI · Layout" {
		t.Errorf("label = %q", got)
	}
	if got := ts[0].out("build/patch.xml"); got != filepath.Join("build", "UI.patch.xml") {
		t.Errorf("out = %q", got)
	}
}

func TestOutRedactsSecrets(t *testing.T) {
	t.Setenv("FMGIT_PASSWORD", "pw-s3cret")
	t.Setenv("FMGIT_EAR_KEY", "ear-s3cret")
	_, err := out("false", "pw-s3cret", "-encryption_key", "ear-s3cret")
	if err == nil || strings.Contains(err.Error(), "s3cret") {
		t.Fatalf("secret leaked: %v", err)
	}
}
