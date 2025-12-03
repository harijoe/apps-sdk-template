import tailwindcss from "@tailwindcss/vite";
import describePlugin from "./describe-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { skybridge } from "skybridge/web";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    skybridge(),
    react({
      babel: {
        plugins: [describePlugin()],
      },
    }),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
