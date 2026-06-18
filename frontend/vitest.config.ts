import path from "path";
import { defineConfig } from "vitest/config";

// Unit tests for the client-side lib logic. jsdom gives plan.ts a real localStorage;
// the "@" alias mirrors tsconfig paths so tests import the same way the app does.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
