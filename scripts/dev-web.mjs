import { createServer } from "vite";
import react from "@vitejs/plugin-react";
const server = await createServer({
  configFile: false,
  root: "apps/web",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/socket.io": { target: "http://127.0.0.1:3000", ws: true },
    },
  },
});
await server.listen();
server.printUrls();
