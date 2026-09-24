// Puts the Alberta sample project into one account's workspace (its team when
// it is on one), so a phone or the web app shows realistic work.
//
//   npm run sample:seed -- geologist1@corechain.test
//
// The data and what is official versus illustrative are described in
// lib/demo/demoProjects.ts. The admin's Teams card has the same thing as a
// button ("Demo projects"). Run it again and it replaces its own earlier copy.

import { runDemoSeed } from "./demo-seed";

runDemoSeed("alberta", "sample:seed");
