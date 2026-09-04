# Deploying Hafiza

Hafiza is a static Vite PWA. Netlify builds the repository and publishes the
generated `dist` directory. The committed `netlify.toml` is the source of truth
for the build command, publish directory, SPA fallback, cache policy, and basic
security headers.

## How the pipeline works

1. You push a branch to GitHub.
2. GitHub Actions installs the locked dependencies and runs typechecking,
   linting, formatting checks, all Vitest tests, a production build, and the
   Chromium Playwright journey.
3. A pull request shows the CI result in GitHub. Netlify can also create a
   temporary Deploy Preview for it.
4. When changes reach `main`, Netlify builds and publishes the production site
   from GitHub.

The GitHub workflow does not contain deployment credentials. Netlify's Git
integration owns deployment and reports its status back to the GitHub commit.

## First-time Netlify setup

1. Push this repository to GitHub if the latest changes are not there yet.
2. Sign in to Netlify and choose **Add new project → Import an existing
   project**.
3. Select GitHub and authorize access to `mohamedmaghraby20/Hafiza`.
4. Select the repository. Netlify reads these committed settings automatically:

   - Production branch: `main`
   - Build command: `corepack pnpm build`
   - Publish directory: `dist`
   - Node.js: version 22

5. Choose **Deploy**. No Hafiza backend or server is required.

For safer releases, open **Project configuration → Build & deploy → Continuous
deployment** and keep Deploy Previews enabled for pull requests. In GitHub,
protect `main` and require the **Verify and build** status check before merging.

## Google Drive configuration

Google Drive is optional. The rest of Hafiza works without it. To enable it:

1. In Netlify, open **Project configuration → Environment variables**.
2. Add `VITE_GOOGLE_CLIENT_ID` with the Google OAuth web client ID. Its scope
   must include builds.
3. In Google Cloud Console, add both the production Netlify URL and any custom
   domain as authorized JavaScript origins.
4. Trigger a new deploy because Vite embeds `VITE_` variables at build time.

Never commit OAuth secrets or Netlify access tokens. A Google OAuth web client
ID is public configuration, but keeping environment-specific values in Netlify
avoids mixing development and production settings.

## Everyday Git workflow

Create a branch for each change:

```bash
git switch -c feature/short-description
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```

On GitHub, open a pull request into `main`. Wait for the CI check and Netlify
Deploy Preview, review the preview URL, and merge. Merging triggers the
production deployment automatically.

For a small direct deployment to `main`:

```bash
git add .
git commit -m "Prepare Netlify deployment"
git push origin main
```

## Run the same checks locally

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm test
corepack pnpm build
corepack pnpm e2e
```

To validate the Netlify build configuration with its CLI without installing it
globally:

```bash
corepack pnpm --package=netlify-cli@27.4.2 dlx netlify build --offline
```

To simulate Netlify's local proxy and routing, run:

```bash
corepack pnpm --package=netlify-cli@27.4.2 dlx netlify dev
```

## Rollback and troubleshooting

- Netlify keeps previous deploys. Open **Deploys**, select a known-good deploy,
  and publish it to roll back the site files.
- A rollback does not change IndexedDB data already stored in a user's browser.
  Avoid shipping persistence changes without a tested migration.
- If a build fails, open the failed GitHub Actions step or Netlify deploy log.
  Reproduce it locally with the commands above before retrying.
- If a refreshed route returns 404, confirm the SPA redirect in `netlify.toml`
  is present in the deployed commit.
- If an update appears stale, confirm `index.html` and `sw.js` use the no-cache
  headers and then reload the PWA.
