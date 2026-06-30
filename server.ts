import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import app from "./server/app";
import connectDB from "./server/config/db";
import { initSocket } from "./server/config/socket";

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 6000;

  // Attempt database connection
  const conn = await connectDB();
  if (conn && conn.isMemory) {
    try {
      console.log('Detected local memory database. Automatically running seed fixtures...');
      const { seed } = await import('./seed');
      await seed();
    } catch (seedErr) {
      console.error('Failed to auto-seed local database:', seedErr);
    }
  }

  // Vite standalone server for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: false,
        port: 5173,
        proxy: {
          '/api': {
            target: `http://localhost:${PORT}`,
            changeOrigin: true,
          },
          '/uploads': {
            target: `http://localhost:${PORT}`,
            changeOrigin: true,
          },
          '/socket.io': {
            target: `http://localhost:${PORT}`,
            ws: true,
          },
        },
      },
      appType: "spa",
    });
    await vite.listen();
    console.log(`Vite frontend dev server running on http://localhost:5173`);
  } else {
    // Production asset serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create HTTP Server
  const server = http.createServer(app);

  // Initialize Socket.IO
  initSocket(server);

  server.listen(PORT, "0.0.0.0", async () => {
    const addressInfo = server.address();
    const actualPort = typeof addressInfo === "string" ? addressInfo : addressInfo?.port;
    console.log(`Backend server running on http://localhost:${actualPort}`);

    // Start SLA Overdue Check Background Job (every 30 seconds)
    try {
      const { runSlaJob } = await import('./server/modules/jobs/sla.job');
      // Run once immediately on startup
      runSlaJob().catch(console.error);
      setInterval(() => {
        runSlaJob().catch(console.error);
      }, 30000);
      console.log('Background SLA Overdue Job started.');
    } catch (jobErr) {
      console.error('Failed to start background SLA Overdue Job:', jobErr);
    }
  });
}

startServer().catch(console.error);