import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    reporters: ["default", "./scripts/component-test-reporter.mjs"],
    environment: "jsdom",
    include: ["apps/web/test/**/*.test.tsx"],
    setupFiles: ["apps/web/test/setup.ts"],
    restoreMocks: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify("component-test"),
    __BUILD_COMMIT__: JSON.stringify("synthetic"),
  },
});
