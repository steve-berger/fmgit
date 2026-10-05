# GitHub

fmgit drives GitHub through the official **GitHub CLI** (`gh`). It handles
login, two-factor authentication and SSO for you.

::: warning Not yet tested against github.com
The GitHub path uses the same commands as the Forgejo path, which is tested end
to end, but it hasn't been run against github.com yet. Try it on a test
repository first.
:::

## 1. Install and log in

```sh
# macOS
brew install gh
# Windows
winget install GitHub.cli
# Linux: see https://github.com/cli/cli#installation

gh auth login
```

Every developer who opens, reviews or merges pull requests from fmgit needs
`gh` logged in. CI doesn't: it uses the workflow token.

## 2. Create the repository

```sh
cd invoices
gh repo create acme/invoices --private --source . --push
```

fmgit detects GitHub from the remote URL (`github.com`). To force it, set
`"forge": "github"` in `fmgit.json`.

## 3. Protect main

```sh
fmgit protect
```

| Setting | Value |
|---|---|
| repository: allow auto-merge | on |
| repository: delete head branches after merge | on |
| `main`: required status check | `fmgit` (strict: branch must be up to date) |
| `main`: required approving reviews | `approvals` from `fmgit.json` |
| dismiss stale reviews | on |

::: info Plans
Branch protection on **private** repositories needs GitHub Pro, Team or
Enterprise. On the free plan it only works for public repositories.
:::

## 4. CI

`fmgit init` writes `.github/workflows/fmgit.yml`. On every pull request it:

1. installs Go and fmgit,
2. runs `fmgit check` on the merge result, as the **`fmgit`** status check,
3. posts or updates a comment with the changed objects and the readable diff.

The workflow requests `pull-requests: write` for the comment. If your
organization restricts workflow permissions, allow it under
*Settings › Actions › General › Workflow permissions*.

Set the `go install` path in the workflow; see [CI workflow](/reference/ci).

## Day to day

```sh
fmgit pr                 # gh pr create + gh pr merge --auto --squash
fmgit approve 12         # gh pr review --approve
fmgit reject 12 -m "…"   # gh pr review --request-changes
fmgit merge 12 [-auto]   # gh pr merge --squash --delete-branch [--auto]
```

The *Pull requests* tab in `fmgit ui` reads pull requests through `gh` as well.
