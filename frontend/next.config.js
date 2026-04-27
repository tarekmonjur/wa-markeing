/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const sessionManagerUrl = process.env.SESSION_MANAGER_URL || 'http://localhost:3002';
    const docsUrl = process.env.DOCS_URL || 'http://localhost:3003';
    return [
      {
        source: '/docs/:path*',
        destination: `${docsUrl}/:path*`,
      },
      {
        source: '/session-api/:path*',
        destination: `${sessionManagerUrl}/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
