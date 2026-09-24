// Puts the synthetic Cordillera porphyry sample into one account's workspace
// (its team when it is on one): a Philippine-style copper-gold prospect in
// which EVERYTHING is made up (lib/demo/demoProjects.ts).
//
//   npm run sample:cordillera -- geologist1@corechain.test
//
// The admin's Teams card has the same thing as a button ("Demo projects").
// Run it again and it replaces its own earlier copy; other projects are left alone.

import { runDemoSeed } from "./demo-seed";

runDemoSeed("cordillera", "sample:cordillera");
