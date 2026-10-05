# Repository layout

This page describes exactly how fmgit turns a *Save a Copy as XML* export into
files, and back. You don't need it for daily work. It helps when reading raw
diffs, resolving conflicts by hand or writing tooling.

## Overview

```
invoices/
├── fmgit.json
├── .gitignore  .gitattributes
├── .github/workflows/fmgit.yml
├── .forgejo/workflows/fmgit.yml
├── Invoices.fmp12            (git-ignored)
├── build/                    (git-ignored: exports, patches, backups)
└── src/
    ├── skeleton.xml
    ├── BaseTableCatalog/
    │   ├── _order.txt
    │   ├── Invoices.129.xml
    │   └── Customers.130.xml
    ├── FieldsForTables/
    │   ├── _order.txt
    │   └── Invoices.129.xml          all fields of table "Invoices"
    ├── ScriptCatalog/
    │   ├── _order.txt
    │   └── Create Invoice.12.xml     script settings (name, folder, options)
    ├── StepsForScripts/
    │   └── Create Invoice.12.xml     the script's steps
    ├── LayoutCatalog/
    ├── ModifyAction.LayoutCatalog/   second-pass layout contents
    ├── CustomFunctionsCatalog/  CalcsForCustomFunctions/
    ├── ValueListCatalog/        OptionsForValueLists/
    ├── TableOccurrenceCatalog/  RelationshipCatalog/
    ├── ThemeCatalog/  CustomMenuCatalog/  LibraryCatalog/
    └── AccountsCatalog/  PrivilegeSetsCatalog/  ExtendedPrivilegesCatalog/
```

A [multi-file solution](/reference/configuration#multi-file-solutions)
(`"files"` in `fmgit.json`) has the same tree once per file, one level deeper:
`src/UI/skeleton.xml`, `src/UI/ScriptCatalog/…`, `src/Data/BaseTableCatalog/…`.

## The source XML

FileMaker's export looks like this (shortened):

```xml
<FMSaveAsXML version="2.2.2.0" Source="21.1.8" File="Invoices.fmp12" …>
  <Structure>
    <AddAction>
      <BaseTableCatalog> <UUID/> <TagList/> <BaseTable id="129" name="Invoices">…</BaseTable> … </BaseTableCatalog>
      <ScriptCatalog> … <Script id="12" name="Create Invoice">…</Script> … </ScriptCatalog>
      <StepsForScripts> <Script> <ScriptReference id="12" name="Create Invoice"/> <ObjectList> <Step …/> … </ObjectList> </Script> </StepsForScripts>
      …
    </AddAction>
    <ModifyAction> … </ModifyAction>
  </Structure>
  <Metadata> … </Metadata>
</FMSaveAsXML>
```

The export is UTF-16; fmgit writes UTF-8.

## How the export is split

- **Catalogs** are the children of `Structure/AddAction` and
  `Structure/ModifyAction`. Each becomes a folder.
- **Folder names**: the catalog's element name (`ScriptCatalog`). Catalogs
  under `ModifyAction` (or another action) are prefixed: `ModifyAction.LayoutCatalog`.
  A duplicate name gets `~2`, `~3`, ….
- **Objects** are the children of a catalog, or of its `ObjectList` if it has
  one. Exceptions are the catalog's own `UUID`, `TagList`, `Options` and
  `PasteIndexList`, which stay in the skeleton. Each object becomes one file.
- **skeleton.xml** is the whole export with every catalog emptied and marked
  with an `fmgit-dir` attribute that names its folder. `Metadata` stays here
  completely.

### File names

`<name>.<id>.xml`, for example `Create Invoice.12.xml`.

- **name / id** come from the object's `name` and `id` attributes. Objects
  without them (script steps, fields per table, custom function calcs, …) use
  their first `…Reference` child: `<ScriptReference id="12" name="Create Invoice"/>`.
  That's why a script's settings and its steps share the file name in two
  folders.
- Characters that are invalid on any OS (`< > : " / \ | ? *`, control
  characters) become `_`. Trailing dots and spaces are removed, names are cut
  at 60 characters, and Windows device names (`CON`, `PRN`, `AUX`, `NUL`,
  `COM1`…, `LPT1`…) get a `_` prefix.
- File names that would collide case-insensitively (macOS, Windows) get `~2`,
  `~3`, ….
- Renaming an object in FileMaker renames its file; git detects the rename.

### Object order: `_order.txt`

Order matters in FileMaker: the Script Workspace order and folders, layout
order, and so on. Each catalog folder has an `_order.txt` listing its files in
export order. When rebuilding, files listed there come first, in that order,
followed by any files not listed, sorted by name.

`.gitattributes` merges `_order.txt` with `merge=union`. Two branches that both
append a script keep both lines instead of conflicting. Duplicate lines and
lines for deleted files are ignored.

## Normalization

Some parts of the export change on every save without meaning anything. Left
in, they would make every diff noisy and every merge conflict. fmgit
removes them when splitting and **recomputes** them when rebuilding:

| What | Where | Why it's noise | On rebuild |
|---|---|---|---|
| `modifications`, `timestamp`, `userName`, `accountName` | every `<UUID>` | change whenever anything in the object changes; git already records who and when | left out |
| `index` | script `<Step>` inside `ObjectList` | inserting one step renumbers every later step | renumbered 0, 1, 2, … |
| `membercount` | `ObjectList`, catalogs, actions, `Structure` | adding an item changes the count line on both branches | recounted |
| `File`, `Source`, `locale` | root element | differ per developer (file name, FileMaker version, UI language) | left out |
| contents of `INSECURE_PASSWORD` | accounts, auto-login | passwords must never reach git | left out (see [Security](/reference/security)) |

Step indexes are only normalized for script steps. Steps inside button
definitions keep theirs.

The test suite verifies that **split → rebuild** gives back the original
export apart from exactly these changes, both on a fixture and on real
FileMaker 21 exports.

## Output format

Each object file is pretty-printed: one element per line, tab-indented, so line
diffs map to FileMaker changes. Calculation text is written as `CDATA` when it
contains `&`, `<` or `>`, so `If ( a < b & c )` stays readable instead of
turning into `&lt;` / `&amp;`. Text containing carriage returns is escaped
(`&#13;`) to survive line-ending conversion.

## Readable scripts

For `StepsForScripts` files, `fmgit textconv` / the web UI render the steps
the way the Script Workspace shows them:

```
Script: Create Invoice
Set Error Capture [ On ]
Set Variable [ $customer ; Value: Get ( ScriptParameter ) ]
If [ IsEmpty ( $customer ) ]
    Exit Script [ False ]
End If
// Show Custom Dialog [ "Debug" ]
```

- `If`, `Loop`, `Open Transaction` indent; `Else`, `Else If` outdent and
  indent; `End If`, `End Loop`, `Commit Transaction` outdent.
- Disabled steps start with `//`.
- Comments are shown as `# text`.
- Parameters are summarized from the step's `ParameterValues`: variable names,
  calculations, field references (`Table::Field`), booleans (`On`/`Off`),
  referenced scripts, layouts and find criteria.

This view is for **reading**. The XML stays the source of truth.
