---
layout: home

hero:
  name: fmgit
  text: Git for FileMaker
  tagline: Branches, readable diffs, pull requests, reviews and auto-merge for FileMaker solutions, on Forgejo or GitHub. One binary for macOS, Windows and Linux.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What is fmgit?
      link: /guide/what-is-fmgit
    - theme: alt
      text: Go online, step by step
      link: /hosting/going-online

features:
  - icon: 🧩
    title: One file per FileMaker object
    details: Your .fmp12 becomes one XML file per script, table, layout, custom function and value list. Two developers changing different scripts never touch the same file.
  - icon: 📜
    title: Diffs you can read
    details: Script changes show as script text, not XML soup, in the terminal, in the web UI and as a comment on every pull request.
  - icon: ✅
    title: Pull requests that merge themselves
    details: Required approvals, a FileMaker consistency check in CI, and auto-merge as soon as both are green. Same flow on self-hosted Forgejo and on GitHub.
  - icon: 🔁
    title: Changes flow back into FileMaker
    details: Merged work becomes an FMUpgradeTool patch that is applied to your local file, with a backup kept every time.
  - icon: 🛡️
    title: Safety rails
    details: fmgit refuses to save a file that is behind the branch, never overwrites unsaved FileMaker work, and strips passwords before anything reaches git.
  - icon: 🖥️
    title: A GitHub-style web UI
    details: "Run fmgit ui: changes, object browser, history, branches, pull requests and settings in your browser. No install, works offline."
---

<div class="vp-doc" style="max-width: 1152px; margin: 48px auto 0; padding: 0 24px;">

![The fmgit web UI](/img/changes.png)

</div>
