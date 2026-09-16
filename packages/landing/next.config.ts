import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Every route prerenders, so the site is plain files on S3 behind CloudFront.
  // trailingSlash makes /docs/cli emit docs/cli/index.html, which the
  // CloudFront function in infra/site resolves.
  output: 'export',
  trailingSlash: true,
};

export default config;
