# Compass Personal

**Public PWA source repository.**

Open the installable application: https://hyprmanzero.github.io/market-compass-ios/

Compass Personal is a local-first progressive web app with an owner-controlled financial workspace and optional private AI connection. Banking and brokerage data are not connected automatically. Financial statements require explicit owner review.

## Install on iPhone

Open the application URL in Safari, then use **Share > Add to Home Screen**. Do not clear Safari website data without making and verifying an encrypted backup first.

## Development

Use Node.js 24 and pnpm 10. From the root of this repository:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck:libs
pnpm --filter @workspace/market-compass run typecheck
node --experimental-strip-types --test tests/*.test.mjs
```

Public GitHub Pages deployments are built from the `main` branch. This repository is intentionally public because it serves the iPhone PWA. **Private architecture, financial plans, security procedures, project roadmaps, and other internal documentation are maintained in a separate private repository.** Do not open issues with account details, financial records, access tokens or passwords.

**History notice:** Earlier commits of this public repository may still contain copies of documentation removed from the current tree. Removing files does not erase public Git history.
