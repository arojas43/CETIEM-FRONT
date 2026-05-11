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
    'iovalkey',
    'ioredis',
    'bullmq',
    '@prisma/client',
    'canvas',
    'pdfjs-dist',
  ],
  // Configuración para hot reloading en Docker/Windows
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Verificar cambios cada segundo
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
