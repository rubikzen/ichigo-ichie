import type { NextConfig } from "next";

const noIndexHeader = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" }
    ],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      { source: "/admin/:path*", headers: noIndexHeader },
      { source: "/api/:path*", headers: noIndexHeader },
      { source: "/checkout/:path*", headers: noIndexHeader },
      { source: "/panier/:path*", headers: noIndexHeader },
      { source: "/compte/:path*", headers: noIndexHeader },
      { source: "/commande/:path*", headers: noIndexHeader },
    ];
  },
};

export default nextConfig;
