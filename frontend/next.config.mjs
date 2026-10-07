import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // genlayer-js is never bundled: reads go through server components and route handlers, and
  // writes go through an injected wallet provider. Keeping it external lets Node resolve it
  // natively, which is what lets src/lib/address.server.ts load an internal SDK chunk off disk
  // at runtime (webpack cannot pre-resolve that).
  // On the server, resolve genlayer-js with Node instead of bundling it. Two reasons: the
  // address-encoding helper loads an internal chunk off disk at runtime (see
  // src/lib/address.server.ts), which webpack cannot pre-resolve, and the SDK's dynamic
  // requires behave better outside the bundle.
  serverExternalPackages: ["genlayer-js"],
  // The repo also has a root package.json for the deploy scripts. Pin the workspace root
  // explicitly so Next doesn't infer it from whichever lockfile it finds first.
  outputFileTracingRoot: here,
};

export default nextConfig;
