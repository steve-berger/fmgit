# Daily workflow

The loop every developer runs, in the terminal or in the [web UI](/guide/web-ui).

```
fmgit pull  →  fmgit start  →  work in FileMaker  →  fmgit save  →  fmgit pr  →  review  →  merge
```

## 1. Start from the latest state

```sh
fmgit pull
```

`pull` brings `main` into your current branch and patches your `.fmp12` with
everything teammates merged since your last sync. A backup of the previous file
is kept in `build/`. If you have FileMaker work that isn't saved yet, `pull`
stops and asks you to save first, so it never overwrites your work.

## 2. Start a branch

```sh
fmgit start invoice-numbering
```

This fetches `origin` and creates the branch from `origin/main`. One branch per
feature or fix keeps pull requests small and easy to review.

If `main` moved since your last sync, fmgit says so:

```
your FileMaker file is behind this branch: close it and run `fmgit apply`
```

## 3. Work in FileMaker

Work as usual: edit scripts, add fields, change layouts. fmgit isn't involved
while you work.

## 4. See what changed

Close the file (or update your XML export), then:

```sh
fmgit diff
```

```
  ~ Script steps       UploadHTML
  ~ Fields of table    Invoices

diff --git a/src/StepsForScripts/UploadHTML.2.xml b/src/StepsForScripts/UploadHTML.2.xml
@@ -1,6 +1,6 @@
 Script: UploadHTML
 # Author: Joakim Isaksen
-Set Error Capture [ Off ]
+Set Error Capture [ On ]
```

The first block lists changed objects: `+` added, `-` removed, `~` changed.
Below it is the full diff, with script steps shown as script text.

`fmgit diff` compares against the last commit. To compare other states, pass a
git range: `fmgit diff main`, `fmgit diff main...HEAD`, `fmgit diff HEAD~3`.

## 5. Save (commit)

```sh
fmgit save -m "Invoices: number invoices per year"
```

`save` exports the file again, so you always commit exactly what's in
FileMaker, then commits the changes in `src/`. It refuses when:

- your file is **behind** the branch: saving would undo merged work. Run
  `fmgit apply` first.
- a **merge is in progress**: finish it first; see [Merge conflicts](/guide/conflicts).

Save as often as you like. Small commits with clear messages make reviews
easier.

## 6. Open a pull request

```sh
fmgit pr
```

`pr` checks the branch has commits that `main` doesn't, pushes it, opens a pull
request and arms **auto-merge**:

- Title: your last commit message.
- Description: the list of commits on the branch.

Use `fmgit pr -no-auto` if you want to merge by hand later. Running `pr` again
after more saves pushes the new commits to the same pull request.

## 7. Review and merge

A teammate reviews the pull request ([how](/guide/reviewing)) and approves it.
With auto-merge armed and the `fmgit` check green, the forge squash-merges the
branch into `main` and deletes it.

## 8. Back to the start

```sh
fmgit pull
```

Your file now contains the merged result, including everybody else's work.

## Cheat sheet

| I want to… | Command |
|---|---|
| see what changed since my last commit | `fmgit diff` |
| commit my FileMaker work | `fmgit save -m "…"` |
| export without committing | `fmgit snapshot` |
| start new work | `fmgit start <name>` |
| propose my branch | `fmgit pr` |
| get teammates' work into my file | `fmgit pull` |
| do it all with a mouse | `fmgit ui` |
