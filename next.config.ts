import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font metrics (.afm) files off disk at runtime,
  // relative to its own __dirname, rather than importing them. Next.js's
  // bundler rewrites/inlines server code into chunks, which breaks that
  // internal relative-path math even once the files themselves are traced
  // into the deployment (confirmed: outputFileTracingIncludes alone did
  // NOT fix the ENOENT). serverExternalPackages keeps pdfkit as a plain
  // untouched node_modules require at runtime, so its own path resolution
  // stays intact; outputFileTracingIncludes still ensures the data files
  // are actually present in the deployment for that require to find.
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
