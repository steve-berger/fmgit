# Contributing

fmgit is a small Go program with an embedded web UI. It has no dependencies
outside the Go standard library, and the UI has no build step.

## Build and test

```sh
go build .                      # ./fmgit
go vet ./...
go test ./...

# also round-trip real FileMaker exports (UTF-16, as saved by FileMaker):
FMGIT_SAMPLES=/path/a.xml,/path/b.xml go test ./...
```

Cross-compile for every platform:

```sh
for t in darwin/arm64 darwin/amd64 windows/amd64 windows/arm64 linux/amd64 linux/arm64; do
  GOOS=${t%/*} GOARCH=${t#*/} CGO_ENABLED=0 go build -o dist/fmgit-${t%/*}-${t#*/} .
done
```

Releases: push a tag `v*`. `.github/workflows/release.yml` runs the tests,
builds all six binaries and attaches them to a release.

## Code map

| File | Contents |
|---|---|
| `main.go` | CLI: command dispatch, config, git helpers, `init`, `save`, `snapshot`, `diff`, `pull`, `apply`, `patch`, `build`, `check`, sync marker |
| `fm.go` | the FileMaker logic: `normalize`, `split`, `build`, `finish` (recount), `check`, `makePatch`, `renderScript` |
| `xml.go` | minimal ordered XML tree: UTF-16 aware parser, pretty printer with readable CDATA |
| `forge.go` | `forge` interface with GitHub (`gh`) and Forgejo (REST) implementations; `pr`, `approve`, `reject`, `merge`, `protect`, `comment`, `render` |
| `ui.go` | web UI server: security middleware, JSON API, command runner |
| `ui/` | `index.html`, `style.css`, `app.js`, embedded with `//go:embed` |
| `fm_test.go` | round-trip, merge + patch + id-collision scenario in a temp git repo, remote URL parsing |
| `docs/` | this documentation (VitePress) |

## Design rules

- **Standard library only** for the binary. One file to copy, on every OS.
- **git does the version control.** fmgit only shapes files so git's diff and
  merge work well, and turns commits back into patches.
- **The forge does collaboration.** Pull requests, reviews, protection and CI
  stay in Forgejo or GitHub; fmgit drives them.
- **Never lose work.** Refuse rather than guess: stale files, unsaved work,
  merges in progress. Write new files instead of editing in place.
- **Read the real export.** The split logic is generic over FileMaker's
  catalog structure, not a hard-coded list of object types, so new FileMaker
  versions keep working.

## Tests

`fm_test.go` has three tests:

- **TestRoundTrip**: split → rebuild must give back the export, minus the
  [normalized attributes](/reference/repository-layout#normalization). Also checks that
  passwords don't leak, and the script renderer. Runs on a built-in fixture
  (encoded as UTF-16 like real exports) plus `FMGIT_SAMPLES`.
- **TestMergeAndPatch**: in a temporary git repository, two branches edit
  the same script and table in parallel. The merge must be clean, `check`
  must pass, and the patch must contain exactly the merged changes. Then two
  branches create different objects with the same id: `check` must catch it.
- **TestParseRemote**: HTTPS, SSH and scp-style remotes.

## The web UI

The UI is plain HTML/CSS/JS in `ui/`, embedded into the binary at build time.
To work on it, edit the files and rebuild (`go build . && ./fmgit ui`). There's
no bundler, framework or npm.

### API

All endpoints need the header `X-Fmgit-Token: <token>` and answer JSON.

| Endpoint | Returns |
|---|---|
| `GET /api/status` | branch, ahead/behind, sync state, dirty count, tools, forge, remote web URL |
| `GET /api/changes?range=…` | changed objects (`status`, `type`, `name`, `path`); no range = uncommitted work |
| `GET /api/diff?range=…&path=…` | readable unified diff of one object |
| `GET /api/log?all=1&ref=…&path=…` | up to 300 commits |
| `GET /api/commit?hash=…` | commit details, range and changed objects |
| `GET /api/branches` | local branches with ahead/behind against main |
| `GET /api/objects` | catalogs with their objects in FileMaker order |
| `GET /api/object?path=…` | an object and its related parts, rendered (script, fields, calc) and raw |
| `GET /api/search?q=…` | full-text matches (`git grep`) grouped by object |
| `GET /api/prs?state=open\|merged\|closed\|all` | pull requests in `gh`'s JSON shape (both forges) |
| `GET /api/pr?n=…` | one pull request with reviews, comments, checks and its FileMaker changes |
| `GET /api/check` | consistency check result |
| `GET/POST /api/config` | read / write `fmgit.json` |
| `POST /api/password`, `POST /api/token` | set credentials for this session |
| `POST /api/run` `{cmd, args}` | run an allowed command, streaming its output; the last line is `\0<exit code>` |
| `GET /api/download?f=patch.xml\|full.xml&t=<token>` | download from `build/` |

`/api/run` accepts the fmgit subcommands `save start pull apply pr approve
reject merge protect snapshot patch build check`, plus `switch <branch>`,
`fetch` and `push`. It runs the same binary, so the UI and CLI share every
safety rail.

## Documentation

```sh
cd docs
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in docs/.vitepress/dist
```

Screenshots live in `docs/public/img/`. When the UI changes, retake them at
1440×900 at 2× scale, so they stay sharp on high-resolution screens.
