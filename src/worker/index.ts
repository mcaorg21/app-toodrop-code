import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth";
import emailAuth from "./routes/email-auth";
import profile from "./routes/profile";
import addresses from "./routes/addresses";
import consumer from "./routes/consumer";
import receiver from "./routes/receiver";
import delivery from "./routes/delivery";
import admin from "./routes/admin";
import payments from "./routes/payments";
import withdrawals from "./routes/withdrawals";
import referrals from "./routes/referrals";
import { deactivateInactiveHubs } from "./utils";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({
  origin: "*",
  credentials: true,
}));

// Mount route modules
app.route("/api", auth);
app.route("/api", emailAuth);
app.route("/api/profile", profile);
app.route("/api/addresses", addresses);
app.route("/api", consumer);
app.route("/api/receiver", receiver);
app.route("/api/delivery", delivery);
app.route("/api/admin", admin);
app.route("/api/payments", payments);
app.route("/api/withdrawals", withdrawals);
app.route("/api/referrals", referrals);

// Manual trigger endpoint for deactivating inactive hubs
app.get("/api/admin/deactivate-inactive-hubs", async (c) => {
  const key = c.req.query("key");
  
  if (key !== "3877813238912739838283728") {
    return c.json({ error: "Unauthorized - invalid key" }, 401);
  }
  
  const result = await deactivateInactiveHubs(c.env);
  return c.json(result);
});

// Hub location update endpoint (for Toodrop HUB app)
app.post("/api/hub/location", async (ctx) => {
  let requestData: any = {};
  let responseData: any = {};
  
  try {
    const body = await ctx.req.json();
    
    const { receiver_key, latitude, longitude, timestamp } = body;
    requestData = { receiver_key, latitude, longitude, timestamp };

    console.log("[Hub Location] Received request:", { receiver_key, latitude, longitude, timestamp });

    if (!receiver_key || typeof latitude !== "number" || typeof longitude !== "number" || !timestamp) {
      console.log("[Hub Location] Invalid data provided");
      responseData = { error: "Dados inválidos" };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(receiver_key || null, latitude || null, longitude || null, timestamp || null, 400, "Dados inválidos").run();
      
      return ctx.json(responseData, 400);
    }

    const pointStatus = await ctx.env.DB.prepare(
      "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
    ).bind(receiver_key).first();

    if (!pointStatus) {
      responseData = { 
        error: "Ponto não encontrado",
        details: "Este ponto de recebimento não está registrado no sistema. Entre em contato com o suporte.",
        receiver_key 
      };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(receiver_key, latitude, longitude, timestamp, 404, "Ponto não encontrado").run();
      
      return ctx.json(responseData, 404);
    }

    if (!pointStatus.is_active) {
      responseData = { 
        error: "Ponto não está aprovado pela plataforma",
        details: "Este ponto de recebimento ainda não foi aprovado. Aguarde a aprovação do administrador."
      };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(receiver_key, latitude, longitude, timestamp, 403, "Ponto não aprovado pela plataforma").run();
      
      return ctx.json(responseData, 403);
    }

    if (!pointStatus.latitude || !pointStatus.longitude) {
      responseData = { 
        error: "Coordenadas do ponto não cadastradas",
        details: "Este ponto não possui coordenadas registradas. Entre em contato com o suporte."
      };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(receiver_key, latitude, longitude, timestamp, 400, "Coordenadas não cadastradas").run();
      
      return ctx.json(responseData, 400);
    }

    const R = 6371000;
    const φ1 = Number(pointStatus.latitude) * Math.PI / 180;
    const φ2 = latitude * Math.PI / 180;
    const Δφ = (latitude - Number(pointStatus.latitude)) * Math.PI / 180;
    const Δλ = (longitude - Number(pointStatus.longitude)) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const distCalc = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * distCalc;

    if (distance <= 200) {
      await ctx.env.DB.prepare(
        `UPDATE receiver_point_status 
         SET active_hub = 1, last_ping = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE receiver_key = ?`
      ).bind(timestamp, receiver_key).run();

      responseData = { 
        success: true, 
        active: true, 
        distance: Math.round(distance),
        message: "Hub ativado com sucesso" 
      };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_active, response_distance, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)`
      ).bind(receiver_key, latitude, longitude, timestamp, Math.round(distance), 200, "Hub ativado com sucesso").run();

      return ctx.json(responseData, 200);
    } else {
      await ctx.env.DB.prepare(
        `UPDATE receiver_point_status 
         SET active_hub = 0, last_ping = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE receiver_key = ?`
      ).bind(timestamp, receiver_key).run();

      responseData = { 
        success: false, 
        active: false, 
        distance: Math.round(distance),
        message: "Erro ao ativar ponto! Você está longe do seu local aprovado para recebimento" 
      };
      
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_active, response_distance, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`
      ).bind(receiver_key, latitude, longitude, timestamp, Math.round(distance), 401, "Fora do raio permitido").run();

      return ctx.json(responseData, 401);
    }
  } catch (error) {
    console.error("[Hub Location] Error:", error);
    responseData = { 
      error: "Erro interno ao processar localização",
      details: error instanceof Error ? error.message : String(error)
    };
    
    try {
      await ctx.env.DB.prepare(
        `INSERT INTO hub_location_logs 
         (receiver_key, request_latitude, request_longitude, request_timestamp, response_success, response_status_code, response_message) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`
      ).bind(
        requestData.receiver_key || null, 
        requestData.latitude || null, 
        requestData.longitude || null, 
        requestData.timestamp || null, 
        500, 
        error instanceof Error ? error.message : String(error)
      ).run();
    } catch (logError) {
      console.error("[Hub Location] Error logging to database:", logError);
    }
    
    return ctx.json(responseData, 500);
  }
});

// Export both HTTP handler and scheduled handler
export default {
  fetch: app.fetch,
  
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("[Cron] Scheduled event triggered");
    ctx.waitUntil(deactivateInactiveHubs(env));
  },
};
