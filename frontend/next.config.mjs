/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy /api/* to the Express API server, EXCEPT routes that the
    // Next.js app handles itself (transactions, tonconnect-manifest).
    const expressApi =
      process.env.EXPRESS_API_URL ?? "https://ayesha-acrotic-gingerly.ngrok-free.dev";
    return [
      {
        source: "/api/:path((?!transactions|tonconnect-manifest).*)",
        destination: `${expressApi}/api/:path`,
      },
    ];
  },
};

export default nextConfig;
