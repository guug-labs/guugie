/** @type {import('next').NextConfig} */
const nextConfig = {
  // WAJIB: Biar library bedah file gak bikin build error di Cloudflare
  serverExternalPackages: ['pdfjs-dist', 'mammoth'],
  
  // OPSIONAL: Biar build lu kenceng tanpa drama typo/linting
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;