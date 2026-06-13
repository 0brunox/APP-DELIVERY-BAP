/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permite imagens externas (Unsplash de exemplo) e do Supabase Storage
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
