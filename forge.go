package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// A forge hosts the shared repo and does pull requests, reviews and merges.
// GitHub goes through the gh CLI (it handles login), Forgejo through its REST API.
// Both return pull requests in gh's JSON shape so the UI needs no branches.
type forge interface {
	Name() string
	CreatePR(branch, base, title, body string) (int, error)
	Merge(n int, auto bool) error
	Review(n int, approve bool, body string) error
	Protect(branch string, approvals int) error
	ListPRs(state string) ([]map[string]any, error)
	ViewPR(n int) (map[string]any, error)
}

func remoteURL() string { return gitq("remote", "get-url", "origin") }

func forgeKind() string {
	switch {
	case cfg.Forge != "":
		return cfg.Forge
	case remoteURL() == "":
		return ""
	case strings.Contains(remoteURL(), "github.com"):
		return "github"
	}
	return "forgejo" // also Gitea: same API
}

func newForge() (forge, error) {
	switch forgeKind() {
	case "github":
		if !found("gh") {
			return nil, errors.New("install the GitHub CLI (gh) and run `gh auth login`")
		}
		return ghForge{}, nil
	case "forgejo":
		return newForgejo()
	}
	return nil, errors.New("no remote yet: add one with `git remote add origin <url>`")
}

func mustForge() forge {
	f, err := newForge()
	must(err)
	return f
}

// webBase and repo path from https://host/o/r(.git), ssh://git@host:22/o/r.git or git@host:o/r.git.
func parseRemote(u string) (base, owner, repo string, err error) {
	var host, p string
	if pu, e := url.Parse(u); e == nil && pu.Host != "" {
		host, p = pu.Host, pu.Path
		if pu.Scheme == "http" || pu.Scheme == "https" {
			base = pu.Scheme + "://" + host
		} else {
			base = "https://" + pu.Hostname()
		}
	} else if at := strings.Index(u, "@"); at >= 0 && strings.Contains(u, ":") {
		rest := u[at+1:]
		host, p = rest[:strings.Index(rest, ":")], rest[strings.Index(rest, ":")+1:]
		base = "https://" + host
	} else {
		return "", "", "", fmt.Errorf("can't read the remote URL %q", u)
	}
	parts := strings.Split(strings.Trim(strings.TrimSuffix(p, ".git"), "/"), "/")
	if len(parts) < 2 {
		return "", "", "", fmt.Errorf("can't find owner/repo in %q", u)
	}
	return base, parts[len(parts)-2], parts[len(parts)-1], nil
}

// ---------------- GitHub (gh) ----------------

type ghForge struct{}

func (ghForge) Name() string { return "GitHub" }

func (ghForge) CreatePR(branch, base, title, body string) (int, error) {
	if s, err := out("gh", "pr", "view", branch, "--json", "number", "-q", ".number"); err == nil {
		return atoi(strings.TrimSpace(s)), nil
	}
	if _, err := out("gh", "pr", "create", "--head", branch, "--base", base, "--title", title, "--body", body); err != nil {
		return 0, err
	}
	s, err := out("gh", "pr", "view", branch, "--json", "number", "-q", ".number")
	return atoi(strings.TrimSpace(s)), err
}

func (ghForge) Merge(n int, auto bool) error {
	args := []string{"pr", "merge", fmt.Sprint(n), "--squash", "--delete-branch"}
	if auto {
		args = append(args, "--auto")
	}
	_, err := out("gh", args...)
	return err
}

func (ghForge) Review(n int, approve bool, body string) error {
	ev := "--approve"
	if !approve {
		ev = "--request-changes"
	}
	_, err := out("gh", "pr", "review", fmt.Sprint(n), ev, "--body", body)
	return err
}

