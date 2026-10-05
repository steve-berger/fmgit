# FAQ

## Is the `.fmp12` stored in git?

No. `*.fmp12` is git-ignored. The XML in `src/` is the shared source of
truth, and every developer has their own local copy of the file. Binary files
can't be diffed or merged, and storing a 2 GB file on every commit would make
the repository unusable.

## How do new team members get a file?

Copy the current development file from a teammate or the server, then
`fmgit apply -mark` (or `-from <commit>` if the copy is older).
See [Join an existing project](/guide/getting-started#join-an-existing-project).

## Which FileMaker versions work?

FileMaker 2024 (21) and later, which have *Save a Copy as XML* and
FMDeveloperTool `--saveAsXML`. fmgit was tested with exports from FileMaker
21.1 (XML grammar 2.2.2.0).

## Do I have to use the terminal?

No. `fmgit ui` covers saving, diffs, branches, pull requests, reviews and
settings. The terminal commands are there for people who prefer them, and for
CI.

## Forgejo or GitHub?

Both work the same way. Choose **Forgejo** if the code must stay on your
servers or you want no per-user costs; it's one binary or one Docker container.
Choose **GitHub** if your team already lives there. Branch protection on
private GitHub repositories needs a paid plan. See [Hosting](/hosting/forgejo).

## Why not just commit the XML from *Save a Copy as XML*?

Teams try that first. One huge XML file conflicts on every parallel change,
and every save changes thousands of lines (counters, timestamps, step indexes)
that mean nothing. fmgit splits the file per object, removes that noise, and
makes object order mergeable. See
[Repository layout](/reference/repository-layout).

## Does fmgit change my FileMaker file?

Only `fmgit apply` / `pull`, and only through FMUpgradeTool writing a **new**
file. The previous file is always kept in `build/` as a backup.

## Are passwords stored anywhere?

No. fmgit removes all `INSECURE_PASSWORD` content (account passwords and the
auto-login password) from the export before writing `src/`. Credentials come
from environment variables or the web UI and are kept in memory only. See
[Security](/reference/security).

## Can it version records / data?

No, only schema. Use FileMaker's own import or migration tools for data.

## Known limits

- **Applying patches** with FMUpgradeTool hasn't been tested yet. Patches follow
  FileMaker's own export grammar. Try them on a copy; if your FMUpgradeTool
  expects a different root element, change `patchRoot`.
- **Accounts** are versioned (names, privilege sets) but **not patched**, because
  their passwords are stripped.
- **Layouts** that two people change at the same time are real conflicts; take
  one side and redo the other.
- **The file must be closed** for FMDeveloperTool and FMUpgradeTool, or use an
  [XML export path](/guide/hosted-files).
- **GitHub** pull-request commands go through `gh`; they haven't been run
  against github.com yet. The same flow is tested end to end on Forgejo 16.
