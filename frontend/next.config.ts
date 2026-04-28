/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false }, // jei reikia ir dėl TS
};
module.exports = nextConfig;
