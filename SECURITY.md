# Security policy

CoreChain is in development testing and not yet released. Fixes go into the
`main` branch, the live web app, and the latest test build of the CoreChain
Field Android app. Older test builds are not patched; testers are asked to
update.

## Reporting a vulnerability

Please report it privately, not in a public issue or pull request:

1. Open this repository's **Security** tab.
2. Choose **Report a vulnerability** and describe what you found, how to
   reproduce it, and what it could expose.

You should get an acknowledgement within a few days. Please give us a
reasonable time to fix the problem before you discuss it publicly.

## Scope

In scope: this repository's code, the web app it deploys, and the Android app
built from `apps/mobile`. Out of scope: the third-party services CoreChain uses
(Vercel, Neon, PowerSync, Sentry); report those to their providers.

Never include real project data, passwords or keys in a report.
