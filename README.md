# CoreChain

CoreChain is an offline-first workflow platform for exploration and mining teams. It keeps the chain from drillhole to core box, logged interval, sample, custody and laboratory dispatch connected and traceable, including at the rig with no signal.

It has two parts:

- **CoreChain Field**, an Android app for geologists at the rig and in the core shed: drillholes, core runs, interval logging, photos, samples and custody, working offline and syncing when a connection returns.
- **The CoreChain website**, for desk work: project managers, QA/QC and the laboratory.

CoreChain Field is in development testing, not yet released. More about the project, and the tester sign-up: [corechain-orpin.vercel.app](https://corechain-orpin.vercel.app).

## Repository

| Folder            | Contents                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `apps/mobile`     | CoreChain Field, the Android app (Expo, React Native)                     |
| `apps/web`        | The website and its server (Next.js)                                      |
| `packages/domain` | Rules shared by both apps: depths, recovery, samples, custody, validation |
| `docs/product`    | Product and design documents, the sprint plan, and screen mockups         |
| `research`        | Background notes on the drill core workflow                               |

## Development

```bash
npm install
npm run dev          # website, http://localhost:3000
npm run dev:mobile   # Expo dev server; the app needs a development build, not Expo Go
npm test
npm run typecheck
npm run lint
npm run build
```

The website needs a local `apps/web/.env`. Copy `apps/web/.env.example` and fill it in. Never commit it.

## Demo data

All data shown in demos and screenshots is either public or made up:

- `apps/web/data/demo/synthetic-cordillera-porphyry`: a fictional porphyry prospect, written for demos. Not real data.
- `apps/web/data/demo/alberta-dig-2024-0022`: public drillhole data from the Alberta Energy Regulator / Alberta Geological Survey, under the Open Government Licence – Alberta. See the folder's README for the full attribution.

## Security

Please report a vulnerability privately; see [SECURITY.md](SECURITY.md).

## Licence

All rights reserved. The code is public to read, not to reuse; see [LICENSE](LICENSE).
