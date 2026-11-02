// What this bundle is, written in at build time by vite.config.ts `define`:
// the package.json version and the short git commit, "+dirty" when built
// from uncommitted changes ("dev" without git).

declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const BUILD_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
export const BUILD_COMMIT: string = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "dev";
