/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    let backendUrl = process.env.API_BASE_URL || 'http://localhost:8000';
    if (backendUrl.startsWith("http://") && !backendUrl.includes("localhost") && !backendUrl.includes("127.0.0.1")) {
      backendUrl = backendUrl.replace("http://", "https://");
    }
    return [
      {
        source: '/api/ideas',
        destination: `${backendUrl}/api/ideas`,
      },
      {
        source: '/api/scripts/:path*',
        destination: `${backendUrl}/api/scripts/:path*`,
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
