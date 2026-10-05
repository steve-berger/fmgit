# Forgejo (self-hosted)

[Forgejo](https://forgejo.org) is a free, self-hosted git forge: repositories,
pull requests, reviews, branch protection, CI (Forgejo Actions) and user
management. It runs as a single binary or Docker container, on a small server
or next to FileMaker Server. It is the recommended home for fmgit projects when
code shouldn't leave your network.

fmgit works with **stock Forgejo**: no fork, no plug-in. It uses Forgejo's API
for pull requests and its extension points for the rest. Gitea works the same
way (same API).

::: info Tested
The complete flow on this page was tested against Forgejo 16.0.5: protect,
pull request, review, auto-merge, CI comment and renderer.
:::

## 1. Run Forgejo

Follow the [official installation guide](https://forgejo.org/docs/latest/admin/installation/).
The quickest way is Docker:

```sh
docker run -d --name forgejo -p 3000:3000 -p 2222:22 \
  -v forgejo-data:/data codeberg.org/forgejo/forgejo:latest
```

Open `http://<server>:3000`, finish the setup page and create the admin account.
For a team, put Forgejo behind HTTPS and set `ROOT_URL` accordingly.

## 2. Create users and the repository

1. Create accounts for every developer (*Site administration › User accounts*),
   or connect LDAP / OAuth.
2. Create an **organization** (e.g. `acme`) and a **team** with *write* access
   for the developers.
3. Create an empty repository `acme/invoices`. Don't add a README, so the
   first push from `fmgit init` goes through without conflicts.

## 3. Create access tokens

Each developer creates a personal token once:

*Avatar › Settings › Applications › Generate new token*

| Scope | Access | Needed for |
|---|---|---|
| **repository** | Read and write | pull requests, reviews, merging, branch protection |
| **issue** | Read and write | pull request comments and the timeline |

Store it in `FMGIT_FORGE_TOKEN`, or paste it in `fmgit ui` under
*Settings › Credentials* (memory only):

```sh
export FMGIT_FORGE_TOKEN='…'
```

Only the person who runs `fmgit protect` needs admin rights on the repository.

## 4. Connect the project

```sh
cd invoices
git remote add origin https://git.example.com/acme/invoices.git
git push -u origin main
fmgit protect
```

fmgit detects Forgejo from the remote: anything that isn't `github.com` is
treated as Forgejo/Gitea. The API address is derived from the remote URL
(`https://host` + `/api/v1`). If the web address differs from the git remote,
for example with SSH remotes on another host or port, set `forgeURL` in
`fmgit.json`:

```json
{ "forge": "forgejo", "forgeURL": "https://git.example.com" }
```

### What `fmgit protect` sets up

| Setting | Value |
|---|---|
| repository: delete branch after merge | on |
| repository: allow squash merge | on |
| branch protection on `main`: required approvals | `approvals` from `fmgit.json` |
| block merge on rejected reviews | on |
| dismiss stale approvals (new commits) | on |
| required status checks | `fmgit*` (matches *fmgit / fmgit (pull_request)*) |
| direct pushes to `main` | off: everything goes through pull requests |

![Branch protection in Forgejo](/img/forgejo-protection.png)

Running `protect` again updates the existing rule.

## 5. Enable Actions

CI runs the [`fmgit` check](/reference/check) and posts the readable diff on
every pull request. The workflow is `.forgejo/workflows/fmgit.yml`, written by
`fmgit init`.

1. Actions must be enabled on the instance (`[actions] ENABLED = true` in
   `app.ini`; the default in current versions) and in the repository
   (*Settings › Units › Actions*).
2. Register at least one runner with the label `docker`; see
   [Forgejo Runner installation](https://forgejo.org/docs/latest/admin/actions/runner-installation/).
   The job uses the standard `actions/checkout` and `actions/setup-go` actions.
3. Make sure the `go install` line in the workflow points at your fmgit
   repository; see [CI workflow](/reference/ci).

The job reports its result as the status check **`fmgit / fmgit (pull_request)`**.
Branch protection requires it, and auto-merge waits for it.

## 6. Readable objects in Forgejo's file browser (optional)

Forgejo can render files through an external command. With fmgit as the
renderer, script steps appear as script text and tables as field lists when
someone browses the repository in Forgejo:

![Forgejo shows a script as script text](/img/forgejo-script.png)

Install fmgit on the Forgejo server (on the `PATH` of the user running
Forgejo, or use the full path), add this to `app.ini`, and restart Forgejo:

```ini
[markup.filemaker]
ENABLED = true
FILE_EXTENSIONS = .xml
RENDER_COMMAND = "fmgit render"
IS_INPUT_FILE = false
```

- Forgejo shows a *source / rendered* toggle on every `.xml` file. Raw XML is
  one click away.
- Non-FileMaker `.xml` files are shown as escaped source, so nothing breaks.
- Forgejo sanitizes the HTML the renderer returns.

![Fields rendered in Forgejo](/img/forgejo-fields.png)

::: tip Diffs in Forgejo
Forgejo's *Files changed* tab always shows raw XML; renderers don't apply to
diffs. That's what the CI comment is for. It shows the readable diff right in
the conversation:

![Forgejo pull request with fmgit comment](/img/forgejo-pr.png)
:::

## Day to day

Everything in the [Daily workflow](/guide/daily-workflow) works against
Forgejo: `fmgit pr`, `approve`, `reject`, `merge` and the *Pull requests*
tab of `fmgit ui`. Reviewers can equally use Forgejo's own web UI.

## Backups

Back up Forgejo's data volume (repositories, database, configuration). With
fmgit, the repository is the complete history of your solution's schema.
