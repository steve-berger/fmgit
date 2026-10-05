# Going online, step by step

This guide takes you from "it works on my machine" to a team setup on the
internet. There are three separate things to put online:

| | What | Where | Time |
|---|---|---|---|
| **[Part 1](#part-1-publish-fmgit)** | the **fmgit** program: source code and downloadable binaries | a GitHub repository | 15 min |
| **[Part 2](#part-2-publish-the-documentation)** | this **documentation** | GitHub Pages (or your own server) | 10 min |
| **[Part 3](#part-3-your-team-server-forgejo)** | your team's **server** for FileMaker projects, pull requests and reviews | Forgejo on a small server (or GitHub) | 45 min |
| **[Part 4](#part-4-onboard-the-team)** | your **team**: install, log in, first project | every developer's machine | 10 min each |

Do them in this order. Part 3 uses the binaries from Part 1, and CI in your
projects installs fmgit from the repository you create in Part 1.

Throughout this page, replace:

- `<you>`: your GitHub user or organization, e.g. `acme`
- `git.example.com`: the domain for your team server
- `docs.example.com`: the domain for the docs, if you host them yourself

---

## Part 1: Publish fmgit

### 1.1 Create an empty GitHub repository

On github.com: **New repository** → name `fmgit` → **Public** → don't add a
README, license or .gitignore → **Create repository**.

Or from the terminal:

```sh
gh repo create <you>/fmgit --public
```

::: tip Why public?
CI in your FileMaker projects downloads fmgit with `go install`, and GitHub
Pages is free for public repositories. fmgit contains no customer data. Your
FileMaker projects stay private in their own repositories. A private fmgit
repository works too, but every CI job then needs a token to download it, and
Pages needs a paid plan.
:::

### 1.2 Set the module path

The Go module path must match the repository URL, otherwise `go install`
can't find it. In the fmgit folder:

```sh
cd /path/to/fmgit
go mod edit -module github.com/<you>/fmgit
go build . && go test ./...          # still builds and passes
```

### 1.3 Commit and push

```sh
git init -b main
git add .
git status                          # check: no fmgit binary, no node_modules, no dist
git commit -m "fmgit: git for FileMaker"
git remote add origin https://github.com/<you>/fmgit.git
git push -u origin main
```

The `.gitignore` files already keep the compiled `fmgit` binary, `dist/`,
`docs/node_modules/` and the docs build output out of git.

### 1.4 Create the first release

```sh
git tag v0.1.0
git push origin v0.1.0
```

The tag starts `.github/workflows/release.yml`, which:

1. runs the tests,
2. builds fmgit for macOS (Apple silicon + Intel), Windows (x64 + ARM) and
   Linux (x64 + ARM),
3. creates the release **v0.1.0** with the six binaries attached.

Watch it under **Actions** on GitHub, or with `gh run watch`. After 2–3
minutes the binaries are at `https://github.com/<you>/fmgit/releases`.

::: tip New versions
Fix or improve something, commit, push, then `git tag v0.1.1 && git push origin v0.1.1`.
Use [semantic versions](https://semver.org): `vMAJOR.MINOR.PATCH`.
:::

### 1.5 Check it

On any machine with Go:

```sh
go install github.com/<you>/fmgit@latest
fmgit help
```

From now on, `fmgit init` in a project writes
`go install github.com/<you>/fmgit@v0.1.0` into the CI workflows
automatically, if that fmgit was installed with `go install`. Otherwise pass
it explicitly: `fmgit init -module github.com/<you>/fmgit@v0.1.0`.

---

## Part 2: Publish the documentation

### Option A: GitHub Pages (easiest)

The workflow `.github/workflows/docs.yml` is already in the repository. It
builds the docs and publishes them on every push to `main` that changes
something in `docs/`.

**2.1 Turn on Pages** (once):

GitHub → your `fmgit` repository → **Settings › Pages** → **Source: GitHub Actions**.

Or from the terminal:

```sh
gh api -X POST repos/<you>/fmgit/pages -f build_type=workflow
```

**2.2 Publish:**

```sh
gh workflow run docs.yml          # or push any change under docs/
gh run watch
```

**2.3 Open** `https://<you>.github.io/fmgit/`

The workflow builds the site for the `/fmgit/` sub-path automatically
(`DOCS_BASE`), so links and images work there.

::: details Custom domain (docs.example.com)
1. In your DNS, add a `CNAME` record `docs` → `<you>.github.io`.
2. GitHub → **Settings › Pages › Custom domain** → `docs.example.com` →
   **Save**, then tick **Enforce HTTPS** once the certificate is issued
   (minutes to an hour).
3. The site now lives at the root, so remove the sub-path: in
   `.github/workflows/docs.yml` change the `DOCS_BASE` line to

   ```yaml
   DOCS_BASE: /
   ```

   then commit and push.
:::

### Option B: your own server

The docs are a static site: plain files that any web server can serve.

```sh
cd docs
npm ci
npm run build                     # → docs/.vitepress/dist
rsync -a --delete .vitepress/dist/ root@git.example.com:/opt/forgejo/docs/
```

If you followed Part 3, add this block to the `Caddyfile` there and run
`docker compose restart caddy`:

```
docs.example.com {
	root * /srv/docs
	file_server
}
```

Also mount the folder into the Caddy container
(`- ./docs:/srv/docs:ro` under `caddy › volumes`). Add a DNS `A` record for
`docs.example.com` pointing to the server.

---

## Part 3: Your team server (Forgejo)

Your FileMaker projects need a home with pull requests, reviews and CI.
[Why Forgejo](/hosting/forgejo). If you'd rather use GitHub for your projects,
skip to [Part 4](#part-4-onboard-the-team) and see [GitHub](/hosting/github).

We set up:

```
                internet
                   │ https (443)        ssh (2222)
            ┌──────▼──────────────────────▼───┐
            │ server                          │
            │  Caddy ──► Forgejo ◄── Runner   │
            │  (HTTPS)   (git, PRs)  (CI jobs)│
            └─────────────────────────────────┘
```

- **Caddy**: HTTPS with automatic Let's Encrypt certificates
- **Forgejo**: repositories, pull requests, reviews, users; with fmgit as
  renderer
- **Forgejo Runner**: runs the `fmgit` check on every pull request

### 3.1 Get a server

Any Linux machine reachable from the internet (or from your office VPN) works:

- a small cloud server (Hetzner, DigitalOcean, Scaleway, …): **2 vCPU, 4 GB RAM,
  40 GB disk** is plenty for a FileMaker team, or
- a VM next to your FileMaker Server.

Install **Ubuntu 24.04 LTS** (or Debian 12), and make sure you can log in:
`ssh root@<server-ip>`.

### 3.2 Point a domain at it

In your DNS provider, add an **A record**:

| Name | Type | Value |
|---|---|---|
| `git` | A | `<server-ip>` |

Check it after a few minutes: `ping git.example.com` shows the server's IP.

### 3.3 Install Docker and open the firewall

On the server:

```sh
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw allow 2222 && ufw --force enable
```

Ports: 80/443 for the web (Caddy), 2222 for `git` over SSH (optional), 22 for
your own SSH access.

### 3.4 Put fmgit on the server

Forgejo uses fmgit to show FileMaker objects readably (the renderer):

```sh
mkdir -p /opt/forgejo && cd /opt/forgejo
curl -fsSL -o fmgit https://github.com/<you>/fmgit/releases/latest/download/fmgit-linux-amd64
chmod +x fmgit
./fmgit help                      # prints the command list
```

On an ARM server, use `fmgit-linux-arm64`.

### 3.5 Write the configuration

Create `/opt/forgejo/docker-compose.yml`:

```yaml
services:
  forgejo:
    image: codeberg.org/forgejo/forgejo:16   # use the current major version
    restart: unless-stopped
    environment:
      - USER_UID=1000
      - USER_GID=1000
      - FORGEJO__server__ROOT_URL=https://git.example.com/
      - FORGEJO__server__DOMAIN=git.example.com
      - FORGEJO__server__SSH_DOMAIN=git.example.com
      - FORGEJO__server__SSH_PORT=2222
      - FORGEJO__service__DISABLE_REGISTRATION=true   # only admins create accounts
      - FORGEJO__actions__ENABLED=true
    volumes:
      - ./data:/data
      - ./fmgit:/usr/local/bin/fmgit:ro
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "2222:22"

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data

volumes:
  caddy-data:
```

Create `/opt/forgejo/Caddyfile`:

```
git.example.com {
	reverse_proxy forgejo:3000
}
```

### 3.6 Start it

```sh
cd /opt/forgejo
docker compose up -d
docker compose logs -f            # Ctrl+C when it says it's listening
```

Open **https://git.example.com**. Caddy fetches the HTTPS certificate on the
first request, which can take a few seconds.

### 3.7 Finish the installation page

Forgejo shows its *Initial configuration* page:

1. **Database:** *SQLite3* is fine for teams up to ~20 people. Leave the path.
2. **Server and third-party settings:** the domain and URL are already filled
   in from the compose file. Leave them.
3. **Administrator account settings:** create your admin user. **Do this now**,
   because registration is disabled.
4. **Install Forgejo.**

### 3.8 Turn on the FileMaker renderer

Edit `/opt/forgejo/data/gitea/conf/app.ini` and add at the end:

```ini
[markup.filemaker]
ENABLED = true
FILE_EXTENSIONS = .xml
RENDER_COMMAND = "/usr/local/bin/fmgit render"
IS_INPUT_FILE = false
```

```sh
docker compose restart forgejo
```

Now scripts in your repositories show as script text in Forgejo's file browser
([screenshot](/hosting/forgejo#_6-readable-objects-in-forgejo-s-file-browser-optional)).

### 3.9 Add the CI runner

The runner executes the `fmgit` check of every pull request in a throwaway
container.

**Get a registration token:** Forgejo → avatar › **Site administration ›
Actions › Runners › Create new runner** → copy the token.

**Add the runner** to `docker-compose.yml` under `services:`:

```yaml
  runner:
    image: data.forgejo.org/forgejo/runner:11   # use the current version
    restart: unless-stopped
    user: "0:0"
    working_dir: /data
    depends_on: [forgejo]
    volumes:
      - ./runner:/data
      - /var/run/docker.sock:/var/run/docker.sock
    command: forgejo-runner daemon --config /data/config.yml
```

**Register it** (once):

```sh
cd /opt/forgejo
mkdir -p runner
docker compose run --rm --entrypoint "" runner sh -c '
  cd /data &&
  forgejo-runner register --no-interactive \
    --instance https://git.example.com \
    --token <REGISTRATION-TOKEN> \
    --name team-runner \
    --labels docker:docker://node:20-bookworm &&
  forgejo-runner generate-config > config.yml'
docker compose up -d runner
```

Under *Site administration › Actions › Runners* the runner now shows as
**Idle**. The label `docker` is what `.forgejo/workflows/fmgit.yml` asks for.

::: warning Runner details change between versions
The runner is the part of Forgejo that changes most between releases. If a
command above fails, follow the official
[Forgejo Runner installation guide](https://forgejo.org/docs/latest/admin/actions/runner-installation/).
It's authoritative. What matters for fmgit is only that a runner with the
label **`docker`** exists.
:::

::: info Security note
Mounting `/var/run/docker.sock` lets CI jobs control Docker on this server.
That's fine for a private team server where only your developers can open pull
requests. For more isolation, use the guide's *Docker-in-Docker* setup.
:::

### 3.10 Create the team and the first project

1. **Accounts:** *Site administration › User accounts › Create user account*
   for every developer, or connect LDAP / Active Directory under
   *Authentication sources*.
2. **Organization:** **+ › New organization**, e.g. `acme`. Create a team
   *Developers* with **Write** access to repositories, and add everybody.
3. **Repository:** **+ › New repository**, owner `acme`, name e.g.
   `invoices`, **Private**, **no** README. That's it; the first push comes
   from fmgit.
4. **Set up the project** on the lead developer's machine, as in
   [Getting started](/guide/getting-started):

```sh
cd invoices
fmgit init -file Invoices.fmp12
export FMGIT_PASSWORD='…'
fmgit save -m "Import Invoices solution"
git remote add origin https://git.example.com/acme/invoices.git
git push -u origin main
export FMGIT_FORGE_TOKEN='…'        # see Part 4
fmgit protect
```

5. **Check CI:** open a test pull request (`fmgit start test && … && fmgit pr`).
   Under the repository's **Actions** tab the `fmgit` job should run and turn
   green, and a *FileMaker changes* comment should appear on the pull request.

### 3.11 Backups and updates

**Backups:** everything lives in `/opt/forgejo/data` (and `runner/`). Back it
up nightly, e.g. with your provider's snapshots, or:

```sh
cd /opt/forgejo && docker compose stop forgejo
tar czf /root/forgejo-$(date +%F).tgz data
docker compose start forgejo
```

**Updates:** read the Forgejo release notes, then:

```sh
cd /opt/forgejo
docker compose pull && docker compose up -d
```

**New fmgit version on the server** (for the renderer):

```sh
cd /opt/forgejo
curl -fsSL -o fmgit https://github.com/<you>/fmgit/releases/latest/download/fmgit-linux-amd64
docker compose restart forgejo
```

---

## Part 4: Onboard the team

Every developer, once:

### 4.1 Install fmgit

Download the right file from `https://github.com/<you>/fmgit/releases/latest`,
rename it to `fmgit` (Windows: `fmgit.exe`) and put it on the `PATH`.

::: code-group

```sh [macOS]
cd ~/Downloads
mv fmgit-darwin-arm64 fmgit            # Intel Macs: fmgit-darwin-amd64
chmod +x fmgit
xattr -d com.apple.quarantine fmgit    # binaries from the internet are blocked otherwise
sudo mv fmgit /usr/local/bin/
fmgit help
```

```powershell [Windows]
# PowerShell
mkdir $HOME\bin -Force
Move-Item $HOME\Downloads\fmgit-windows-amd64.exe $HOME\bin\fmgit.exe
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$HOME\bin", "User")
# open a new terminal, then:
fmgit help
# if SmartScreen warns: More info › Run anyway
```

```sh [Linux]
curl -fsSL -o fmgit https://github.com/<you>/fmgit/releases/latest/download/fmgit-linux-amd64
chmod +x fmgit && sudo mv fmgit /usr/local/bin/
```

:::

Also install **git**, and the Claris tools **FMDeveloperTool** and
**FMUpgradeTool** ([requirements](/guide/installation#_2-requirements)).

### 4.2 Create a Forgejo token

https://git.example.com → avatar › **Settings › Applications › Generate new
token**: name `fmgit`, scopes **repository: Read and write** and **issue: Read
and write** → **Generate** → copy it.

Store it permanently:

::: code-group

```sh [macOS / Linux]
echo "export FMGIT_FORGE_TOKEN='…'" >> ~/.zshrc     # bash: ~/.bashrc
```

```powershell [Windows]
[Environment]::SetEnvironmentVariable("FMGIT_FORGE_TOKEN", "…", "User")
```

:::

Or paste it each session in `fmgit ui` › *Settings › Credentials*.

### 4.3 Clone a project

```sh
git clone https://git.example.com/acme/invoices.git
cd invoices
cp /path/to/current/Invoices.fmp12 .
fmgit apply -mark
fmgit ui
```

git asks for your Forgejo username and password (or the token) on the first
clone; let your system's credential manager remember it.

Done. Continue with the [Daily workflow](/guide/daily-workflow).

---

## Checklist

- [ ] `github.com/<you>/fmgit` exists, public, module path set
- [ ] Release `v0.1.0` has six binaries
- [ ] Docs are online (`https://<you>.github.io/fmgit/` or `docs.example.com`)
- [ ] `https://git.example.com` loads with a valid certificate
- [ ] Registration disabled; developers have accounts and are in the team
- [ ] The renderer shows a script as script text
- [ ] A runner with label `docker` is *Idle*
- [ ] Test pull request: `fmgit` check green, *FileMaker changes* comment posted
- [ ] `main` is protected (`fmgit protect`)
- [ ] Nightly backup of `/opt/forgejo/data`
