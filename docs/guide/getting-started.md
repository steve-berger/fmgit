# Getting started

This page sets up a FileMaker solution for team work, from an existing
`.fmp12` to the first approved pull request. One person, usually the lead
developer, does the **team setup** once. Everybody else only does
[Join a project](#join-an-existing-project).

Allow about 15 minutes. You need fmgit [installed](/guide/installation) and a
git host: a [Forgejo](/hosting/forgejo) instance or [GitHub](/hosting/github).
Nothing online yet? Start with [Going online, step by step](/hosting/going-online).

## Team setup

### 1. Create the project folder

Put your development copy of the solution in a new, empty folder and run
`fmgit init` there:

```sh
mkdir invoices && cd invoices
cp ~/Desktop/Invoices.fmp12 .
fmgit init -file Invoices.fmp12
```

`init` creates:

| File | Purpose |
|---|---|
| `.git/` | a git repository, default branch `main` (if there wasn't one already) |
| `fmgit.json` | project settings: file, account, tool commands ([reference](/reference/configuration)) |
| `.gitignore` | keeps `*.fmp12` and `build/` out of git |
| `.gitattributes` | line endings, the union merge for object order, readable script diffs |
| `.github/workflows/fmgit.yml` | CI for GitHub Actions |
| `.forgejo/workflows/fmgit.yml` | the same CI for Forgejo Actions |

::: warning The CI install line
The workflows install fmgit in CI with `go install <path>`. `init` fills in the
path from how your fmgit binary was installed, or from `-module`. If it prints
*note: edit .github/workflows/fmgit.yml …*, open both workflow files and
replace `CHANGE_ME/fmgit` with the real module path of your fmgit repository.
:::

### 2. First import

```sh
export FMGIT_PASSWORD='your full-access password'
fmgit save -m "Import Invoices solution"
```

fmgit exports the file with FMDeveloperTool, splits it into `src/` and commits
everything:

```
exported 170 FileMaker objects to src/
saved 4d4ce2f
```

::: tip The file must be closed
FMDeveloperTool can't read a file that is open in FileMaker. Close it first,
or use an [XML export path](/guide/hosted-files).
:::

### 3. Create the shared repository

::: code-group

```sh [Forgejo]
# create an empty repository "invoices" in the Forgejo web UI, then:
git remote add origin https://git.example.com/acme/invoices.git
git push -u origin main
export FMGIT_FORGE_TOKEN='…'   # Settings › Applications in Forgejo
```

```sh [GitHub]
gh repo create acme/invoices --private --source . --push
```

:::

### 4. Protect main

```sh
fmgit protect
```

```
main on Forgejo now needs 1 approval(s) and a green fmgit check; PRs merge automatically after that
```

From now on nobody can push to `main` directly. Every change goes through a
pull request that needs an approval and a green `fmgit` check. The number of
approvals comes from `approvals` in `fmgit.json`.

### 5. Make sure CI runs

- **Forgejo:** Actions must be enabled and a runner registered; see
  [Forgejo › Actions](/hosting/forgejo#_5-enable-actions).
- **GitHub:** nothing to do. GitHub Actions picks up `.github/workflows/fmgit.yml`.

## Join an existing project

Every other developer:

```sh
git clone https://git.example.com/acme/invoices.git
cd invoices
# get a copy of the current development file, e.g. from the lead or the server
cp /path/to/Invoices.fmp12 .
fmgit apply -mark        # "my file matches what's in git right now"
```

`apply -mark` records which commit your file matches. fmgit uses that record to
keep your file and the repository in step; see
[Keeping your file in sync](/guide/syncing).

## Your first pull request

```sh
fmgit start invoice-tax          # new branch from the latest main
# … change a script and add a field in FileMaker, then close the file …
fmgit diff                       # what changed, in FileMaker terms
fmgit save -m "Invoices: add tax field and calculation"
fmgit pr                         # push + pull request + auto-merge armed
```

```
pull request #12 on Forgejo
auto-merge enabled: it merges once approved and green
```

A teammate reviews it, in the forge or in `fmgit ui`, and approves:

```sh
fmgit approve 12 -m "Looks good"
```

As soon as CI is green, the forge merges the pull request. Everybody else runs
`fmgit pull` to bring the change into their own file.

Prefer clicking? Run `fmgit ui` and do all of the above in the browser; see
[The web UI](/guide/web-ui).
