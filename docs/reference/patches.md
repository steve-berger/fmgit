# Patches

A patch is an XML file that tells **FMUpgradeTool** which objects to add,
replace or delete in an existing `.fmp12`. fmgit creates patches for two jobs:

- `fmgit apply` / `pull`: bring your development file up to `HEAD`.
- `fmgit patch <from> <to>`: bring any copy, e.g. production, from one release to the next.

::: warning Status
Patch **generation** is tested. **Applying** patches with FMUpgradeTool hasn't
been tested yet. Apply to a copy first and check the result.
:::

## How a patch is built

1. **Changed files.** `git diff --name-status --no-renames <from> <to> -- src`.
   `skeleton.xml` and `_order.txt` are ignored; file-level settings aren't
   patched.
2. **Pairing.** Each changed object file is read at `<from>` and/or `<to>` and
   identified by its folder plus its **UUID** (falling back to `id`, then the
   file name). A delete and an add with the same identity are a **rename**:
   one object, changed.
3. **Classification:**

| Old | New | Section |
|---|---|---|
| – | ✓ | `AddAction` |
| ✓ | ✓ | `ReplaceAction` |
| ✓ | – | `DeleteAction` (the old object's XML) |

   Objects from second-pass folders (`ModifyAction.*`, e.g. layout contents) go
   into **`ModifyAction`** when added or changed. Their deletion is carried by
   the main object's `DeleteAction`.
4. **Accounts are skipped.** Objects that contain password data (accounts)
   can't be patched safely, because fmgit strips passwords. They are reported:
   `skipped <name> in AccountsCatalog: change accounts in FileMaker directly`.
5. **Assembly.** Catalogs keep their order from `skeleton.xml`. Each catalog
   is copied with its own metadata (`UUID`, `TagList`) and the selected
   objects. Member counts and step indexes are recomputed.

## Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<FMUpgradeToolPatch version="2.2.2.0">
	<Structure membercount="2">
		<AddAction membercount="1">
			<ScriptCatalog membercount="1">
				<UUID>A924ACE5-…</UUID>
				<TagList/>
				<Script id="31" name="Send Reminder">…</Script>
			</ScriptCatalog>
		</AddAction>
		<ReplaceAction membercount="2">
			<FieldsForTables membercount="1">
				<FieldCatalog>…all fields of table Invoices…</FieldCatalog>
			</FieldsForTables>
			<StepsForScripts membercount="1">
				<Script>
					<ScriptReference id="12" name="Create Invoice" UUID="…"/>
					<ObjectList membercount="42">…</ObjectList>
				</Script>
			</StepsForScripts>
		</ReplaceAction>
	</Structure>
</FMUpgradeToolPatch>
```

The root element comes from `patchRoot` in `fmgit.json` (default
`FMUpgradeToolPatch`). The `version` attribute is copied from the export's
grammar version. Everything inside follows FileMaker's own *Save a Copy as XML*
grammar.

## Applying by hand

```sh
FMUpgradeTool --update \
  -src_path  Invoices.fmp12 \
  -dest_path Invoices-patched.fmp12 \
  -patch_path build/patch.xml \
  -src_account Admin -src_pwd '…'
```

This is what `upgradeCmd` runs by default. If your FMUpgradeTool version uses
different options, change `upgradeCmd`
([configuration](/reference/configuration#command-templates)).

## id conflicts

FMUpgradeTool matches objects by id and UUID. A patch from a branch where two
developers created different objects with the same id is rejected with
*node ID conflicts*. `fmgit check` catches this before merging; see
[id collisions](/guide/conflicts#id-collisions).
