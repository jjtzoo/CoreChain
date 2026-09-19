// Metro config for the npm-workspaces monorepo. Expo's default config only
// looks at this app's own node_modules; a monorepo needs it to also watch
// the workspace root (so edits to packages/domain trigger a rebuild) and to
// resolve modules hoisted to the root node_modules (where npm workspaces
// installs shared dependencies and symlinks sibling packages).
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