func (ghForge) Protect(branch string, approvals int) error {
	if _, err := out("gh", "repo", "edit", "--enable-auto-merge", "--delete-branch-on-merge"); err != nil {
		return err
	}
	rule := fmt.Sprintf(`{"required_status_checks":{"strict":true,"contexts":["fmgit"]},"enforce_admins":false,`+
		`"required_pull_request_reviews":{"required_approving_review_count":%d,"dismiss_stale_reviews":true},"restrictions":null}`, approvals)
	c := exec.Command("gh", "api", "-X", "PUT", "repos/{owner}/{repo}/branches/"+branch+"/protection", "--input", "-", "--silent")
	c.Stdin = strings.NewReader(rule)
	if b, err := c.CombinedOutput(); err != nil {
		return fmt.Errorf("%v: %s", err, b)
	}
	return nil
}

func ghJSON(args ...string) (any, error) {
	s, err := out("gh", args...)
	if err != nil {
		return nil, err
	}
	var v any
	return v, json.Unmarshal([]byte(s), &v)
}

func (ghForge) ListPRs(state string) ([]map[string]any, error) {
	v, err := ghJSON("pr", "list", "--state", state, "--limit", "60", "--json",
		"number,title,author,headRefName,baseRefName,reviewDecision,isDraft,url,updatedAt,createdAt,autoMergeRequest,statusCheckRollup,state")
	if err != nil {
		return nil, err
	}
	var res []map[string]any
	for _, x := range v.([]any) {
		res = append(res, x.(map[string]any))
	}
	return res, nil
}

func (ghForge) ViewPR(n int) (map[string]any, error) {
	v, err := ghJSON("pr", "view", fmt.Sprint(n), "--json",
		"number,title,body,author,state,url,headRefName,baseRefName,reviewDecision,reviews,statusCheckRollup,autoMergeRequest,isDraft,createdAt,updatedAt,mergedAt,comments,commits")
	if err != nil {
		return nil, err
	}
	return v.(map[string]any), nil
}

// ---------------- Forgejo / Gitea (REST) ----------------

type rest struct{ api, token string }

func (r rest) do(method, path string, body, res any) error {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, r.api+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "token "+r.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		var e struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(b, &e)
		if e.Message == "" {
			e.Message = strings.TrimSpace(string(b))
		}
		return fmt.Errorf("%s %s: %d %s", method, path, resp.StatusCode, e.Message)
	}
	if res != nil && len(b) > 0 {
		return json.Unmarshal(b, res)
	}
	return nil
}

type forgejo struct {
	rest
	web, repo string // repo = /repos/owner/name
}

