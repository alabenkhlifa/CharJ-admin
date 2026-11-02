import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build info for Settings: the version in package.json and the short commit
// the bundle was built from, with "+dirty" when the working tree had changes
// to tracked files (a local build of uncommitted code says so). Tags are left
// out (--exclude), so it is always the plain hash. "dev" when git isn't there
// (a tarball, no repo).
const pkg: unknown = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const version =
  pkg && typeof pkg === 'object' && typeof (pkg as { version?: unknown }).version === 'string'
    ? (pkg as { version: string }).version
    : 'dev'
const commit = (() => {
  try {
    return (
      execFileSync('git', ['describe', '--always', '--dirty=+dirty', '--exclude=*'], { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim() || 'dev'
    )
  } catch {
    return 'dev'
  }
})()

// GitHub Pages serves the site at /CharJ-admin/, so production assets
// must be requested from that subpath. Local dev keeps "/".
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/CharJ-admin/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
}))
