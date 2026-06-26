/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
    return [
      {
        source: '/api/ideas',
        destination: `${backendUrl}/api/ideas`,
      },
      {
        source: '/api/scripts/visual',
        destination: `${backendUrl}/api/scripts/visual`,
      },
      {
        source: '/api/video/:path*',
        destination: `${backendUrl}/api/video/:path*`,
      },
      {
        source: '/api/byoc/:path*',
        destination: `${backendUrl}/api/byoc/:path*`,
      },
      {
        source: '/api/pexels/:path*',
        destination: `${backendUrl}/api/pexels/:path*`,
      },
      {
        source: '/api/templates/:path*',
        destination: `${backendUrl}/api/templates/:path*`,
      },
      {
        source: '/api/twitter/:path*',
        destination: `${backendUrl}/api/twitter/:path*`,
      },
      {
        source: '/api/linkedin/:path*',
        destination: `${backendUrl}/api/linkedin/:path*`,
      },
      {
        source: '/api/instagram/:path*',
        destination: `${backendUrl}/api/instagram/:path*`,
      },
      {
        source: '/api/billing/:path*',
        destination: `${backendUrl}/api/billing/:path*`,
      },
      {
        source: '/api/schedule/:path*',
        destination: `${backendUrl}/api/schedule/:path*`,
      },
    ];
  },
};

export default nextConfig;
