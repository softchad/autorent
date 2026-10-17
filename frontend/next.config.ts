import type { NextConfig } from "next";

// Abu - numatytosios Next.js reikšmės (false), čia įrašytos AIŠKIAI, sąmoningai - savidokumentacija, kad niekas ateityje "greitai" nepataisytų nulūžusio build'o pakeisdamas į "true" ir užtylindamas realias ESLint/TypeScript klaidas.
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
