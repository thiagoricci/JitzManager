import { defineConfig } from "vitest/config";
import path from "path";

// Vitest config kept separate from vite.config.ts so the test runner does not
// load the SWC React plugin (tests run in a plain Node environment).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // The RLS suite spins up real SQL against Postgres; give it room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
