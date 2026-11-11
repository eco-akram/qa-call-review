import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Call imports upload a JSON file. Vercel caps request bodies at 4.5 MB;
      // the app itself limits files to MAX_IMPORT_BYTES (lib/call-import.ts).
      bodySizeLimit: "4mb",
    },
  },
}

export default nextConfig
