export const albertaDemoProject = {
  id: "alberta-drillhole-demo",
  name: "Alberta sample project",
  shortName: "Alberta demo",
  location: "Alberta, Canada",
  workstream: "Exploration workflow demonstration",
  dataOrigin: "Sample project · public data",
  sourceReference: "AER/AGS Digital Data 2024-0022",
  sourceUrl: "https://ags.aer.ca/publications/all-publications/dig-2024-0022",
  drillholeCount: 6,
  intervalCount: 27,
  assayCount: 313,
  description:
    "Public drillhole, geological interval and assay data from Alberta, with one sample traced through its core box, custody and dispatch. Read-only.",
} as const;

export const workspaceNavigation = [
  {
    label: "Overview",
    href: `/projects/${albertaDemoProject.id}`,
    available: true,
  },
  {
    label: "Drillholes",
    href: `/projects/${albertaDemoProject.id}/drillholes`,
    available: true,
  },
  {
    label: "Samples",
    href: `/projects/${albertaDemoProject.id}/samples`,
    available: true,
  },
  {
    label: "Dispatches",
    href: `/projects/${albertaDemoProject.id}/dispatches`,
    available: true,
  },
  {
    label: "Assays and QA/QC",
    href: `/projects/${albertaDemoProject.id}/assays`,
    available: true,
  },
] as const;
