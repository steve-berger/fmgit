# The web UI

```sh
fmgit ui
```

The web UI is built into the fmgit binary. It opens in your default browser and
looks like GitHub or Forgejo, so it should feel familiar. It covers the whole
workflow. Pull request review works best in it because it shows FileMaker
changes in readable form.

```
fmgit UI running at
  http://127.0.0.1:52144/?t=5c9cf3499bfe03d52d149058ddce71c1
(ctrl+c to stop)
```

| Flag | Effect |
|---|---|
| `-port 7311` | use a fixed port instead of a random free one |
| `-no-open` | don't open the browser; open the printed link yourself |

::: tip Only the printed link works
The link contains a random key for this session. Requests without it are
refused, so other websites and other users on the machine can't use the UI.
Stop the UI with <kbd>Ctrl</kbd>+<kbd>C</kbd>. Running `fmgit ui` again prints a
new link.
:::

## Header, toolbar and status bar

Every page shows the repository (`owner / name`, read from the remote), a link
to the repository on Forgejo or GitHub, the dark mode toggle, and the tabs.

The **toolbar** has the branch picker on the left and *Fetch*, *Pull* and
*Push* on the right.

![Branch picker](/img/branch-picker.png)

The **branch picker** works like GitHub's. Type to filter. Pick a branch to
switch to it (`git switch`), or type a new name and choose *Create branch* to
run `fmgit start`.

Below it, the **status bar** tells you where your work stands:

> This branch is **1 commit ahead of** `origin/main` · **1 unsaved change** in
> Invoices.fmp12 · Pull request #5 · changes requested

It always offers the next sensible step: *Scan file*, *Apply to file* (when
your file is behind), *Push*, *Open pull request* or *View #5*.

If your file is behind the branch, or a merge is in progress, a yellow or red
banner explains what to do.

## Changes

![Changes](/img/changes.png)

This is GitHub's *Files changed* view, but for your **unsaved FileMaker work**.

- **Left:** changed objects grouped by type. Click one to jump to its diff.
  The filter box narrows the list.
- **Commit changes:** commit message and optional description.
  *Commit N changes* runs `fmgit save`, which exports the file again first.
  <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> submits. On `main`, the box first asks you
  to create a branch.
- **Diffs:** one collapsible box per object. Scripts are shown as script text;
  other objects as XML. *Unified* / *Split* switches the layout for every diff
  on the page, and the choice is remembered.
- **Re-scan file** runs `fmgit snapshot` to pick up new FileMaker changes.

![Split diff](/img/changes-split.png)

If there are no changes, the page offers *Scan FileMaker file*.

## Objects

The object browser is a code browser for your solution. It shows the state of
your last scan.

![Objects overview](/img/objects-overview.png)

The left tree has one folder per catalog (Tables, Scripts, Layouts, …) with
object counts. Script folders and separators from the Script Workspace are
shown as they are in FileMaker. *Parts* holds the second halves of objects:
script steps, fields, calculations and value-list values.

Selecting an object shows:

- the **last commit** that changed it, with a link to its full history
- **tabs** for each part of the object. A script has its readable *Script*
  plus the *Script XML*; a table has its *Fields*; a custom function has its
  *Calculation*
- an **XML** toggle to see the raw source of any part

![A script](/img/objects-script.png)

Tables list their fields with type, options (global, required, unique,
auto-enter, index), comment and calculation:

![Fields of a table](/img/objects-fields.png)

### Search

Press <kbd>/</kbd> anywhere to jump to the search box.

- Typing searches **object names**.
- With **Search inside calculations & scripts** ticked, it searches the full
  text of every object. Use it to find where a field, variable or function is
  used. Matches are highlighted with their line numbers.

![Search](/img/objects-search.png)

## History

![History](/img/history.png)

Commits grouped by day, with author, time and branch/tag labels. *This branch*
/ *All branches* switches the scope. Click a commit to open it:

![Commit](/img/commit.png)

The commit page shows the message, author, parents and every changed object as
a stacked diff. **Export as patch** writes an FMUpgradeTool patch with exactly
this commit's changes and offers it for download; see
[Deploying](/guide/deploying).

## Branches

![Branches](/img/branches.png)

The default branch and your branches. Each row shows when the branch was last
updated and by whom, a **behind | ahead** bar compared to `main`, its pull
request (if any), and whether it is pushed. Use *Switch* and
*New pull request* from here, or create a branch with the field at the top.

::: info Switching branches doesn't change your .fmp12
Only the files in `src/` change. If the branch you switch to has different
FileMaker objects, the status bar shows that your file is behind and offers
*Apply*.
:::

## Pull requests

![Pull requests](/img/prs.png)

Open, merged and closed pull requests, each with its review state
(*Review required*, *Approved*, *Changes requested*), an auto-merge label and
a check icon (✓ passed, ● running, ✗ failed).

A pull request has two tabs:

**Conversation:** the description, the timeline of reviews and comments, the
merge box (review state, checks, merge buttons) and the review form. The
sidebar lists reviewers, checks, the changed FileMaker objects and the
auto-merge state.

![Pull request conversation](/img/pr-conversation.png)

**FileMaker changes:** every changed object as a readable diff, with the
review form at the bottom.

![Pull request files](/img/pr-files.png)

See [Reviewing pull requests](/guide/reviewing) for the review workflow.

## Settings

![Settings](/img/settings.png)

| Section | What you can do |
|---|---|
| General | FileMaker file, account, default branch, required approvals |
| FileMaker tools | XML export path, source folder, export and patch commands, tool status |
| Git host | GitHub or Forgejo (or auto-detect), Forgejo URL, connection status, the renderer snippet for Forgejo |
| Credentials | FileMaker password and Forgejo token for this session (memory only) |
| Checks & protection | run the [consistency check](/reference/check); protect `main` |
| Deploy | create a patch between two commits; build the full XML; download both |

*Save settings* writes `fmgit.json`. Commit it so the team shares the settings.

![Consistency check](/img/settings-checks.png)

## Output panel

Every action (Save, Pull, Push, Switch, Approve, …) runs the matching fmgit or
git command and streams its output into the panel at the bottom:

![Output](/img/console.png)

The panel closes by itself after a success and stays open on errors. The last
line of the error also appears as a message in the corner. Only one command
runs at a time, like in a terminal.

## Dark mode

The moon/sun button in the header switches themes. The default follows your
system setting.

![Dark mode](/img/dark.png)
