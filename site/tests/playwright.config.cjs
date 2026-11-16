const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/ui-smoke.spec.cjs',
  timeout: 50000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/ui-smoke.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8765',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  outputDir: 'test-results',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
