# Consistency check

```sh
fmgit check
```

`check` validates `src/` and exits with status 1 if anything is wrong. CI runs
it on **the merge result** of every pull request, as the required `fmgit` check.
That catches problems that only appear when two branches meet. You can run it
locally anytime, or from the web UI under *Settings › Checks & protection*.

```
✓ FileMaker sources are consistent
```

```
✗ CustomFunctionsCatalog/Tax.7.xml: id 7 already used by CustomFunctionsCatalog/Discount.7.xml (two branches created different objects with the same id; recreate one of them)
```

## What it checks

| Rule | Message | Typical cause |
|---|---|---|
| No conflict markers | `<file>: unresolved merge conflict` | a line starting with `<<<<<<< ` or `>>>>>>> ` was committed |
| Well-formed XML | `<file>: invalid XML: …` | a hand-edited file was broken during conflict resolution |
| Unique object ids per catalog | `<file>: id <n> already used by <other file> (…)` | two branches created **different** objects (different UUIDs) that got the same id |
| Unique names | `<file>: name "<name>" already used by <other file>` | two tables, table occurrences, custom functions or value lists with the same name (case-insensitive) |
| Unique ids inside an object | `<file>: <Type> id <n> used by both "<a>" and "<b>"` | two branches each added a field with the same id to the same table |
| Unique names inside an object | `<file>: duplicate <Type> name "<name>"` | two fields with the same name in one table |
| Rebuild works | `rebuild failed: …` | `skeleton.xml` or a catalog folder is damaged |

Notes:

- The **same** object changed on two branches isn't a collision: it's the same
  file, and git merges it (or reports a conflict).
- Script steps legitimately repeat ids (the id is the step *type*), so steps are
  excluded from the id rules.
- Names are only checked where FileMaker requires uniqueness: tables, table
  occurrences, custom functions, value lists, and fields within a table.
  Scripts and layouts may share names in FileMaker, so they may here too.

## Fixing failures

See [Merge conflicts › id collisions](/guide/conflicts#id-collisions) and
[Option B: edit the XML](/guide/conflicts#option-b-edit-the-xml).
