import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics (.afm) files off disk at runtime rather
  // than importing them — Next.js's automatic serverless bundling tracer
  // doesn't follow that fs read, so the file was missing in every prior
  // deploy (ENOENT for Helvetica.afm), only surfacing when the real brief
  // generation path first ran on Vercel. Force it into every function's
  // bundle explicitly.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
