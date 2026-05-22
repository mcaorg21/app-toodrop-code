// Receiver point status endpoints
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<{ Bindings: Env }>();

// Get receiver point status
app.get("/api/receiver/point-status", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, is_receiver_active FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não ativo" }, 403);
  }

  // Get receiver key
  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address || !address.receiver_key) {
    return c.json({ error: "Chave do ponto não encontrada" }, 404);
  }

  // Get status
  const status = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(address.receiver_key).first();

  if (!status) {
    return c.json({
      receiver_key: address.receiver_key,
      is_active: false,
    });
  }

  return c.json(status);
});

// Update receiver point status
app.post("/api/receiver/point-status", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { is_active } = body;

  if (typeof is_active !== "boolean") {
    return c.json({ error: "is_active deve ser um boolean" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT id, is_receiver_active FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não ativo" }, 403);
  }

  // Get receiver key
  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address || !address.receiver_key) {
    return c.json({ error: "Chave do ponto não encontrada" }, 404);
  }

  // Update or insert status
  await c.env.DB.prepare(
    `INSERT INTO receiver_point_status (receiver_key, is_active, updated_at) 
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(receiver_key) DO UPDATE SET is_active = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(address.receiver_key, is_active ? 1 : 0, is_active ? 1 : 0).run();

  const status = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(address.receiver_key).first();

  return c.json(status);
});

// Admin endpoint to get all active receiver points
app.get("/api/admin/active-receiver-points", authMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const admin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(mochaUser.id).first();

  if (!admin) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE is_active = 1 ORDER BY updated_at DESC"
  ).all();

  return c.json(results);
});

export default app;
