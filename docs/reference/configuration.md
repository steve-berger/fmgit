# Configuration

## fmgit.json

Project settings live in `fmgit.json` at the root of the project. Commit it so
the whole team shares the settings. It never contains passwords or tokens.
Keys you leave out use the defaults below. The web UI edits this file under
*Settings*.

```json
{
  "file": "Invoices.fmp12",
  "account": "Admin",
  "src": "src",
  "xml": "",
  "mainBranch": "main",
  "approvals": 1,
  "patchRoot": "FMUpgradeToolPatch",
  "forge": "",
  "forgeURL": "",
  "exportCmd": ["FMDeveloperTool", "--saveAsXML", "{file}", "{account}", "{password}", "-target_filename", "{out}", "-force"],
  "upgradeCmd": ["FMUpgradeTool", "--update", "-src_path", "{file}", "-dest_path", "{out}", "-patch_path", "{patch}", "-src_account", "{account}", "-src_pwd", "{password}"]
}
```

| Key | Default | Meaning |
|---|---|---|
| `file` | the only `.fmp12` at `init` | your local development file, relative to the project folder (git-ignored) |
| `files` | all `.fmp12` at `init` if there are several | a multi-file solution, e.g. `["UI.fmp12", "Data.fmp12"]`. Use instead of `file`; see below |
| `account` | `Admin` | FileMaker account with full access, used for export and patch |
| `src` | `src` | folder with the split objects. **Deleted and rewritten on every export**, so it must be a sub-folder; `.`, `..` and absolute paths are refused |
| `xml` | empty | read this *Save a Copy as XML* file instead of running `exportCmd`; see [Hosted & open files](/guide/hosted-files) |
| `mainBranch` | `main` | the shared branch pull requests go into |
| `approvals` | `1` | approvals `fmgit protect` requires on `mainBranch` |
| `patchRoot` | `FMUpgradeToolPatch` | root element of generated patches; see [Patches](/reference/patches) |
| `forge` | empty = detect | `github` or `forgejo` (also for Gitea). Empty: `github` if the remote is on github.com, otherwise `forgejo` |
| `forgeURL` | derived from the remote | Forgejo's web address if it differs from the remote host, e.g. `https://git.example.com` |
| `exportCmd` | FMDeveloperTool | command that writes the XML export |
| `upgradeCmd` | FMUpgradeTool | command that applies a patch |

### Multi-file solutions

A solution split over several files (UI file + data file, separation model, …)
goes into one repository. List the files under `files` instead of `file`:

```json
{ "files": ["UI.fmp12", "Data.fmp12"] }
```

Each file gets its own folder, named after the file: `src/UI/`, `src/Data/`.
Every command handles all files at once. `save` exports each one, `diff` and
pull requests label objects with their file (`Data · Script`), and `check`
validates each file on its own. `apply` and `patch` write one patch per file
(`build/UI.patch.xml`, `build/Data.patch.xml`) and only patch files that
changed. fmgit tracks separately which commit each file is synced to.

- `save -xml export.xml` reads the file name from the export and updates only
  that file's folder.
- With `xml` (hosted files), use a `{name}` placeholder: `"exports/{name}.xml"`.
- **Switching an existing single-file repo:** move `src/` into the first
  file's folder once. `fmgit save` prints the exact `git mv` commands. Then run
  `fmgit apply -mark`.

### Command templates

`exportCmd` and `upgradeCmd` are lists: the program first, then one entry per
argument. No shell is involved, so spaces in paths need no quoting. These
placeholders are replaced:

| Placeholder | Value |
|---|---|
| `{file}` | absolute path of `file` |
| `{account}` | `account` |
| `{password}` | `FMGIT_PASSWORD`, or the password entered in the web UI |
| `{earKey}` | `FMGIT_EAR_KEY` |
| `{out}` | output file fmgit expects (`build/export.xml`, or `build/patched-<file>`; `build/<name>.export.xml` with `files`) |
| `{patch}` | the patch file (`upgradeCmd` only) |

Examples:

```json
"exportCmd": ["/Users/steve/tools/FMDeveloperTool",
              "--saveAsXML", "{file}", "{account}", "{password}", "-target_filename", "{out}", "-force"]
```

```json
"exportCmd": ["FMDeveloperTool", "--saveAsXML", "{file}", "{account}", "{password}",
              "-target_filename", "{out}", "-force", "-encryption_key", "{earKey}"]
```

## Environment variables

| Variable | Used by | Meaning |
|---|---|---|
| `FMGIT_PASSWORD` | export, patch | password for `account` |
| `FMGIT_EAR_KEY` | export, patch | encryption-at-rest key (`{earKey}`) |
| `FMGIT_FORGE_TOKEN` | pull requests on Forgejo; `comment` in CI | Forgejo access token. In CI, set it from `secrets.GITHUB_TOKEN` |
| `GITHUB_TOKEN` | `comment` | fallback token in CI |
| `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH` | `comment` | set automatically by GitHub Actions and Forgejo Actions |
| `FMGIT_SAMPLES` | tests | comma-separated real exports to round-trip in `go test` |

In `fmgit ui`, the password and token can also be entered under
*Settings › Credentials*. They are kept in the memory of the running UI only.

## Files written by `fmgit init`

### .gitignore

```
*.fmp12
build/
```

`build/` holds exports, patches, patched files and backups.

### .gitattributes

```
# fmgit: FileMaker sources
src/** text eol=lf
src/**/_order.txt merge=union
src/*StepsForScripts/*.xml diff=fmgit
```

| Line | Why |
|---|---|
| `text eol=lf` | identical files on Windows, macOS and Linux; no line-ending noise |
| `merge=union` | two branches adding objects to the same catalog never conflict over the order |
| `diff=fmgit` | `git diff` / `fmgit diff` show script steps as script text |

::: tip Custom `src`
The attribute paths assume `src`. If you change `src`, update
`.gitattributes` to match.
:::

### Workflows

`.github/workflows/fmgit.yml` and `.forgejo/workflows/fmgit.yml`: see
[CI workflow](/reference/ci).

## Local state (not committed)

| Path | Meaning |
|---|---|
| `.git/fmgit-synced` | the commit your `.fmp12` matches ([sync marker](/guide/syncing)) |
| `.git/refs/fmgit/pr/<n>` | pull request heads fetched by the web UI for diffs |
| `build/` | exports, patches, patched files, backups |
