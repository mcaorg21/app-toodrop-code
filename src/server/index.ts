import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "fs";
import { join } from "path";
import workerApp from "../worker/index";
import { db } from "./db";
import { createEmailService } from "./email";
import { createStorageService } from "./storage";

const emailService = createEmailService();
const storageService = createStorageService();

const app = new Hono<{ Bindings: Env }>();

// Health check (before env injection so it always responds)
app.get("/health", (c) => c.json({ status: "ok" }));

// Inject bindings into c.env for all requests
app.use("*", async (c, next) => {
  (c as any).env = {
    DB: db,
    R2_BUCKET: storageService,
    EMAILS: emailService,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "changeme",
    GOOGLE_CLOUD_VISION_API_KEY: process.env.GOOGLE_CLOUD_VISION_API_KEY ?? "",
    ASAAS_API_KEY_PRODUCAO: process.env.ASAAS_API_KEY_PRODUCAO ?? "",
    ADMIN_KEY: process.env.ADMIN_KEY ?? "",
  };
  await next();
});

// Mount all API + Worker routes
app.route("/", workerApp);

// Serve built frontend static files
app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback: return index.html for unmatched routes
app.get("*", (c) => {
  try {
    const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf8");
    return c.html(html);
  } catch {
    return c.text("App not built. Run: npm run build:client", 503);
  }
});

const port = parseInt(process.env.PORT ?? "3000", 10);
console.log(`[Server] Starting on port ${port}`);

serve({ fetch: app.fetch, port });
