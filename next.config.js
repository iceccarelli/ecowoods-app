/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  transpilePackages: [
    '@ecowoods/ui',
    '@ecowoods/api-client',
    '@ecowoods/auth',
    '@ecowoods/types',
    '@ecowoods/shared',
    '@ecowoods/config',
    '@ecowoods/utils'
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@ecowoods/ui'],
  },
  webpack: (config) => config,
};

module.exports = nextConfig;
