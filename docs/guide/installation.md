# Installation

fmgit is one binary with no runtime dependencies. It runs on **macOS,
Windows and Linux** (Intel and ARM).

## 1. Install fmgit

::: code-group

```sh [Download a release]
# pick the file for your system from the project's Releases page:
#   fmgit-darwin-arm64     macOS, Apple silicon
#   fmgit-darwin-amd64     macOS, Intel
#   fmgit-windows-amd64.exe
#   fmgit-linux-amd64
# rename it to fmgit (fmgit.exe on Windows) and put it on your PATH
chmod +x fmgit && sudo mv fmgit /usr/local/bin/
```

```sh [With Go]
go install github.com/<your-org>/fmgit@latest
```

```sh [From source]
git clone https://<your-git-host>/<your-org>/fmgit.git
cd fmgit
go build .                       # this machine
GOOS=windows GOARCH=amd64 go build .   # cross-compile for Windows
```

:::

Check it works:

```sh
fmgit help
```

::: tip Where do releases come from?
Pushing a tag (`git tag v0.1.0 && git push --tags`) to the fmgit repository runs
`.github/workflows/release.yml`. It builds all six binaries and attaches them
to a release.
:::

## 2. Requirements

| Tool | Needed for | Notes |
|---|---|---|
| **git** | everything | any recent version (2.28+) |
| **FileMaker Pro 2024+** | creating the XML | The *Save a Copy as XML* grammar fmgit reads |
| **FMDeveloperTool** | `save`, `snapshot`, `pull` | Exports the file without opening FileMaker. Claris command-line tool. Optional, see below |
| **FMUpgradeTool** | `pull`, `apply` | Applies patches to your `.fmp12`. Free download from Claris. Optional: without it fmgit writes the patch and you apply it yourself |
| **gh** | pull requests on GitHub | `gh auth login` once. Not needed for Forgejo |
| **Go** | CI only | The CI workflow installs fmgit with `go install` |

### Without FMDeveloperTool

You can let FileMaker write the XML itself. Create a script with the
*Save a Copy as XML* step, point it at a fixed path, and set that path as `xml`
in `fmgit.json`. fmgit then reads that file instead of running FMDeveloperTool.
This is also how you work with files hosted on FileMaker Server; see
[Hosted & open files](/guide/hosted-files).

### Tool paths

If FMDeveloperTool or FMUpgradeTool aren't on your `PATH`, put their full path
into `exportCmd` / `upgradeCmd` in [`fmgit.json`](/reference/configuration).
For example, on Windows:

```json
"exportCmd": ["C:/Program Files/Claris/FMDeveloperTool/FMDeveloperTool.exe", "--saveAsXML", "{file}", "{account}", "{password}", "-target_filename", "{out}", "-force"]
```

## 3. Credentials

fmgit never stores passwords in files. Set them as environment variables, or
enter them in the web UI's *Settings › Credentials* (kept in memory only):

| Variable | Used for |
|---|---|
| `FMGIT_PASSWORD` | password of the FileMaker account in `fmgit.json` (`account`) |
| `FMGIT_EAR_KEY` | encryption-at-rest key, if your file is encrypted (add `"-e", "{earKey}"` to the commands) |
| `FMGIT_FORGE_TOKEN` | Forgejo access token for pull requests ([how to create one](/hosting/forgejo#_3-create-access-tokens)) |

::: code-group

```sh [macOS / Linux]
export FMGIT_PASSWORD='…'
export FMGIT_FORGE_TOKEN='…'
```

```powershell [Windows PowerShell]
$env:FMGIT_PASSWORD = '…'
$env:FMGIT_FORGE_TOKEN = '…'
```

:::

Next: [Getting started](/guide/getting-started).
