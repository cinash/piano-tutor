/**
 * Some versions have to be written in more than one place, where nothing but a comment
 * would otherwise hold them together. This asserts that every place agrees, and runs as
 * the first step of `npm run ci`. Why Playwright and Claude Code have to be repeated is at
 * the matching `ARG` in `.devcontainer/Dockerfile`. The Node image is named by tag and digest
 * three times — the dev container, the production build and the CI workflow — so that CI
 * renders the screenshots in the image their baselines came from, and builds what ships.
 */
import { readFileSync } from 'node:fs';

const readText = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));

const dockerfile = readText('../.devcontainer/Dockerfile');
const devcontainer = readText('../.devcontainer/devcontainer.json');
const dockerfileArg = (name) =>
  dockerfile.match(new RegExp(String.raw`^ARG\s+${name}=(\S+)`, 'm'))?.[1];
const nodeImage = (text) => text.match(/\bnode:\S+@sha256:[0-9a-f]{64}/)?.[0];

const playwrightSources = [
  {
    name: 'package.json devDependencies["@playwright/test"]',
    version: readJson('../package.json').devDependencies?.['@playwright/test'],
  },
  {
    name: '.devcontainer/Dockerfile ARG PLAYWRIGHT_VERSION',
    version: dockerfileArg('PLAYWRIGHT_VERSION'),
  },
];

// Only present once dependencies are installed.
try {
  playwrightSources.push({
    name: 'installed node_modules/@playwright/test',
    version: readJson('../node_modules/@playwright/test/package.json').version,
  });
} catch (error) {
  // `npm ci` has not run yet; the two source-level pins above are still worth checking.
  // Anything else — an unreadable or corrupt package.json — is a real problem.
  if (error.code !== 'ENOENT') throw error;
}

// Only present inside the dev container, where the image bakes it in.
if (process.env.PLAYWRIGHT_VERSION) {
  playwrightSources.push({
    name: 'container image env PLAYWRIGHT_VERSION',
    version: process.env.PLAYWRIGHT_VERSION,
  });
}

const checks = [
  { subject: 'Playwright', sources: playwrightSources },
  {
    subject: 'Claude Code',
    sources: [
      {
        name: '.devcontainer/Dockerfile ARG CLAUDE_CODE_VERSION',
        version: dockerfileArg('CLAUDE_CODE_VERSION'),
      },
      {
        name: '.devcontainer/devcontainer.json extension anthropic.claude-code',
        version: devcontainer.match(/"anthropic\.claude-code@([^"]+)"/)?.[1],
      },
    ],
  },
  {
    subject: 'Node image',
    sources: [
      { name: '.devcontainer/Dockerfile FROM', version: nodeImage(dockerfile) },
      {
        name: 'Dockerfile FROM ... AS build',
        version: nodeImage(readText('../Dockerfile')),
      },
      {
        name: '.github/workflows/ci.yml container',
        version: nodeImage(readText('../.github/workflows/ci.yml')),
      },
    ],
  },
];

let failed = false;

for (const { subject, sources } of checks) {
  const unreadable = sources.filter((source) => !source.version);
  if (unreadable.length > 0) {
    failed = true;
    console.error(`Could not read a ${subject} version from:`);
    for (const source of unreadable) console.error(`  - ${source.name}`);
    continue;
  }

  const distinct = new Set(sources.map((source) => source.version));
  if (distinct.size > 1) {
    failed = true;
    console.error(`${subject} versions have drifted apart:`);
    for (const source of sources)
      console.error(`  ${source.version.padEnd(12)} ${source.name}`);
    continue;
  }

  console.log(
    `${subject} ${sources[0].version} — in lockstep across ${sources.length} sources.`,
  );
}

if (failed) {
  console.error(
    '\nSet each of the above to the same version, then rebuild the dev container so\n' +
      'what is baked into the image matches what the repository declares.',
  );
  process.exit(1);
}
