import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tempo } from "tempo-devtools/dist/vite";

const conditionalPlugins: [string, Record<string, any>][] = [];

// @ts-ignore
if (process.env.TEMPO === "true") {
  conditionalPlugins.push(["tempo-devtools/swc", {}]);
}

// https://vitejs.dev/config/
export default defineConfig({
  base:
    process.env.NODE_ENV === "development"
      ? "/"
      : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
  },
  plugins: [
    react({
      plugins: conditionalPlugins,
    }),
    tempo(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    cors: true, // Enable CORS for all origins
    headers: {
      "Access-Control-Allow-Origin": "*", // Allow all origins (adjust as needed)
    },
    hmr: {
      protocol: "wss",
      host: "flamboyant-lehmann2-gaxyp.dev-2.tempolabs.ai",
      clientPort: 443,
      timeout: 30000,
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000", // Your backend API server
        ws: true, // Enable WebSocket support
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true, // Enable polling as a fallback
    },
    https: false, // Disable HTTPS during development (optional)
  },
});
