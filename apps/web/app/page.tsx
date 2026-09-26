import "./landing.css";
import { Field } from "@/components/landing/field";
import { Hero } from "@/components/landing/hero";
import { SiteNav } from "@/components/landing/site-nav";
import { Laboratory, Qaqc, SampleStory } from "@/components/landing/trace";
import { Access, FinalCta, Integrity, Status } from "@/components/landing/trust";
import { Roles, Workflow } from "@/components/landing/workflow";

// The public landing page. The words and demo values live in
// components/landing/content.ts, checked by content.test.ts: nothing here may
// claim a capability, customer or release the product does not have. Phone
// images are real CoreChain Field screens from the demo projects; the web
// panels are simplified from the real pages, with the demo projects' values.

export default function Home() {
  return (
    <div className="lp">
      <SiteNav />
      <main>
        <Hero />
        <Workflow />
        <Roles />
        <Field />
        <SampleStory />
        <Laboratory />
        <Qaqc />
        <Integrity />
        <Status />
        <Access />
      </main>
      <FinalCta />
    </div>
  );
}
