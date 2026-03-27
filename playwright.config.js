const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    headless: true,
    viewport: { width: 390, height: 844 }, // Mobile viewport
    screenshot: 'only-on-failure',
    baseURL: 'http://localhost:8080',
  },
  reporter: 'list',
  // This boots a local server using npx serve so we test the LOCAL branch, not production
  webServer: {
    command: 'npx serve -p 8080 -l tcp://127.0.0.1:8080',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
