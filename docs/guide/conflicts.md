# Merge conflicts

Because every FileMaker object is its own file, most parallel work merges
without any conflict. This page covers what still can collide and how to
resolve it.

## What merges by itself

| Two people… | Result |
|---|---|
| change **different** objects | merges cleanly |
| change **different steps** of the same script | merges cleanly (line-based merge of the steps file) |
| add fields to the **same table** | merges cleanly if the fields have different ids; see [id collisions](#id-collisions) |
| add new scripts, layouts, … | merges cleanly: object order lives in `_order.txt` files that git merges with the `union` strategy |
| one renames an object, the other edits it | usually merges (git follows the rename) |

fmgit makes this possible by removing everything that changes on every save
without meaning anything: modification counters, timestamps, step indexes and
member counts. See [Repository layout](/reference/repository-layout#normalization).

## Real conflicts

Two people change **the same lines of the same object**: the same step, the
same field definition, or objects on the same layout. Git then stops:

```
CONFLICT (content): Merge conflict in src/StepsForScripts/Create Invoice.12.xml
fmgit: pull stopped. if there are conflicts: fix them in src/ (or `git checkout --theirs/--ours <file>`), `git commit`, then `fmgit apply`
```

### Option A: take one side (simplest)

Keep one version of the object and redo the other change in FileMaker
afterwards:

```sh
git checkout --theirs "src/StepsForScripts/Create Invoice.12.xml"   # main's version
# or
git checkout --ours   "src/StepsForScripts/Create Invoice.12.xml"   # your version
git add src && git commit --no-edit
fmgit apply              # bring the merged result into your file
```

This is the right choice for **layouts** and other visual objects, whose XML is
hard to merge by hand.

### Option B: edit the XML

For scripts and fields the XML is readable. Open the file, keep the lines you
want between the conflict markers, delete the markers, then:

```sh
fmgit check              # catches leftover markers and invalid XML
git add src && git commit --no-edit
fmgit apply
```

::: tip Don't run `fmgit save` during a merge
`save` exports your file, which would overwrite your resolved files. fmgit
refuses with *"a merge is in progress…"*. Finish the merge with `git commit`
first.
:::

## id collisions

FileMaker numbers objects per file: the next new script gets the next free
id. If Anna and Ben each create a new custom function in their own copies, both
may get **id 7**:

```
src/CustomFunctionsCatalog/Tax.7.xml        (Anna)
src/CustomFunctionsCatalog/Discount.7.xml   (Ben)
```

The file names differ, so git merges both without complaint. But the merged
result has two different objects with the same id, and FMUpgradeTool would
reject it.

`fmgit check` catches this. It runs in CI on every pull request, against the
merge result:

```
✗ CustomFunctionsCatalog/Tax.7.xml: id 7 already used by CustomFunctionsCatalog/Discount.7.xml (two branches created different objects with the same id; recreate one of them)
```

**Fix:** the pull request that came second recreates its object. Delete it in
FileMaker, `fmgit pull` to get the other one, create yours again (it gets a new
id), `fmgit save`. The same applies to fields within a table and to duplicate
names of tables, table occurrences, custom functions and value lists.

## Avoiding conflicts

- Keep branches short-lived: pull often, open small pull requests.
- Agree who works on a layout before two people redesign it at the same time.
- Let CI's `fmgit check` be a required check (`fmgit protect` does that).
