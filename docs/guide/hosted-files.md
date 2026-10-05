# Hosted & open files

By default fmgit exports your file with **FMDeveloperTool**, which needs the
`.fmp12` **closed and on local disk**. If your development file is hosted on
FileMaker Server, or you'd rather not close it, let FileMaker write the XML
itself.

## How it works

1. A small FileMaker script runs **Save a Copy as XML** to a fixed path.
2. `fmgit.json` points `xml` at that path.
3. `fmgit save`, `snapshot`, `diff` and the web UI read that XML instead of
   running FMDeveloperTool.

```json
{
  "file": "Invoices.fmp12",
  "xml": "/Users/steve/fmgit-export/Invoices.xml"
}
```

The `xml` path can also be set in the web UI under
*Settings › FileMaker tools › XML export path*. You can also pass it once on
the command line: `fmgit save -m "…" -xml /path/to/export.xml`.

## The FileMaker script

Create a script, for example **"fmgit: export"**, and run it from the Scripts
menu or a button whenever you want fmgit to see your changes:

```
# fmgit: export the current file's schema for git
Set Variable [ $path ; Value: Get ( DocumentsPath ) & "fmgit-export/" & Get ( FileName ) & ".xml" ]
Save a Copy as XML [ $path ]
Show Custom Dialog [ "fmgit" ; "Exported to " & $path ]
```

Then set `xml` in `fmgit.json` to the same path in your operating system's
notation, for example `/Users/steve/Documents/fmgit-export/Invoices.xml` or
`C:/Users/steve/Documents/fmgit-export/Invoices.xml`.

::: tip
Run the script on the **client** (not *Perform Script on Server*), so the
XML lands on your machine where fmgit runs.
:::

## Workflow with an XML export

```
work in FileMaker → run "fmgit: export" → fmgit diff / fmgit save / Scan file
```

Remember to run the export script before saving, or fmgit commits an older
state. The status bar in the web UI shows *1 unsaved change* only after a fresh
export.

## Applying merged changes to a hosted file

Patching (`fmgit pull` / `apply`) still uses FMUpgradeTool on a local, closed
file. For a hosted development file:

1. `fmgit pull`. If FMUpgradeTool can't reach the file, fmgit still writes
   `build/patch.xml`.
2. Download a copy of the file from the server (or close it there), apply the
   patch with FMUpgradeTool, upload it again.
3. `fmgit apply -mark` to record that your file now matches.

For production servers, see [Deploying to production](/guide/deploying).

## Encrypted files

Add the encryption key to both commands in `fmgit.json` and set
`FMGIT_EAR_KEY`:

```json
"exportCmd": ["FMDeveloperTool", "--saveAsXML", "{file}", "{account}", "{password}", "-target_filename", "{out}", "-force", "-encryption_key", "{earKey}"]
```
