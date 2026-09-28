import { describe, expect, it } from "vitest";
import {
  GUIDE_TOURS,
  guidePageFor,
  guidePartFromParam,
  MANAGER_TOUR,
  previousGuidePage,
  QAQC_TOUR,
  withGuideParam,
} from "./tours";

const PROJECT = "/team/projects/1605ad3b-ef53-4537-b7d3-1d936738a56d";

describe("guide tours", () => {
  it("finds the tour page for each address", () => {
    const at = (path: string) => guidePageFor(MANAGER_TOUR, path)?.id ?? null;
    expect(at("/team")).toBe("today");
    expect(at("/team/projects")).toBe("projects");
    expect(at(PROJECT)).toBe("summary");
    expect(at(`${PROJECT}/3d`)).toBe("three-d");
    expect(at(`${PROJECT}/report`)).toBe("report");
    expect(at(`${PROJECT}/holes`)).toBeNull();
    expect(at("/team/holes")).toBe("holes");
    expect(at("/team/holes/005e152b")).toBe("hole");
    expect(at("/team/lab")).toBe("lab");
    expect(at("/team/samples/ff9ce4c1")).toBe("sample");
    expect(at("/team/people")).toBe("people");
    expect(at("/team/setup")).toBe("setup");
    expect(at("/team/codes")).toBeNull();
    expect(guidePageFor(QAQC_TOUR, "/qaqc")?.id).toBe("queue");
    expect(guidePageFor(QAQC_TOUR, "/qaqc/standards")?.id).toBe("standards");
  });

  it("joins every page into one path with no dead ends or loops", () => {
    for (const tour of Object.values(GUIDE_TOURS)) {
      const ids = new Set(tour.pages.map((p) => p.id));
      expect(ids.size).toBe(tour.pages.length);
      for (const page of tour.pages) {
        expect(page.steps.length).toBeGreaterThan(0);
        if (page.next) expect(ids.has(page.next.page)).toBe(true);
        // At most one page leads to each page, so Back is unambiguous.
        expect(tour.pages.filter((p) => p.next?.page === page.id).length).toBeLessThanOrEqual(1);
      }
      const start = guidePageFor(tour, tour.start);
      expect(start).not.toBeNull();
      const seen: string[] = [];
      let page = start;
      while (page && !seen.includes(page.id)) {
        seen.push(page.id);
        const nextId = page.next?.page;
        page = tour.pages.find((p) => p.id === nextId) ?? null;
      }
      expect(page).toBeNull();
    }
    expect(previousGuidePage(MANAGER_TOUR, "projects")?.id).toBe("today");
    expect(previousGuidePage(MANAGER_TOUR, "today")).toBeNull();
    expect(previousGuidePage(MANAGER_TOUR, "sample")).toBeNull();
    expect(previousGuidePage(QAQC_TOUR, "standards")?.id).toBe("queue");
  });

  it("keeps a page Back can return to by address wherever the address is fixed", () => {
    for (const tour of Object.values(GUIDE_TOURS))
      for (const page of tour.pages)
        if (page.href) expect(page.match.test(page.href)).toBe(true);
  });

  it("writes plain copy: no em dashes, no showcase names", () => {
    for (const tour of Object.values(GUIDE_TOURS))
      for (const page of tour.pages)
        for (const step of page.steps) {
          expect(`${step.title} ${step.body}`).not.toMatch(/—|MBR|BNT|Mabini|Bantay/);
          expect(step.body.endsWith(".")).toBe(true);
        }
  });

  it("reads the part from the address", () => {
    expect(guidePartFromParam(null, 5)).toBeNull();
    expect(guidePartFromParam("0", 0)).toBeNull();
    expect(guidePartFromParam("2", 5)).toBe(2);
    expect(guidePartFromParam("9", 5)).toBe(4);
    expect(guidePartFromParam("last", 5)).toBe(4);
    expect(guidePartFromParam("x", 5)).toBe(0);
    expect(guidePartFromParam("-1", 5)).toBe(0);
  });

  it("sets and removes the guide part without touching other parameters", () => {
    expect(withGuideParam("/team/holes?hole=abc", 2)).toBe("/team/holes?hole=abc&guide=2");
    expect(withGuideParam("/team/holes?hole=abc&guide=2", null)).toBe("/team/holes?hole=abc");
    expect(withGuideParam("/team", "last")).toBe("/team?guide=last");
    expect(withGuideParam("/team?guide=1#x", 3)).toBe("/team?guide=3#x");
  });
});
