import { defineConfig } from 'vitepress'

// DOCS_BASE lets the Pages workflow serve the site from /<repo>/ instead of /.
export default defineConfig({
  title: 'fmgit',
  description: 'Git for FileMaker: branches, diffs, pull requests, reviews and auto-merge for FileMaker solutions.',
  base: process.env.DOCS_BASE || '/',
  cleanUrls: true,
  lastUpdated: false,
  head: [['link', { rel: 'icon', href: `${process.env.DOCS_BASE || '/'}favicon.svg` }]],
  themeConfig: {
    logo: '/favicon.svg',
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    nav: [
      { text: 'Guide', link: '/guide/what-is-fmgit', activeMatch: '/guide/' },
      { text: 'Go online', link: '/hosting/going-online' },
      { text: 'Hosting', link: '/hosting/forgejo', activeMatch: '/hosting/' },
      { text: 'Reference', link: '/reference/cli', activeMatch: '/reference/' },
      { text: 'Contributing', link: '/contributing' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is fmgit?', link: '/guide/what-is-fmgit' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Working with fmgit',
          items: [
            { text: 'Daily workflow', link: '/guide/daily-workflow' },
            { text: 'The web UI', link: '/guide/web-ui' },
            { text: 'Reviewing pull requests', link: '/guide/reviewing' },
            { text: 'Keeping your file in sync', link: '/guide/syncing' },
            { text: 'Merge conflicts', link: '/guide/conflicts' },
          ],
        },
        {
          text: 'Going further',
          items: [
            { text: 'Hosted & open files', link: '/guide/hosted-files' },
            { text: 'Deploying to production', link: '/guide/deploying' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
      '/hosting/': [
        {
          text: 'Hosting',
          items: [
            { text: 'Going online, step by step', link: '/hosting/going-online' },
            { text: 'Forgejo (self-hosted)', link: '/hosting/forgejo' },
            { text: 'GitHub', link: '/hosting/github' },
            { text: 'Other git hosts', link: '/hosting/other' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI commands', link: '/reference/cli' },
            { text: 'Configuration', link: '/reference/configuration' },
            { text: 'Repository layout', link: '/reference/repository-layout' },
            { text: 'Consistency check', link: '/reference/check' },
            { text: 'CI workflow', link: '/reference/ci' },
            { text: 'Patches', link: '/reference/patches' },
            { text: 'Security', link: '/reference/security' },
          ],
        },
      ],
    },
    footer: {
      message: 'fmgit: git for FileMaker',
    },
    docFooter: { prev: 'Previous', next: 'Next' },
  },
})
