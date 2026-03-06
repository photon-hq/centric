/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['openai', 'pino', 'pino-pretty', '@photon/core']
  }
}

module.exports = nextConfig
