/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  async rewrites() {
    const apiUrl = process.env.EXPRESS_API_URL ?? "http://localhost:3001";
    return {
      // Local Next.js API routes (app/api/*) are checked first as filesystem
      // routes. Only unmatched /api/* paths are proxied to Express.
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/:path((?!tonconnect-manifest|transactions).*)",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
