# CoreChain

Drill core passes through a lot of hands before it turns into an assay result. The driller boxes it, a geologist logs it, someone cuts and bags the samples, and weeks later a laboratory sends back numbers. Along the way the record usually ends up split between a field notebook, a few spreadsheets, a chat thread and the lab's own files. When a result looks wrong, tracing it back to the hole, the box, the depth and the person who handled it takes far longer than it should.

CoreChain is our attempt to keep that whole chain in one place, built with exploration and mining teams in the Philippines in mind.

Most of the work happens at the rig and in the core shed, often with no signal, so the main piece is CoreChain Field, an Android app. Geologists use it to log drillholes, core runs, intervals, photos, samples and custody on the phone, fully offline, and it syncs once a connection comes back. The website covers the desk side of the same work, for project managers, QA/QC and the laboratory.

CoreChain Field is in development testing and not yet released. If you log core or work with drilling data and would like to try it, you can request tester access at [corechain-orpin.vercel.app](https://corechain-orpin.vercel.app).

## Inside this repository

The phone app lives in `apps/mobile` (Expo and React Native), and the website and its server in `apps/web` (Next.js). The rules both of them share, such as depth checks, recovery, sample numbering and custody, sit in `packages/domain`, so the phone and the website apply them the same way. Product and design notes, the sprint plan and screen mockups are in `docs/product`.

To run it locally:

```bash
npm install
npm run dev          # the website, at http://localhost:3000
npm run dev:mobile   # the phone app; it needs a development build, Expo Go won't work
npm test
```

The website reads its settings from `apps/web/.env`. Start from `apps/web/.env.example`, and keep the real file out of git.

## About the data you'll see

Nothing in the demos or screenshots comes from a real client. The Cordillera porphyry project in `apps/web/data/demo/synthetic-cordillera-porphyry` is made up from start to finish. The Alberta drillholes in `apps/web/data/demo/alberta-dig-2024-0022` are public data from the Alberta Energy Regulator and Alberta Geological Survey, used under the Open Government Licence – Alberta; that folder's README has the full credit.

## Security and licence

If you find a security problem, please report it privately rather than in a public issue. [SECURITY.md](SECURITY.md) explains how.

The code is public so it can be read and reviewed, but all rights are reserved. See [LICENSE](LICENSE).
