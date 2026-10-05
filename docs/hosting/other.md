# Other git hosts

GitLab, Bitbucket, Azure DevOps and plain SSH servers work for everything that
doesn't involve pull requests:

| Works | Needs the host's own UI |
|---|---|
| `init`, `save`, `snapshot`, `diff`, `start`, `pull`, `apply`, `patch`, `build`, `check` | opening, reviewing and merging pull requests |
| web UI: Changes, Objects, History, Branches, Settings | web UI: Pull requests (not supported; it asks for a Forgejo token) |

::: warning
fmgit treats every remote that isn't `github.com` as Forgejo/Gitea. On GitLab
or Bitbucket the pull-request commands therefore fail with API errors. Use
the host's web UI for merge requests instead.
:::

## CI on other hosts

Run the consistency check in your pipeline, for example on GitLab:

```yaml
fmgit:
  image: golang:latest
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - go install <your-fmgit-module>@latest
    - fmgit check
    - fmgit diff -md origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME...HEAD > fmgit.md
  artifacts:
    paths: [fmgit.md]
```

`fmgit diff -md` writes the same markdown as the pull request comment, so you
can post it with your host's API or attach it as an artifact.

## Protecting the main branch

Set up branch protection in the host's settings by hand: require approvals,
require the `fmgit` pipeline job, and block direct pushes.