func newForgejo() (*forgejo, error) {
	base, owner, name, err := parseRemote(remoteURL())
	if err != nil {
		return nil, err
	}
	if cfg.ForgeURL != "" {
		base = strings.TrimRight(cfg.ForgeURL, "/")
	}
	tok := os.Getenv("FMGIT_FORGE_TOKEN")
	if tok == "" {
		return nil, fmt.Errorf("set FMGIT_FORGE_TOKEN: create a token in Forgejo under Settings › Applications (scopes: repository and issue, read & write) at %s", base)
	}
	return &forgejo{rest{base + "/api/v1", tok}, base, "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(name)}, nil
}

func (f *forgejo) Name() string { return "Forgejo" }

type fjPR struct {
	Number   int    `json:"number"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	State    string `json:"state"`
	Merged   bool   `json:"merged"`
	MergedAt string `json:"merged_at"`
	HTMLURL  string `json:"html_url"`
	Created  string `json:"created_at"`
	Updated  string `json:"updated_at"`
	Draft    bool   `json:"draft"`
	User     struct {
		Login string `json:"login"`
	} `json:"user"`
	Head struct {
		Ref   string `json:"ref"`
		Label string `json:"label"`
		Sha   string `json:"sha"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

func (f *forgejo) CreatePR(branch, base, title, body string) (int, error) {
	var open []fjPR
	if err := f.do("GET", f.repo+"/pulls?state=open&limit=50", nil, &open); err != nil {
		return 0, err
	}
	for _, p := range open {
		if p.Head.Ref == branch {
			return p.Number, nil
		}
	}
	var p fjPR
	err := f.do("POST", f.repo+"/pulls", map[string]string{"head": branch, "base": base, "title": title, "body": body}, &p)
	return p.Number, err
}

func (f *forgejo) Merge(n int, auto bool) error {
	return f.do("POST", fmt.Sprintf("%s/pulls/%d/merge", f.repo, n), map[string]any{
		"Do": "squash", "merge_when_checks_succeed": auto, "delete_branch_after_merge": true}, nil)
}

func (f *forgejo) Review(n int, approve bool, body string) error {
	ev := "APPROVED"
	if !approve {
		ev = "REQUEST_CHANGES"
	}
	return f.do("POST", fmt.Sprintf("%s/pulls/%d/reviews", f.repo, n), map[string]string{"event": ev, "body": body}, nil)
}

func (f *forgejo) Protect(branch string, approvals int) error {
	if err := f.do("PATCH", f.repo, map[string]any{"default_delete_branch_after_merge": true, "allow_squash_merge": true}, nil); err != nil {
		return err
	}
	rule := map[string]any{
		"rule_name": branch, "required_approvals": approvals, "block_on_rejected_reviews": true, "dismiss_stale_approvals": true,
		// Forgejo Actions reports "fmgit / fmgit (pull_request)"; contexts are glob patterns
		"enable_status_check": true, "status_check_contexts": []string{"fmgit*"},
		"enable_push": false, // everything goes through pull requests
	}
	err := f.do("POST", f.repo+"/branch_protections", rule, nil)
	if err != nil && (strings.Contains(err.Error(), " 409 ") || strings.Contains(err.Error(), " 422 ") || strings.Contains(err.Error(), " 403 ")) {
		err = f.do("PATCH", f.repo+"/branch_protections/"+url.PathEscape(branch), rule, nil)
	}
	return err
}

type fjReview struct {
	State     string `json:"state"`
	Body      string `json:"body"`
	Submitted string `json:"submitted_at"`
	Dismissed bool   `json:"dismissed"`
	Stale     bool   `json:"stale"`
	User      struct {
		Login string `json:"login"`
	} `json:"user"`
}

type fjStatus struct {
	State    string `json:"state"`
	Statuses []struct {
		Context   string `json:"context"`
		Status    string `json:"status"`
		TargetURL string `json:"target_url"`
	} `json:"statuses"`
}

// ghShape converts a Forgejo pull request into gh's JSON so one UI serves both forges.
func (f *forgejo) ghShape(p fjPR, full bool) map[string]any {
	state := "OPEN"
	if p.Merged {
		state = "MERGED"
	} else if p.State == "closed" {
		state = "CLOSED"
	}
	head := p.Head.Ref
	if strings.HasPrefix(head, "refs/") && p.Head.Label != "" { // branch deleted after merge
		head = p.Head.Label
	}
	m := map[string]any{
		"number": p.Number, "title": p.Title, "body": p.Body, "author": map[string]any{"login": p.User.Login},
		"headRefName": head, "baseRefName": p.Base.Ref, "state": state, "url": p.HTMLURL,
		"createdAt": p.Created, "updatedAt": p.Updated, "mergedAt": p.MergedAt, "autoMergeRequest": nil,
		"isDraft": p.Draft || strings.HasPrefix(strings.ToUpper(p.Title), "WIP:"),
	}
	var wg sync.WaitGroup
	var reviews []fjReview
	var st fjStatus
	var comments []struct {
		Body    string `json:"body"`
		Created string `json:"created_at"`
		User    struct {
			Login string `json:"login"`
		} `json:"user"`
	}
	var timeline []struct {
		Type string `json:"type"`
	}
	wg.Add(2)
	go func() {
		defer wg.Done()
		_ = f.do("GET", fmt.Sprintf("%s/pulls/%d/reviews", f.repo, p.Number), nil, &reviews)
	}()
	go func() {
		defer wg.Done()
		_ = f.do("GET", fmt.Sprintf("%s/commits/%s/status", f.repo, p.Head.Sha), nil, &st)
	}()
	if full {
		wg.Add(2)
		go func() {
			defer wg.Done()
			_ = f.do("GET", fmt.Sprintf("%s/issues/%d/comments", f.repo, p.Number), nil, &comments)
		}()
		go func() {
			defer wg.Done()
			_ = f.do("GET", fmt.Sprintf("%s/issues/%d/timeline?limit=100", f.repo, p.Number), nil, &timeline)
		}()
	}
	wg.Wait()

	// latest verdict per reviewer decides, like GitHub's reviewDecision
	latest := map[string]string{}
	var rv []map[string]any
	for _, r := range reviews {
		st := map[string]string{"REQUEST_CHANGES": "CHANGES_REQUESTED", "COMMENT": "COMMENTED"}[r.State]
		if st == "" {
			st = r.State
		}
		if r.State == "PENDING" || r.State == "REQUEST_REVIEW" {
			continue
		}
		if r.Dismissed {
			st = "DISMISSED"
		} else if st == "APPROVED" || st == "CHANGES_REQUESTED" {
			latest[r.User.Login] = st
		}
		rv = append(rv, map[string]any{"author": map[string]any{"login": r.User.Login}, "state": st, "body": r.Body, "submittedAt": r.Submitted})
	}
	approved, rejected := 0, false
	for _, s := range latest {
		approved += map[bool]int{true: 1}[s == "APPROVED"]
		rejected = rejected || s == "CHANGES_REQUESTED"
	}
	switch {
	case rejected:
		m["reviewDecision"] = "CHANGES_REQUESTED"
	case approved >= max(cfg.Approvals, 1):
		m["reviewDecision"] = "APPROVED"
	default:
		m["reviewDecision"] = "REVIEW_REQUIRED"
	}
	var checks []map[string]any
	for _, s := range st.Statuses {
		c := map[string]any{"name": s.Context, "detailsUrl": s.TargetURL, "status": "COMPLETED"}
		switch s.Status {
		case "success":
			c["conclusion"] = "SUCCESS"
		case "pending":
			c["status"], c["conclusion"] = "IN_PROGRESS", ""
		case "warning":
			c["conclusion"] = "NEUTRAL"
		default:
			c["conclusion"] = "FAILURE"
		}
		checks = append(checks, c)
	}
	m["statusCheckRollup"] = checks
	if full {
		m["reviews"] = rv
		var cs []map[string]any
		for _, c := range comments {
			cs = append(cs, map[string]any{"author": map[string]any{"login": c.User.Login}, "body": c.Body, "createdAt": c.Created})
		}
		m["comments"] = cs
		for _, t := range timeline { // the last scheduling event wins
			switch t.Type {
			case "pull_scheduled_merge":
				m["autoMergeRequest"] = map[string]any{"mergeMethod": "SQUASH"}
			case "pull_cancel_scheduled_merge", "merge_pull":
				m["autoMergeRequest"] = nil
			}
		}
	}
	return m
}

func (f *forgejo) ListPRs(state string) ([]map[string]any, error) {
	s := map[string]string{"open": "open", "closed": "closed", "merged": "closed"}[state]
	if s == "" {
		s = "all"
	}
	var ps []fjPR
	if err := f.do("GET", f.repo+"/pulls?sort=recentupdate&limit=50&state="+s, nil, &ps); err != nil {
		return nil, err
	}
	var keep []fjPR
	for _, p := range ps {
		if (state == "merged" && !p.Merged) || (state == "closed" && p.Merged) {
			continue
		}
		keep = append(keep, p)
	}
	res := make([]map[string]any, len(keep))
	var wg sync.WaitGroup
	for i, p := range keep {
		wg.Add(1)
		go func() { defer wg.Done(); res[i] = f.ghShape(p, false) }()
	}
	wg.Wait()
	return res, nil
}

func (f *forgejo) ViewPR(n int) (map[string]any, error) {
	var p fjPR
	if err := f.do("GET", fmt.Sprintf("%s/pulls/%d", f.repo, n), nil, &p); err != nil {
		return nil, err
	}
	return f.ghShape(p, true), nil
}

// ---------------- commands ----------------

func currentBranch() string {
	b := gitq("branch", "--show-current")
	if b == "" || b == cfg.Main {
		die("you are on %q; start a branch first: fmgit start <name>", cfg.Main)
	}
	return b
}

func prNumber(s string) int {
	if !digits.MatchString(s) {
		die("%q is not a pull request number", s)
	}
	return atoi(s)
}

func cmdPR(args []string) {
	fs := flag.NewFlagSet("pr", flag.ExitOnError)
	noAuto := fs.Bool("no-auto", false, "don't enable auto-merge")
	parse(fs, args)
	b := currentBranch()
	f := mustForge()
	if _, err := out("git", "diff", "--quiet", "HEAD", "--", cfg.Src); err != nil {
		fmt.Println("warning: src/ has uncommitted changes, did you forget `fmgit save`?")
	}
	base := cfg.Main
	_, _ = out("git", "fetch", "-q", "origin", base)
	if gitq("rev-list", "--count", "origin/"+base+"..HEAD") == "0" {
		die("nothing to propose: %s has no commits that aren't on %s yet (fmgit save first)", b, base)
	}
	must(run("git", "push", "-u", "origin", "HEAD"))
	title := gitq("log", "-1", "--format=%s")
	body := gitq("log", "--reverse", "--format=- %s", "origin/"+base+"..HEAD")
	n, err := f.CreatePR(b, base, title, body)
	must(err)
	fmt.Printf("pull request #%d on %s\n", n, f.Name())
	if !*noAuto {
		// merges by itself once approvals and the fmgit check pass (see fmgit protect)
		if err := f.Merge(n, true); err != nil {
			fmt.Println("auto-merge not enabled:", err)
		} else {
			fmt.Println("auto-merge enabled: it merges once approved and green")
		}
	}
}

func cmdApprove(args []string) {
	fs := flag.NewFlagSet("approve", flag.ExitOnError)
	msg := fs.String("m", "", "comment")
	pos := parse(fs, args)
	if len(pos) != 1 {
		die("usage: fmgit approve <pr>")
	}
	must(mustForge().Review(prNumber(pos[0]), true, *msg))
	fmt.Println("approved #" + pos[0])
}

func cmdReject(args []string) {
	fs := flag.NewFlagSet("reject", flag.ExitOnError)
	msg := fs.String("m", "", "what needs to change (required)")
	pos := parse(fs, args)
	if len(pos) != 1 || *msg == "" {
		die("usage: fmgit reject <pr> -m \"what needs to change\"")
	}
	must(mustForge().Review(prNumber(pos[0]), false, *msg))
	fmt.Println("requested changes on #" + pos[0])
}

func cmdMerge(args []string) {
	fs := flag.NewFlagSet("merge", flag.ExitOnError)
	auto := fs.Bool("auto", false, "merge as soon as approvals and checks pass")
	pos := parse(fs, args)
	if len(pos) != 1 {
		die("usage: fmgit merge <pr> [-auto]")
	}
	must(mustForge().Merge(prNumber(pos[0]), *auto))
	if *auto {
		fmt.Println("auto-merge enabled for #" + pos[0])
	} else {
		fmt.Println("merged #" + pos[0])
	}
}

func cmdProtect(args []string) {
	parse(flag.NewFlagSet("protect", flag.ExitOnError), args)
	f := mustForge()
	must(f.Protect(cfg.Main, cfg.Approvals))
	fmt.Printf("%s on %s now needs %d approval(s) and a green fmgit check; PRs merge automatically after that\n", cfg.Main, f.Name(), cfg.Approvals)
}

// cmdComment runs in CI (GitHub Actions or Forgejo Actions): it posts the
// FileMaker diff on the pull request, updating its earlier comment.
func cmdComment(args []string) {
	rng := parse(flag.NewFlagSet("comment", flag.ExitOnError), args)
	body, err := diffMarkdown(rng)
	must(err)
	const marker = "<!-- fmgit -->"
	body = marker + "\n" + body
	server, repo := os.Getenv("GITHUB_SERVER_URL"), os.Getenv("GITHUB_REPOSITORY")
	tok := cmp.Or(os.Getenv("FMGIT_FORGE_TOKEN"), os.Getenv("GITHUB_TOKEN"))
	var ev struct {
		Number      int `json:"number"`
		PullRequest struct {
			Number int `json:"number"`
		} `json:"pull_request"`
	}
	if b, err := os.ReadFile(os.Getenv("GITHUB_EVENT_PATH")); err == nil {
		_ = json.Unmarshal(b, &ev)
	}
	n := cmp.Or(ev.PullRequest.Number, ev.Number)
	if server == "" || repo == "" || tok == "" || n == 0 {
		die("fmgit comment runs in CI: needs GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_EVENT_PATH of a pull request and FMGIT_FORGE_TOKEN")
	}
	api := strings.TrimRight(server, "/") + "/api/v1"
	if strings.Contains(server, "github.com") {
		api = "https://api.github.com"
	}
	r := rest{api, tok}
	var cs []struct {
		ID   int64  `json:"id"`
		Body string `json:"body"`
	}
	must(r.do("GET", fmt.Sprintf("/repos/%s/issues/%d/comments?per_page=100&limit=50", repo, n), nil, &cs))
	for _, c := range cs {
		if strings.HasPrefix(c.Body, marker) {
			must(r.do("PATCH", fmt.Sprintf("/repos/%s/issues/comments/%d", repo, c.ID), map[string]string{"body": body}, nil))
			fmt.Println("updated FileMaker diff comment")
			return
		}
	}
	must(r.do("POST", fmt.Sprintf("/repos/%s/issues/%d/comments", repo, n), map[string]string{"body": body}, nil))
	fmt.Println("posted FileMaker diff comment")
}

// cmdRender is a Forgejo/Gitea external renderer: object XML on stdin, HTML on stdout.
// app.ini: [markup.filemaker] ENABLED=true FILE_EXTENSIONS=.xml RENDER_COMMAND="fmgit render" IS_INPUT_FILE=false
func cmdRender(args []string) {
	raw, err := io.ReadAll(os.Stdin)
	must(err)
	pt := describe("", "", raw)
	e := html.EscapeString
	switch pt.Kind {
	case "fields":
		fmt.Println("<table><thead><tr><th>Field</th><th>Type</th><th>Options</th><th>Calculation / comment</th></tr></thead><tbody>")
		for _, f := range pt.Fields {
			var opts []string
			for _, o := range []struct {
				on   bool
				name string
			}{{f.Global, "global"}, {f.Required, "required"}, {f.Unique, "unique"}, {f.AutoEnter != "", "auto-enter: " + f.AutoEnter}} {
				if o.on {
					opts = append(opts, o.name)
				}
			}
			fmt.Printf("<tr><td><strong>%s</strong></td><td><code>%s</code></td><td>%s</td><td>%s%s</td></tr>\n", e(f.Name), e(f.Type),
				e(strings.Join(opts, ", ")), e(f.Comment), map[bool]string{true: "<pre><code>" + e(f.Calc) + "</code></pre>"}[f.Calc != ""])
		}
		fmt.Println("</tbody></table>")
	case "script", "calc":
		fmt.Printf("<pre><code>%s</code></pre>\n", e(pt.Text))
	default:
		fmt.Printf("<pre><code>%s</code></pre>\n", e(pt.XML))
	}
}
