/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // La propriété a été déplacée hors de experimental
  outputFileTracingRoot: __dirname,
}

module.exports = nextConfig
