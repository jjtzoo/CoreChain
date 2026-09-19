const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // The MVP targets Android only (see docs/product/corechain-mobile-mvp-scrum-plan.md,
    // decision D2). The template's *.web.* variants are unused on our target
    // platform and are excluded from lint rather than fixed or deleted, since
    // Metro still needs them present for `expo start --web` to keep working
    // for anyone poking at the template locally.
    ignores: ['dist/*', '.expo/*', '**/*.web.ts', '**/*.web.tsx'],
  },
]);
