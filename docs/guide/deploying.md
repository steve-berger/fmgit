# Deploying to production

Developers work on development copies; customers use the production file on
FileMaker Server. fmgit turns **the difference between two commits** into an
FMUpgradeTool patch, which brings exactly those schema changes into
production without touching the data.

::: danger Test on a copy first
Applying patches with FMUpgradeTool **hasn't been tested yet** (it wasn't
available while fmgit was built). Always apply a patch to a copy of the
production file first and check the result before replacing anything.
:::

## Tag what's live

Tag the commit that matches production, so "what changed since the last
release" is always one command away:

```sh
git tag v1.4.0 && git push --tags
```

## Build the patch

```sh
fmgit patch v1.4.0 main -o build/release-1.5.0.xml
```

The patch contains every object that changed between the two commits:

| Change | Patch section |
|---|---|
| object added | `AddAction` |
| object changed or renamed | `ReplaceAction` |
| object removed | `DeleteAction` |
| second-pass objects (e.g. layout contents, calculated fields that reference other tables) | `ModifyAction` |

Details: [Patches](/reference/patches).

In the web UI: *Settings › Deploy*, enter *from* and *to*, then **Create
patch** and **Download**. Or on a commit page, **Export as patch** for one
commit's changes.

## Apply it

On a **copy** of the production file, with the file closed:

```sh
FMUpgradeTool --update \
  -src_path   Invoices-prod.fmp12 \
  -dest_path  Invoices-prod-1.5.0.fmp12 \
  -patch_path build/release-1.5.0.xml \
  -src_account Admin -src_pwd '…'
```

Open the result, test it, then swap it in on the server during a maintenance
window, as you would with any FileMaker upgrade.

Then tag the release:

```sh
git tag v1.5.0 main && git push --tags
```

## What patches don't carry

- **Account passwords.** fmgit removes them from `src/` for security, so
  account objects are left out of patches. Change accounts in FileMaker
  directly.
- **File-level settings** in `skeleton.xml` (file options, file access).
  Changes there are versioned and visible in diffs, but they aren't patched.
- **Data.** Patches change schema only.

## Full XML

`fmgit build -o build/full.xml` reassembles the complete *Save a Copy as XML*
document from `src/`, for analysis tools or as an archive.
