/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['kokoro-js', 'onnxruntime-node', '@huggingface/transformers'],
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
