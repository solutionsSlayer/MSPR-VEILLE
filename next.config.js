/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // This is needed for Docker deployments
  experimental: {
    // this includes files from the monorepo base path
    outputFileTracingRoot: __dirname,
  },
}

module.exports = nextConfig
