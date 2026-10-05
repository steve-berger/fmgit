# Keeping your file in sync

Git keeps `src/` up to date, but your **`.fmp12`** is a separate copy that only
FileMaker can change. fmgit keeps the two in step and refuses anything that
would silently lose work.

## The sync marker

fmgit remembers **which commit your FileMaker file matches**. It's stored
locally in `.git/fmgit-synced`, never committed. It is set when you:

| Action | Why the file now matches |
|---|---|
| `fmgit save` | the commit was exported from your file |
| `fmgit apply` / `fmgit pull` | the patch brought your file up to that commit |
| `fmgit apply -mark` | you say so (fresh clone, patch applied by hand) |

From that marker fmgit knows when your file is **behind**: `src/` at the
current commit contains changes your file doesn't have yet. That happens after
pulling, merging, or switching to a branch with different objects.

## Why fmgit refuses to save a file that's behind

Imagine Anna's change to the *Invoices* script was merged and you pulled it,
but your `.fmp12` still has the old script. If fmgit exported your file now, the
commit would contain the **old** script, which silently reverts Anna's work.

So `save` stops:

```
fmgit: your FileMaker file is behind 2a53b2c, saving would undo those changes.
close the file and run `fmgit apply` first
```

## Applying changes to your file

```sh
fmgit apply
```

1. fmgit compares `src/` at the marker with `src/` at `HEAD`.
2. It builds an [FMUpgradeTool patch](/reference/patches) with exactly those
   object changes: `build/patch.xml`.
3. It runs FMUpgradeTool, which writes a **new** patched file to
   `build/patched-Invoices.fmp12`.
4. It moves your current file to
   `build/Invoices.20261005-153012.backup.fmp12` and puts the patched file in
   its place.
5. It moves the marker to `HEAD`.

Your original file is never edited in place. If FMUpgradeTool fails, your file
is unchanged and the patch is still in `build/patch.xml`.

::: warning Close the file first
FMUpgradeTool needs exclusive access. Close the file in FileMaker before
`apply` or `pull`.
:::

### Without FMUpgradeTool

If FMUpgradeTool isn't installed (or `upgradeCmd` isn't set), `apply` stops
after step 2:

```
fmgit: patch written to build/patch.xml, but FMUpgradeTool was not found.
apply it with FMUpgradeTool (or set upgradeCmd in fmgit.json), then run `fmgit apply -mark`
```

Apply the patch yourself, then run `fmgit apply -mark`.

## pull = save check + git pull + apply

```sh
fmgit pull
```

1. Refuses during a merge, or if your file is already behind (run `apply`
   first).
2. Exports your file. If that shows **unsaved FileMaker work**, it stops:
   *"your FileMaker file has changes that are not saved yet: run
   `fmgit save -m ...` first"*. A patch could otherwise overwrite those
   changes.
3. Runs `git pull --no-rebase origin main`. On `main` this updates `main`; on a
   feature branch it merges the latest `main` into your branch.
4. Runs `apply`.

## Special cases

**Fresh clone.** There is no marker yet. Get a copy of the current development
file, then `fmgit apply -mark`. If your copy is older than `main`, use
`fmgit apply -from <commit-your-copy-matches>` instead; fmgit then patches it
forward.

**You know better.** `fmgit apply -from <commit>` patches from any commit you
name, ignoring the marker.

**Switching branches.** `git switch` / the branch picker only change `src/`.
If the other branch has different objects, fmgit tells you the file is behind.
Run `apply`, or switch back.
