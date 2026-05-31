import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { skybridge } from "skybridge/vite";

export default defineConfig({
  plugins: [react(), skybridge({ viewsDir: "src/views" })]
});
