/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // ESLint se ejecuta en CI — no bloquear el build de Docker
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TypeScript strict errors también se manejan en CI
  typescript: {
    ignoreBuildErrors: false,
  },
  // Paquetes con módulos nativos o BigInt que no deben ser bundleados por webpack
  serverExternalPackages: [
    'falkordb',
    'iovalkey',
    'ioredis',
    'bullmq',
    '@prisma/client',
    'canvas',
  ],
};

export default nextConfig;
