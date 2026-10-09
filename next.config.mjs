/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/**',
        'node_modules/esbuild/**',
        'node_modules/webpack/**',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "edamam-product-images.s3.amazonaws.com" },
    ],
  },
};

export default nextConfig;
