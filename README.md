# NiyaNiya Extensions (Paperback 0.9)

Self-hosted [Paperback 0.9](https://paperback.moe) content extensions for the
Schale Network family of sites.

| Extension | Site                 | Content rating |
| --------- | -------------------- | -------------- |
| NiyaNiya  | https://niyaniya.moe | 18+            |

> Adult sources only appear in Paperback when adult content is enabled in the
> app settings.

## Install

Once this repo is published to GitHub Pages (see below), add the Pages URL as a
repository in Paperback:

```
https://<your-github-username>.github.io/<your-repo-name>/
```

1. Open Paperback → **Settings → Extensions → Add Repository**.
2. Paste the URL above and add it.
3. Open the repository and install **NiyaNiya**.

The install/landing page is generated automatically into `bundles/index.html`
by `npm run bundle`, so the Pages URL doubles as the human-readable install page
and the machine-readable registry.

## Reading pages (one-time Cloudflare check)

Browsing, search and details work with no setup. Reading the pages of a title
needs a Cloudflare "clearance" token, because the site gates its image API
behind Cloudflare Turnstile.

- The first time you open a chapter, Paperback shows a **Cloudflare bypass**
  banner. Complete the check in the in-app browser once and reopen the chapter.
  The extension stores the token and reuses it.
- If the automatic flow ever fails, you can paste a token manually:
  1. Open https://niyaniya.moe in a desktop browser and pass the check.
  2. Open the dev console and run `localStorage.getItem('clearance')`.
  3. Copy the value (without the quotes) into
     **NiyaNiya → Settings → Cloudflare clearance → Paste token → Save**.

Tokens expire; when reading stops working, redo the check or clear and re-paste.

## Settings

- **Image Resolution** — 780 / 980 / 1280 / 1600 / Original (default 1280).
- **Clean up titles** — strips bracketed prefixes (artist/circle) from titles.
- **Excluded tags** — comma-separated tags always hidden from browse/search.
- **Cloudflare clearance** — status, manual token entry, and a clear button.

## Development

Requires Node.js 24+.

```bash
npm install
npm run conformance   # tsc + lint + format checks
npm run bundle        # build into bundles/
npm run test          # run the test suite against the live API
npm run dev           # local server that rebuilds on change
```

> `getChapterDetails` fails in `npm run test` on purpose: the headless test
> harness cannot solve Cloudflare Turnstile, so the extension throws the
> clearance prompt. It works in the app after the one-time check.

## Publish to GitHub Pages

1. Create a new **public** GitHub repository.
2. Push this project to it (see commands below).
3. In the repo, go to **Settings → Pages → Build and deployment → Source** and
   choose **GitHub Actions**.
4. The included `.github/workflows/deploy.yaml` bundles the sources and deploys
   `bundles/` to Pages on every push to `main`.
5. Your install URL is `https://<username>.github.io/<repo>/`.

```bash
git init
git add .
git commit -m "Initial commit: NiyaNiya extension"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## Versioning

Bump the `version` in each source's `pbconfig.ts` on every release, or the app
will not offer the update.

## License

GPL-3.0-or-later.
