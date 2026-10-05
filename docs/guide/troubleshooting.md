# Troubleshooting

Each entry starts with the message fmgit prints, exactly as it appears.

## Exporting

### `export failed (is the file closed? is FMDeveloperTool on PATH or set in exportCmd?)`

FMDeveloperTool couldn't export the file. Check, in this order:

1. **The file is open** in FileMaker or hosted. Close it, or use an
   [XML export path](/guide/hosted-files).
2. **FMDeveloperTool isn't found.** Put its full path into `exportCmd[0]` in
   `fmgit.json`.
3. **Wrong password.** Set `FMGIT_PASSWORD` (or enter it in the web UI under
   *Settings › Credentials*) for the account in `fmgit.json`.
4. **Encrypted file.** See [Encrypted files](/guide/hosted-files#encrypted-files).

The tool's own output is printed below the message.

### `… is not a FileMaker "Save a Copy as XML" file`

The file you pointed fmgit at (`xml` setting or `-xml`) isn't a *Save a Copy as
XML* export. DDR exports and clipboard snippets (`fmxmlsnippet`) don't work.

### `set "file" in fmgit.json`

`fmgit init` couldn't guess your `.fmp12` (there were zero or several in the
folder). Set `"file"` in `fmgit.json`.

## Saving

### `your FileMaker file is behind <commit>, saving would undo those changes.`

Your branch contains changes your `.fmp12` doesn't have yet, for example after
`git pull` or switching branches. Close the file and run `fmgit apply`. If
you're sure the file is current (you applied a patch by hand), run
`fmgit apply -mark`. Background: [Keeping your file in sync](/guide/syncing).

### `` a merge is in progress: resolve conflicts in src/, run `git commit`, then `fmgit apply` ``

A `git merge` / `fmgit pull` stopped with conflicts. See
[Merge conflicts](/guide/conflicts).

### `nothing changed`

The export is identical to the last commit. Did you close the file, or run your
export script, after your last change in FileMaker?

## Pulling and applying

### `` your FileMaker file has changes that are not saved yet: run `fmgit save -m ...` first ``

`pull` found FileMaker work that isn't committed. Patching could overwrite it,
so save first.

### `unknown which commit your file matches: use -from <commit>, or -mark if it already matches HEAD`

There is no sync marker yet, usually in a fresh clone.
[Fresh clone](/guide/syncing#special-cases).

### `patch written to build/patch.xml, but FMUpgradeTool was not found.`

Install FMUpgradeTool or set its path in `upgradeCmd`. Or apply
`build/patch.xml` by hand, then `fmgit apply -mark`.

### `FMUpgradeTool failed (is the file closed?)`

Your file is unchanged and the patch is still in `build/patch.xml`. Close the
file in FileMaker and try again. FMUpgradeTool's output is shown above the
message; a *node ID conflicts* warning points to an
[id collision](/guide/conflicts#id-collisions).

### `could not move build/patched-… to …`

The patched file was created, but couldn't be put in place, usually because
the original is open (Windows locks open files). Both files are kept: the
message tells you where your original backup is.

## Pull requests

### `you are on "main"; start a branch first: fmgit start <name>`

Pull requests come from feature branches. `fmgit start <name>` (your
uncommitted changes in `src/` move along), then `fmgit save` and `fmgit pr`.

### `nothing to propose: <branch> has no commits that aren't on main yet (fmgit save first)`

The branch has nothing new. Save your work first.

### `set FMGIT_FORGE_TOKEN: create a token in Forgejo under Settings › Applications …`

fmgit talks to Forgejo with an access token. See
[Forgejo › tokens](/hosting/forgejo#_3-create-access-tokens).

### `` install the GitHub CLI (gh) and run `gh auth login` ``

For GitHub, fmgit uses the official CLI. Install it and log in once.

### `` no remote yet: add one with `git remote add origin <url>` ``

The repository has no `origin`. Create the repository on your forge and add
it.

### `auto-merge not enabled: …`

The pull request was opened, but the forge refused auto-merge. Common causes:
auto-merge isn't allowed on the repository (`fmgit protect` turns it on), or
the token lacks write access. Enable it later with `fmgit merge <n> -auto`.

## CI

### The `fmgit` check fails with `id … already used by …`

Two branches created different objects with the same id. See
[id collisions](/guide/conflicts#id-collisions).

### `go install CHANGE_ME/fmgit` fails in CI

`fmgit init` didn't know where fmgit is published. Edit both workflow files
and set the real module path; see [CI workflow](/reference/ci).

### No diff comment appears on the pull request

The comment step is allowed to fail (`continue-on-error`). Open the job log.
Usually the token has no write permission for comments: on GitHub, check
*Settings › Actions › Workflow permissions*; on Forgejo, pull requests from
forks only get a read-only token.

## Web UI

### The page says *Open the link from your terminal*

The UI needs the key from the link `fmgit ui` printed. Opening
`http://127.0.0.1:<port>/` on its own isn't enough. Copy the full link.

### *Another command is still running*

The UI runs one command at a time. Wait for the output panel to finish.

### `forbidden host`

Open the UI via `127.0.0.1` or `localhost` exactly as printed. Other host names
are rejected on purpose (protection against DNS rebinding).
