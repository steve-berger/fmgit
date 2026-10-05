# Reviewing pull requests

Every change to `main` goes through a pull request. Reviewing means looking at
what changed **in FileMaker terms**, then approving or asking for changes.

## Where to review

| Place | What you see |
|---|---|
| **`fmgit ui` › Pull requests** | Readable FileMaker diffs, review form, merge box. Recommended |
| **Forgejo / GitHub web UI** | The pull request, plus a comment from CI with the changed objects and the readable diff. The *Files changed* tab there shows raw XML |
| **Terminal** | `fmgit diff main...<branch>` for the diff; `fmgit approve` / `reject` for the verdict |

## What to look at

![Pull request: FileMaker changes](/img/pr-files.png)

1. **The list of changed objects.** Does it match the description? A pull
   request called *"Fix invoice rounding"* that also touches *Privilege sets*
   needs a question.
2. **Script steps.** Read them like code: conditions, variables, error
   handling, `Commit Records`, disabled steps (shown struck through, prefixed
   with `//`).
3. **Fields.** Type changes (`Text` → `Number`), storage changes (global,
   indexing) and auto-enter calculations can affect existing data.
4. **The check.** A red `fmgit` check means the merged result would be broken:
   unresolved conflicts, invalid XML, or an id collision. See
   [Consistency check](/reference/check).

## Approve or request changes

::: code-group

```sh [Terminal]
fmgit approve 12 -m "Looks good"
fmgit reject 12 -m "ModuleName must stay Text: LoadHTML looks modules up by name"
```

```text [Web UI]
Pull request › Review changes:
  write a comment, choose Approve or Request changes, Submit review
```

:::

A rejection needs a comment that says what to change. Forgejo and GitHub don't
let you approve your own pull request.

![Changes requested](/img/pr-conversation.png)

## The merge box

The merge box at the bottom of the conversation sums up what's needed:

| Row | Meaning |
|---|---|
| **Review** | *Changes approved*, *Review required* (not enough approvals yet) or *Changes requested* |
| **Checks** | *All checks have passed*, *Checks are running* or *Some checks were not successful*, with the individual checks |
| **Merge** | *Auto-merge is enabled*; or the buttons **Enable auto-merge** and **Squash and merge now** |

![Merge box](/img/pr-mergebox.png)

- **Enable auto-merge** (`fmgit merge <n> -auto`): the forge merges as soon
  as approvals and checks are green. `fmgit pr` already does this unless you
  passed `-no-auto`.
- **Squash and merge now** (`fmgit merge <n>`): merges immediately. Branch
  protection still applies: the forge refuses if approvals or checks are
  missing.

Both use **squash merges**: the whole branch becomes one commit on `main`, and
the branch is deleted afterwards.

## After the merge

The author and everybody else run `fmgit pull` to get the change into their own
`.fmp12`; see [Keeping your file in sync](/guide/syncing).

## Who may approve?

`approvals` in [`fmgit.json`](/reference/configuration) sets how many approvals
`main` needs; `fmgit protect` writes it into branch protection. Who counts as a
reviewer is decided by the forge: on Forgejo, everyone with write access to the
repository; on GitHub, collaborators with write access.
