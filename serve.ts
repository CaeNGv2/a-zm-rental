// server.ts
import { join } from "path";

const PORT = parseInt(process.env.PORT || "3001", 10);

const DIST_DIR = "website";

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let targetPath = join(process.cwd(), DIST_DIR, url.pathname);

    // Default index
    if (url.pathname.endsWith("/")) {
      for (const defaultFile of ["index.html"]) {
        const checkPath = join(targetPath, defaultFile);
        if (await Bun.file(checkPath).exists()) {
          // point target to index file
          targetPath = checkPath;
          break;
        }
      }
    }

    // Resolve and verify file requested
    const file = Bun.file(targetPath);
    if (await file.exists()) {
      return new Response(file);
    }

    // Fallback routing (404)
    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`🚀 Native Bun server running at http://localhost:${PORT}`);
