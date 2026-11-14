/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep authentication redirects on the exact origin used by the browser.
  skipMiddlewareUrlNormalize: true,
};
export default config;
