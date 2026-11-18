import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // The portal renders images with plain <img> tags and ships no next/image
  // components or public/ images, so no remote image hosts are allowed. This
  // keeps the /_next/image optimizer (sharp) from fetching and decoding remote
  // files. Add remotePatterns back only if next/image is introduced.
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
