# What is fmgit?

fmgit gives FileMaker teams the workflow software teams use every day:
**branches, readable diffs, pull requests, reviews, required checks and
auto-merge**. It is a single command-line program with a built-in web UI. It
works with a self-hosted [Forgejo](https://forgejo.org) or with GitHub.

## The problem

A FileMaker solution is a binary `.fmp12` file. Git can store it but can't
**diff** it or **merge** it. When two developers change the same file in
parallel, one of them has to redo their work by hand. Nobody can review what
changed before it goes live, because there is nothing readable to review.

## The idea

FileMaker 2024+ can save a complete description of a file as XML (*Tools ›
Save a Copy as XML*, or `FMDeveloperTool --saveAsXML`). fmgit takes that XML
and splits it into **one small file per FileMaker object**:

```
src/
├── ScriptCatalog/Create Invoice.12.xml          script settings
├── StepsForScripts/Create Invoice.12.xml        the script's steps
├── BaseTableCatalog/Invoices.129.xml            table
├── FieldsForTables/Invoices.129.xml             the table's fields
├── LayoutCatalog/Invoice Detail.7.xml           layout
├── CustomFunctionsCatalog/TaxRate.3.xml         custom function
└── …
```

Now git sees FileMaker changes object by object:

- **Diffs** show exactly which scripts, fields and layouts changed. Script
  steps are shown as script text (`Set Variable [ $total ; Value: … ]`).
- **Merges** work: Anna changes the *Invoices* script while Ben adds a field to
  *Customers*, and git combines both without conflict. Even two people editing
  *different steps of the same script* merge cleanly.
- **Pull requests** become reviewable: a teammate sees what changed in
  FileMaker terms, approves it, and the change merges automatically once the
  FileMaker check in CI passes.

## How a change flows

```
  your Invoices.fmp12
         │  fmgit save             export + split + commit
         ▼
  feature branch  ──fmgit pr──▶  pull request on Forgejo / GitHub
                                    │  CI: fmgit check + readable diff comment
                                    │  teammate approves
                                    ▼
                                 auto-merge into main
                                    │
  your Invoices.fmp12  ◀──fmgit pull──┘
     (FMUpgradeTool patch, backup kept)
```

1. You work in FileMaker as usual, on your own copy of the file.
2. `fmgit save` exports the file, splits it and commits the result to your
   branch.
3. `fmgit pr` pushes the branch and opens a pull request with auto-merge armed.
4. CI runs `fmgit check` and posts a readable diff on the pull request.
5. A teammate approves. The forge merges as soon as approvals and checks are
   green.
6. Everyone runs `fmgit pull`. fmgit turns the merged changes into an
   FMUpgradeTool patch and applies it to their local file.

## What fmgit is not

- **Not a server.** fmgit runs next to a real forge (Forgejo, Gitea or GitHub)
  and uses its pull requests, reviews, branch protection and CI. See
  [Hosting](/hosting/forgejo).
- **Not a data sync.** It versions the *schema*: scripts, tables, fields,
  layouts, relationships, value lists, custom functions, menus, themes and
  privileges. It doesn't version records.
- **Not a FileMaker plug-in.** Nothing is installed into your solution.

## Status and limits

| Part | Status |
|---|---|
| Export, split, rebuild | Tested on real FileMaker 21.1 exports; split → rebuild is lossless |
| Diffs, merges, consistency check | Tested, including parallel edits and id collisions |
| Forgejo: PRs, reviews, protection, auto-merge, CI comment, renderer | Tested end to end against Forgejo 16 |
| GitHub | Same flow through the `gh` CLI. Not yet run against github.com |
| Applying patches with FMUpgradeTool | Patches are generated. **Applying them hasn't been tested yet**, so try it on a copy first |

Read [Known limits](/guide/faq#known-limits) before you rely on it in production.
