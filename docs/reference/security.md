# Security

## Nothing secret in the repository

- **Passwords are stripped.** FileMaker's export contains account passwords
  and the file's auto-login password in `INSECURE_PASSWORD` elements (FileMaker
  itself labels this encoding insecure). fmgit removes everything inside these
  elements before writing `src/`. They never reach git, CI logs or pull
  request comments.
- **`fmgit.json` has no credentials.** The FileMaker password, encryption key
  and forge token come from environment variables
  (`FMGIT_PASSWORD`, `FMGIT_EAR_KEY`, `FMGIT_FORGE_TOKEN`), or from the web UI,
  which keeps them in memory only.
- **The `.fmp12` isn't committed** (`*.fmp12` is git-ignored), so no data
  leaves your machine through git.

What *is* in the repository: the complete schema, including account names,
privilege sets, extended privileges and the file access authorization keys
from *File Access*. Treat the repository like the solution itself and keep it
private.

::: info Command lines
FMDeveloperTool and FMUpgradeTool take the password as a command-line argument
(`{password}`). On shared machines, other local users may see process
arguments. That's how these Claris tools work, and fmgit can't change it.
:::

## The web UI

`fmgit ui` runs a local web server that can run git commands, so it's locked
down:

| Measure | Protects against |
|---|---|
| listens on `127.0.0.1` only | access from the network |
| random 128-bit session token in the printed link; every API request needs it (`X-Fmgit-Token`, constant-time compare) | other local users, other websites (CSRF) |
| `Host` header must be `127.0.0.1:<port>` or `localhost:<port>` | DNS rebinding attacks |
| strict Content-Security-Policy (`default-src 'self'`), `nosniff`, `frame-ancestors 'none'`, no referrer | script injection, click-jacking, token leaks |
| fixed list of allowed commands; git ranges, refs and branch names from requests must not start with `-` | argument injection (e.g. `git diff --output=…`) |
| paths validated to stay inside `src/` | reading files outside the project |
| all page content is HTML-escaped | XSS from commit messages, PR comments, object names |
| one command at a time | concurrent git operations |

The token is moved from the address bar into the tab's session storage on
first load, so it doesn't stay in your browser history.

## Forge tokens

- Forgejo tokens need **repository** and **issue** read/write scopes, nothing
  more. Each developer uses their own, so reviews and merges are attributed
  correctly.
- In CI, the workflow token (`secrets.GITHUB_TOKEN`) is used; it expires with
  the job.
- `fmgit protect` needs admin rights; daily work doesn't.

## Forgejo renderer

`fmgit render` only reads stdin and writes HTML-escaped output. Forgejo
additionally sanitizes renderer output. It doesn't touch the file system or
the network.
