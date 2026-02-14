import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 3000",
    port: 3000,
    reuseExistingServer: true,
  },
});
