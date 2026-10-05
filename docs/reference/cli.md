# CLI commands

```
fmgit <command> [flags] [arguments]
```

Flags and arguments can be mixed in any order (`fmgit patch main -o p.xml`
works). Every command except `init`, `help`, `textconv` and `render` looks for
`fmgit.json` in the current folder or any parent, and runs from that folder.

Commands that change something print what they did. Errors start with
`fmgit:` and exit with status 1; see [Troubleshooting](/guide/troubleshooting).

## Overview

| Command | Purpose |
|---|---|
| [`ui`](#ui) | web interface |
| [`init`](#init) | set up a project |
| [`start`](#start) | new branch from the latest main |
| [`save`](#save) | export + commit |
| [`snapshot`](#snapshot) | export without committing |
| [`diff`](#diff) | changed objects and readable diff |
| [`pr`](#pr) | push + open pull request + auto-merge |
| [`approve`](#approve) / [`reject`](#reject) | review a pull request |
| [`merge`](#merge) | merge now or arm auto-merge |
| [`protect`](#protect) | branch protection on the forge |
| [`pull`](#pull) | get merged work into your branch and file |
| [`apply`](#apply) | patch your file up to `HEAD` |
| [`patch`](#patch) | FMUpgradeTool patch between two commits |
| [`build`](#build) | reassemble the full XML |
| [`check`](#check) | validate `src/` |
| [`comment`](#comment) | post the diff on the current pull request (CI) |
| [`render`](#render) | HTML view of an object (Forgejo renderer) |
| [`textconv`](#textconv) | readable script text (git diff driver) |

---

## Daily work

### ui

```sh
fmgit ui [-port 7311] [-no-open]
```

Starts the [web UI](/guide/web-ui) on `127.0.0.1` and opens it in the browser.

| Flag | Default | Meaning |
|---|---|---|
| `-port` | random free port | port to listen on |
| `-no-open` | off | only print the link |

Runs until <kbd>Ctrl</kbd>+<kbd>C</kbd>.

### init

```sh
fmgit init [-file Invoices.fmp12] [-module github.com/acme/fmgit]
```

Sets up the current folder as an fmgit project. Safe to run again: existing
files are left alone.

1. `git init -b main`, if the folder isn't a git repository yet.
2. Writes `fmgit.json` with defaults. `file` is taken from `-file`, or from the
   only `.fmp12` in the folder.
3. Writes `.gitignore`, `.gitattributes`, `.github/workflows/fmgit.yml` and
   `.forgejo/workflows/fmgit.yml`.
4. Stages these files. The next `fmgit save` commits them.

| Flag | Meaning |
|---|---|
| `-file` | the `.fmp12` to track |
| `-module` | Go module path that CI uses to `go install` fmgit. Default: how this binary was installed; otherwise `CHANGE_ME/fmgit` and a note |

### start

```sh
fmgit start <branch>
```

Creates `<branch>` from the latest `main`. If there is a remote, it runs
`git fetch origin` and branches from `origin/main` (without tracking it).
Prints a hint if your file is now behind.

### save

```sh
fmgit save -m "message" [-xml export.xml]
```

Exports your file ([`snapshot`](#snapshot)), stages `src/`, commits, and
records that your file matches the new commit.

| Flag | Meaning |
|---|---|
| `-m` | commit message (required; may contain line breaks) |
| `-xml` | read this *Save a Copy as XML* file instead of exporting |

Refuses when a merge is in progress, or when your file is
[behind](/guide/syncing). Prints `nothing changed` if the export equals the
last commit. Other files you staged yourself are committed too.

### snapshot

```sh
fmgit snapshot [-xml export.xml]
```

Exports the file and rewrites `src/`, without committing. Use it to look at
changes with `fmgit diff` or `git status`.

How the XML is obtained, in this order:

1. `-xml <file>`,
2. `xml` in `fmgit.json`,
3. running `exportCmd` (FMDeveloperTool) into `build/export.xml`.

`src/` is deleted and rewritten every time; objects removed in FileMaker
disappear from `src/`. See [Repository layout](/reference/repository-layout).

### diff

```sh
fmgit diff [git range] [-md]
```

Lists changed FileMaker objects, then shows the full diff with script steps as
script text.

| Usage | Compares |
|---|---|
| `fmgit diff` | working tree (your last snapshot) vs. last commit, including new objects |
| `fmgit diff main` | working tree vs. `main` |
| `fmgit diff main...HEAD` | what your branch changed since it left `main` |
| `fmgit diff a1b2c3 d4e5f6` | between two commits |

```
  + Script             Send Reminder
  ~ Script steps       Create Invoice
  - Layout             Old Invoice
```

`+` added, `-` removed, `~` changed. `-md` prints the summary and diff as
markdown, the same text the CI comment uses.

### pr

```sh
fmgit pr [-no-auto]
```

1. Refuses on `main`, and when the branch has no commits that `origin/main`
   doesn't have.
2. Warns if `src/` has uncommitted changes.
3. `git push -u origin HEAD`.
4. Opens a pull request into `main` on GitHub or Forgejo. The title is the
   last commit message; the description lists the branch's commits. If one is
   already open for this branch, it's reused.
5. Arms **auto-merge** (squash, delete branch), unless `-no-auto` is given.

### pull

```sh
fmgit pull
```

Brings merged work into your branch **and** your file:

1. Refuses during a merge, or if your file is already behind.
2. Exports your file; refuses if that shows unsaved FileMaker work.
3. `git pull --no-rebase origin main`.
4. [`apply`](#apply).

Details: [Keeping your file in sync](/guide/syncing).

---

## Review

These commands work with GitHub (through `gh`) and Forgejo/Gitea (through
the API with `FMGIT_FORGE_TOKEN`); see [Hosting](/hosting/forgejo).

### approve

```sh
fmgit approve <number> [-m "comment"]
```

Submits an approving review.

### reject

```sh
fmgit reject <number> -m "what needs to change"
```

Submits a *request changes* review. `-m` is required.

### merge

```sh
fmgit merge <number> [-auto]
```

Squash-merges the pull request and deletes its branch. With `-auto`, it arms
auto-merge instead: the forge merges once approvals and checks are green.
Branch protection still applies to an immediate merge.

### protect

```sh
fmgit protect
```

Configures the forge so `main` only changes through approved, green pull
requests that can merge themselves. What exactly is set:
[Forgejo](/hosting/forgejo#what-fmgit-protect-sets-up) ·
[GitHub](/hosting/github#_3-protect-main). Needs admin rights on the repository.

---

## Plumbing

### apply

```sh
fmgit apply [-from <commit>] [-mark]
```

Patches your `.fmp12` from the commit it matches up to `HEAD`:

1. Builds `build/patch.xml` with [`patch`](#patch) logic.
2. Runs `upgradeCmd` (FMUpgradeTool) into `build/patched-<file>`.
3. Moves your file to `build/<name>.<timestamp>.backup.fmp12` and the patched
   file into its place.
4. Records `HEAD` as the commit your file matches.

| Flag | Meaning |
|---|---|
| `-from` | the commit your file matches (default: the recorded one) |
| `-mark` | don't patch; only record that your file matches `HEAD` |

If FMUpgradeTool isn't available, it stops after writing the patch.

### patch

```sh
fmgit patch [-o build/patch.xml] <from> [to]
```

Writes an FMUpgradeTool patch with every object that differs between `<from>`
and `<to>` (default `HEAD`). See [Patches](/reference/patches).

```sh
fmgit patch v1.4.0 main -o build/release-1.5.0.xml
```

### build

```sh
fmgit build [-o build/full.xml]
```

Reassembles the complete *Save a Copy as XML* document from `src/`. The result
is equivalent to the original export, apart from the
[normalized attributes](/reference/repository-layout#normalization).

### check

```sh
fmgit check
```

Validates `src/` and exits with status 1 if anything is wrong. Runs in CI on
every pull request. See [Consistency check](/reference/check).

```
✓ FileMaker sources are consistent
```

### comment

```sh
fmgit comment <git range>
```

For CI. Posts the changed objects and readable diff (same as `diff -md`) as a
comment on the pull request that triggered the run. It updates its own earlier
comment, recognised by an invisible `<!-- fmgit -->` marker, instead of adding
new ones.

Reads `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH` (set by
GitHub Actions and Forgejo Actions) and the token from `FMGIT_FORGE_TOKEN` or
`GITHUB_TOKEN`. Talks to `api.github.com` on GitHub, otherwise to
`<server>/api/v1`.

### render

```sh
fmgit render < src/StepsForScripts/Create\ Invoice.12.xml
```

Reads one object file on stdin and prints HTML: script steps as script text,
fields as a table, calculations as code, anything else as escaped XML. Used as
Forgejo's [external renderer](/hosting/forgejo#_6-readable-objects-in-forgejo-s-file-browser-optional).

### textconv

```sh
fmgit textconv <file>
```

Prints a script-steps file as script text (other files unchanged). git calls
it for readable diffs; `fmgit diff` and the web UI configure this
automatically, so you never need to run it yourself.

### help

```sh
fmgit help
```

Prints the command summary.
