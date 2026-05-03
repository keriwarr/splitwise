/**
 * SDK version, sent in the User-Agent header.
 *
 * IMPORTANT: keep this in sync with `package.json#version`. The duplication
 * exists because there's no way to import a JSON file in a way that works for
 * both ESM and CJS builds without bundler help, and we ship without a bundler.
 *
 * Release checklist:
 *   1. Update package.json#version
 *   2. Update SDK_VERSION below to match
 *   3. Add a CHANGELOG entry
 *   4. `npm publish`
 */
export const SDK_VERSION = '2.0.0';
