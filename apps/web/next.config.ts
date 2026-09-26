import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@corechain/domain"],
  // The admin's "Demo projects" reads these CSV files at run time
  // (lib/demo/demoProjects.ts), so they must ship with the server code.
  outputFileTracingIncludes: {
    "/admin/users": ["./data/demo/*/curated/*.csv"],
  },
  // Only the curated CSVs are read. Without this, the tracer sees
  // resolve(process.cwd(), "data/demo") and packs the source zip into the
  // function, which Vercel stores again with every deployment. (Next applies
  // excludes with "/" paths, so they work in Vercel's Linux build but not in
  // a local Windows build.)
  outputFileTracingExcludes: {
    "*": ["./data/demo/*/source/**", "./data/demo/*/raw/**"],
  },
};

export default nextConfig;
