/**
 * Playwright's browser binaries are baked into the container image at a specific
 * version. If the @playwright/test package is bumped without rebuilding the image (or
 * vice versa), Playwright silently downloads a second browser build at test time —
 * slow, and it hides the fact that CI and the image have drifted apart.
 *
 * This asserts that every place the version is written agrees, and runs as the first
 * step of `npm run ci`.
 */
import { readFileSync } from 'node:fs';

const readJson = (relative) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));

const sources = [];

const declared = readJson('../package.json').devDependencies?.['@playwright/test'];
sources.push({
  name: 'package.json devDependencies["@playwright/test"]',
  version: declared,
});

const dockerfile = readFileSync(
  new URL('../.devcontainer/Dockerfile', import.meta.url),
  'utf8',
);
const argMatch = dockerfile.match(/^ARG\s+PLAYWRIGHT_VERSION=(\S+)/m);
sources.push({
  name: '.devcontainer/Dockerfile ARG PLAYWRIGHT_VERSION',
  version: argMatch?.[1],
});

// Only present once dependencies are installed.
try {
  sources.push({
    name: 'installed node_modules/@playwright/test',
    version: readJson('../node_modules/@playwright/test/package.json').version,
  });
} catch {
  // `npm ci` has not run yet; the two source-level pins above are still worth checking.
}

// Only present inside the dev container, where the image bakes it in.
if (process.env.PLAYWRIGHT_VERSION) {
  sources.push({
    name: 'container image env PLAYWRIGHT_VERSION',
    version: process.env.PLAYWRIGHT_VERSION,
  });
}

const missing = sources.filter((source) => !source.version);
if (missing.length > 0) {
  console.error('Could not read a Playwright version from:');
  for (const source of missing) console.error(`  - ${source.name}`);
  process.exit(1);
}

const distinct = new Set(sources.map((source) => source.version));
if (distinct.size > 1) {
  console.error('Playwright versions have drifted apart:');
  for (const source of sources)
    console.error(`  ${source.version.padEnd(12)} ${source.name}`);
  console.error(
    '\nSet them all to the same version, then rebuild the dev container so the baked\n' +
      'browser binaries match the package.',
  );
  process.exit(1);
}

console.log(
  `Playwright ${sources[0].version} — in lockstep across ${sources.length} sources.`,
);
