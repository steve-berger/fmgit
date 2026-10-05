# CI workflow

`fmgit init` writes the same workflow twice, once for each forge:

| File | Runs on | Runner label |
|---|---|---|
| `.github/workflows/fmgit.yml` | GitHub Actions | `ubuntu-latest` |
| `.forgejo/workflows/fmgit.yml` | Forgejo Actions | `docker` |

Forgejo uses `.forgejo/workflows` when it exists and ignores `.github/workflows`,
and GitHub ignores `.forgejo`. Keeping both is harmless and lets you move
between forges.

## The workflow

```yaml
# fmgit: validates FileMaker sources and posts a readable diff on every pull request.
# Make it a required check (fmgit protect) so PRs only auto-merge when it passes.
name: fmgit
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  fmgit:
    runs-on: ubuntu-latest          # Forgejo: docker
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-go@v5
        with:
          go-version: stable
      - run: go install github.com/acme/fmgit@latest
      - name: Validate FileMaker sources (merge result)
        run: $(go env GOPATH)/bin/fmgit check
      - name: Post FileMaker diff
        continue-on-error: true
        env:
          FMGIT_FORGE_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: $(go env GOPATH)/bin/fmgit comment origin/${{ github.base_ref }}...HEAD
```

Step by step:

1. **checkout, full history.** On a pull request, `HEAD` is the merge of the
   branch into its base, so the check sees exactly what `main` would look like
   after merging.
2. **setup-go + go install.** Installs fmgit. Replace the module path with
   where your fmgit is published; `fmgit init -module <path>` writes it for
   you. Pin a version (`@v0.3.0`) for reproducible builds.
3. **fmgit check.** The [consistency check](/reference/check). Its result is
   the required status:
   - GitHub: **`fmgit`** (the job name)
   - Forgejo: **`fmgit / fmgit (pull_request)`** (workflow / job (event)); branch
     protection matches it with the pattern `fmgit*`.
4. **fmgit comment.** Posts or updates the pull request comment with the
   changed objects and the readable diff. `continue-on-error`, because pull
   requests from forks only get a read-only token and can't comment. The
   check still counts.

## The comment

```markdown
<!-- fmgit -->
### FileMaker changes

| | Type | Name |
|---|---|---|
| ~ | Script steps | Create Invoice |
| + | Fields of table | Invoices |

<details><summary>Full diff</summary>
… readable diff, at most 50 000 characters …
</details>
```

The invisible `<!-- fmgit -->` marker lets later runs find and **update** the
comment instead of adding a new one on every push.

## Running the steps locally

```sh
fmgit check
fmgit diff -md origin/main...HEAD     # the comment's text
```

## Not using GitHub or Forgejo?

See [Other git hosts](/hosting/other) for a GitLab pipeline.
