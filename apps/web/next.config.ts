import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@corechain/domain"],
  // The admin's "Demo projects" reads these CSV files at run time
  // (lib/demo/demoProjects.ts), so they must ship with the server code.
  outputFileTracingIncludes: {
    "/admin/users": ["./data/demo/*/curated/*.csv"],
  },
};

export default nextConfig;
