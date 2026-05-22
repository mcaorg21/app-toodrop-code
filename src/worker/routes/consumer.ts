import { Hono } from "hono";
// import { unifiedAuthMiddleware } from "@getmocha/users-service/backend";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { CreateDropTagInputSchema } from "@/shared/types";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import { calculateDistance } from "../utils";

const consumer = new Hono<{ Bindings: Env }>();

// Helper to get user query based on auth type (same pattern as profile.ts)
function getUserQuery(c: any): { field: string; value: any; email: string | null } | null {
  const user = c.get("user") as any;
  if (!user) return null;
  
  if (user.isEmailAuth) {
    return { 
      field: "email_credential_id", 
      value: user.emailCredentialId,
      email: user.email || null
    };
  }
  return { 
    field: "mocha_user_id", 
    value: user.id,
    email: user.email || null
  };
}

// Get nearby active hubs for an address
consumer.get("/droptags/nearby-hubs/:addressId", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const addressId = c.req.param("addressId");
    const maxDistance = parseInt(c.req.query("maxDistance") || "1000", 10);

    const user = await c.env.DB.prepare(
      `SELECT id FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first();

    if (!user) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    const address = await c.env.DB.prepare(
      "SELECT * FROM addresses WHERE id = ? AND user_id = ? AND address_type = 'consumer'"
    ).bind(addressId, user.id).first();

    if (!address) {
      return c.json({ error: "Endereço não encontrado" }, 404);
    }

    if (!address.latitude || !address.longitude) {
      return c.json({ error: "Endereço sem coordenadas" }, 400);
    }

    const { results: activeHubs } = await c.env.DB.prepare(
      "SELECT * FROM receiver_point_status WHERE is_active = 1 AND active_hub = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL"
    ).all();

    const nearbyHubs = [];
    for (const hub of activeHubs) {
      if (!hub.latitude || !hub.longitude) continue;

      const distance = calculateDistance(
        Number(address.latitude),
        Number(address.longitude),
        Number(hub.latitude),
        Number(hub.longitude)
      );

      if (distance <= maxDistance) {
        const receiverAddress = await c.env.DB.prepare(
          "SELECT * FROM addresses WHERE receiver_key = ?"
        ).bind(hub.receiver_key).first();

        if (receiverAddress) {
          const receiverUser = await c.env.DB.prepare(
            "SELECT full_name FROM users WHERE id = ?"
          ).bind(receiverAddress.user_id).first();

          nearbyHubs.push({
            id: receiverAddress.id,
            receiver_key: hub.receiver_key,
            name: receiverUser?.full_name || "Recebedor",
            distance: Math.round(distance),
            address: `${receiverAddress.street}, ${receiverAddress.number} - ${receiverAddress.neighborhood}`,
            city: receiverAddress.city,
            state: receiverAddress.state,
            rating: 4.8,
            deliveries: 0,
            last_active: hub.updated_at,
            service_price: (hub as any).service_price ?? 10,
          });
        }
      }
    }

    nearbyHubs.sort((a, b) => a.distance - b.distance);
    const limitedHubs = nearbyHubs.slice(0, 20);

    return c.json(limitedHubs);
  } catch (error) {
    console.error("Error fetching nearby hubs:", error);
    return c.json({ error: "Erro ao buscar hubs próximos" }, 500);
  }
});

// Get all droptags for user
consumer.get("/droptags", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT d.*, 
            u.full_name as receiver_name,
            u.phone as receiver_phone,
            a.street as receiver_street,
            a.number as receiver_number,
            a.neighborhood as receiver_neighborhood,
            a.city as receiver_city,
            a.state as receiver_state,
            a.complement as receiver_complement,
            dd.selected_receiver_key as receiver_key
     FROM droptags d 
     LEFT JOIN users u ON d.receiver_user_id = u.id 
     LEFT JOIN addresses a ON a.user_id = d.receiver_user_id AND a.address_type = 'receiver'
     LEFT JOIN driver_deliveries dd ON d.id = dd.droptag_id
     WHERE d.consumer_user_id = ? 
     ORDER BY d.created_at DESC`
  ).bind(user.id).all();

  // Format receiver address
  const formattedResults = results.map((d: any) => ({
    ...d,
    receiver_address: d.receiver_street && d.receiver_number 
      ? `${d.receiver_street}, ${d.receiver_number}` 
      : null,
  }));

  return c.json(formattedResults);
});

// Create new droptag
consumer.post("/droptags", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  
  const parsed = CreateDropTagInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map(e => e.message).join(", ");
    return c.json({ error: errorMessage }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user || !user.is_consumer_active) {
    return c.json({ error: "Perfil de consumidor não habilitado" }, 403);
  }

  const uuid = randomUUID();
  const qrCodeData = JSON.stringify({
    uuid,
    tracking_code: parsed.data.tracking_code || "",
    timestamp: new Date().toISOString(),
  });

  const { title, tracking_code, address_id, secret_word, notes } = parsed.data;

  const address = await c.env.DB.prepare(
    "SELECT id FROM addresses WHERE id = ? AND user_id = ? AND address_type = 'consumer'"
  ).bind(address_id, user.id).first();

  if (!address) {
    return c.json({ error: "Endereço inválido ou não pertence ao usuário" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO droptags 
     (uuid, consumer_user_id, title, tracking_code, address_id, secret_word, notes, status, qr_code_data) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(uuid, user.id, title, tracking_code || "", address_id, secret_word || null, notes || null, "created", qrCodeData).run();

  const droptag = await c.env.DB.prepare(
    "SELECT * FROM droptags WHERE uuid = ?"
  ).bind(uuid).first();

  if (!droptag) {
    return c.json({ error: "Erro ao criar DropTag" }, 500);
  }

  if (parsed.data.authorized_receivers && parsed.data.authorized_receivers.length > 0) {
    for (const receiverKey of parsed.data.authorized_receivers) {
      await c.env.DB.prepare(
        `INSERT INTO droptag_authorized_receivers (droptag_id, receiver_key) VALUES (?, ?)`
      ).bind(droptag.id, receiverKey).run();
    }
  }

  return c.json(droptag);
});

// Get droptag QR code
consumer.get("/droptags/:uuid/qrcode", async (c) => {
  const uuid = c.req.param("uuid");

  const droptag = await c.env.DB.prepare(
    "SELECT qr_code_data FROM droptags WHERE uuid = ?"
  ).bind(uuid).first();

  if (!droptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  const qrCodeDataUrl = await QRCode.toDataURL(String(droptag.qr_code_data));

  return c.json({ qrCodeDataUrl });
});

// Get authorized receivers for a droptag
consumer.get("/droptags/:id/authorized-receivers", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const droptag = await c.env.DB.prepare(
    "SELECT id, address_id FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  const consumerAddress = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE id = ?"
  ).bind(droptag.address_id).first();

  if (!consumerAddress || !consumerAddress.latitude || !consumerAddress.longitude) {
    return c.json([]);
  }

  const { results: authorizedReceiverKeys } = await c.env.DB.prepare(
    "SELECT receiver_key FROM droptag_authorized_receivers WHERE droptag_id = ?"
  ).bind(droptagId).all();

  const authorizedReceivers = [];

  for (const { receiver_key } of authorizedReceiverKeys) {
    const pointStatus = await c.env.DB.prepare(
      "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
    ).bind(receiver_key).first();

    if (!pointStatus) continue;

    const receiverAddress = await c.env.DB.prepare(
      "SELECT * FROM addresses WHERE receiver_key = ?"
    ).bind(receiver_key).first();

    if (!receiverAddress) continue;

    const receiverUser = await c.env.DB.prepare(
      "SELECT full_name FROM users WHERE id = ?"
    ).bind(receiverAddress.user_id).first();

    let distance = 0;
    if (pointStatus.latitude && pointStatus.longitude) {
      distance = calculateDistance(
        Number(consumerAddress.latitude),
        Number(consumerAddress.longitude),
        Number(pointStatus.latitude),
        Number(pointStatus.longitude)
      );
    }

    authorizedReceivers.push({
      receiver_key: receiver_key,
      name: receiverUser?.full_name || "Recebedor",
      distance: Math.round(distance),
      address: `${receiverAddress.street}, ${receiverAddress.number} - ${receiverAddress.neighborhood}`,
      city: receiverAddress.city,
      state: receiverAddress.state,
      rating: 4.8,
      deliveries: 0,
      is_active: pointStatus.is_active,
      active_hub: pointStatus.active_hub,
      service_price: pointStatus.service_price ?? 10,
    });
  }

  authorizedReceivers.sort((a, b) => a.distance - b.distance);

  return c.json(authorizedReceivers);
});

// Update droptag
consumer.put("/droptags/:id", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const droptagId = c.req.param("id");
  const body = await c.req.json();

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existingDroptag = await c.env.DB.prepare(
    "SELECT * FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!existingDroptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  if (existingDroptag.status !== "created") {
    return c.json({ error: "Não é possível editar DropTag após estar em trânsito" }, 400);
  }

  const { title, tracking_code, address_id, secret_word, notes } = body;

  if (address_id) {
    const address = await c.env.DB.prepare(
      "SELECT id FROM addresses WHERE id = ? AND user_id = ? AND address_type = 'consumer'"
    ).bind(address_id, user.id).first();

    if (!address) {
      return c.json({ error: "Endereço inválido ou não pertence ao usuário" }, 400);
    }
  }

  await c.env.DB.prepare(
    `UPDATE droptags 
     SET title = COALESCE(?, title),
         tracking_code = ?,
         address_id = COALESCE(?, address_id),
         secret_word = ?,
         notes = ?,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND consumer_user_id = ?`
  ).bind(
    title || null,
    tracking_code !== undefined ? (tracking_code || "") : null,
    address_id || null, 
    secret_word !== undefined ? (secret_word || null) : null,
    notes !== undefined ? (notes || null) : null,
    droptagId, 
    user.id
  ).run();

  if (body.authorized_receivers) {
    await c.env.DB.prepare(
      "DELETE FROM droptag_authorized_receivers WHERE droptag_id = ?"
    ).bind(droptagId).run();

    for (const receiverKey of body.authorized_receivers) {
      await c.env.DB.prepare(
        `INSERT INTO droptag_authorized_receivers (droptag_id, receiver_key) VALUES (?, ?)`
      ).bind(droptagId, receiverKey).run();
    }
  }

  const droptag = await c.env.DB.prepare(
    "SELECT * FROM droptags WHERE id = ?"
  ).bind(droptagId).first();

  return c.json(droptag);
});

// Delete droptag
consumer.delete("/droptags/:id", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const droptagId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const existingDroptag = await c.env.DB.prepare(
    "SELECT status FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!existingDroptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  if (existingDroptag.status !== "created") {
    return c.json({ error: "Não é possível deletar DropTag após estar em trânsito" }, 400);
  }

  await c.env.DB.prepare(
    "DELETE FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).run();

  return c.json({ success: true });
});

// Get service price from receiver_deliveries for a droptag
consumer.get("/droptags/:id/service-price", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const droptag = await c.env.DB.prepare(
    "SELECT id FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  // Get service_price from receiver_deliveries for this droptag
  const receiverDelivery = await c.env.DB.prepare(
    "SELECT service_price FROM receiver_deliveries WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(droptagId).first();

  return c.json({ 
    service_price: receiverDelivery?.service_price ?? 10 
  });
});

// Get droptag timeline/history
consumer.get("/droptags/:id/timeline", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const droptag = await c.env.DB.prepare(
    "SELECT * FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag not found" }, 404);
  }

  // Get delivery scans
  const { results: scans } = await c.env.DB.prepare(`
    SELECT ds.*, 
      from_user.full_name as from_user_name,
      to_user.full_name as to_user_name
    FROM delivery_scans ds
    LEFT JOIN users from_user ON ds.from_user_id = from_user.id
    LEFT JOIN users to_user ON ds.to_user_id = to_user.id
    WHERE ds.droptag_id = ?
    ORDER BY ds.scanned_at ASC
  `).bind(droptagId).all();

  // Get driver delivery info
  const driverDelivery = await c.env.DB.prepare(`
    SELECT dd.*, u.full_name as driver_name
    FROM driver_deliveries dd
    LEFT JOIN users u ON dd.driver_user_id = u.id
    WHERE dd.droptag_id = ?
    ORDER BY dd.created_at DESC LIMIT 1
  `).bind(droptagId).first();

  // Get receiver delivery info
  const receiverDelivery = await c.env.DB.prepare(`
    SELECT rd.*, u.full_name as receiver_name
    FROM receiver_deliveries rd
    LEFT JOIN users u ON rd.receiver_user_id = u.id
    WHERE rd.droptag_id = ?
    ORDER BY rd.created_at DESC LIMIT 1
  `).bind(droptagId).first();

  // Get payment info
  const payment = await c.env.DB.prepare(`
    SELECT * FROM asaas_charges WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1
  `).bind(droptagId).first();

  // Build timeline events
  const events: any[] = [];

  // 1. Created event
  events.push({
    type: 'created',
    title: 'DropTag criada',
    description: `Você criou a DropTag "${droptag.title || 'Sem título'}"`,
    timestamp: droptag.created_at,
    icon: 'package'
  });

  // 2. Delivery scans events
  for (const scan of scans) {
    let title = '';
    let description = '';
    let icon = 'scan';

    if (scan.scan_type === 'driver_pickup') {
      title = 'Coletada pelo entregador';
      description = `${scan.from_user_name || 'Entregador'} coletou sua encomenda`;
      icon = 'truck';
    } else if (scan.scan_type === 'driver_to_receiver') {
      title = 'Entregue ao ponto';
      description = `Entregue a ${scan.to_user_name || 'ponto de recebimento'}`;
      icon = 'home';
    } else if (scan.scan_type === 'consumer_pickup') {
      title = 'Retirada pelo consumidor';
      description = 'Você retirou sua encomenda';
      icon = 'check';
    }

    if (title) {
      events.push({
        type: 'scan',
        scan_type: scan.scan_type,
        title,
        description,
        timestamp: scan.scanned_at,
        icon,
        photo_url: scan.photo_url
      });
    }
  }

  // 3. Driver delivery events
  if (driverDelivery) {
    if (driverDelivery.status === 'in_transit') {
      events.push({
        type: 'driver_in_transit',
        title: 'Em trânsito',
        description: `${driverDelivery.driver_name || 'Entregador'} está transportando`,
        timestamp: driverDelivery.picked_up_at || driverDelivery.created_at,
        icon: 'truck'
      });
    }
    if (driverDelivery.delivered_at) {
      events.push({
        type: 'driver_delivered',
        title: 'Entregue ao ponto',
        description: `Entregue por ${driverDelivery.driver_name || 'entregador'}${receiverDelivery?.receiver_name ? ` para ${receiverDelivery.receiver_name}` : ''}`,
        timestamp: driverDelivery.delivered_at,
        icon: 'home'
      });
    }
  }

  // 4. Receiver delivery events
  if (receiverDelivery) {
    if (receiverDelivery.status === 'awaiting_pickup' || receiverDelivery.status === 'at_receiver') {
      events.push({
        type: 'at_receiver',
        title: 'Aguardando retirada',
        description: `Recebido por ${receiverDelivery.receiver_name || 'ponto de recebimento'} e disponível para retirada`,
        timestamp: receiverDelivery.received_at,
        icon: 'clock'
      });
    }
    if (receiverDelivery.picked_up_at) {
      events.push({
        type: 'picked_up',
        title: 'Retirada pelo consumidor',
        description: 'Você retirou sua encomenda',
        timestamp: receiverDelivery.picked_up_at,
        icon: 'check'
      });
    }
  }

  // 5. Payment event
  if (payment && payment.status === 'paid') {
    events.push({
      type: 'payment',
      title: 'Pagamento confirmado',
      description: `R$ ${Number(payment.value).toFixed(2).replace('.', ',')} via ${payment.billing_type === 'PIX' ? 'PIX' : 'Cartão'}`,
      timestamp: payment.paid_at,
      icon: 'credit-card'
    });
  }

  // 6. Completed event
  if (droptag.status === 'completed') {
    events.push({
      type: 'completed',
      title: 'Entrega concluída',
      description: 'Todo o processo foi finalizado com sucesso!',
      timestamp: droptag.updated_at,
      icon: 'check-circle'
    });
  }

  // Sort by timestamp and remove duplicates
  const sortedEvents = events
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .filter((event, index, self) => 
      index === self.findIndex(e => e.type === event.type && e.title === event.title)
    );

  return c.json({
    droptag: {
      id: droptag.id,
      title: droptag.title,
      status: droptag.status,
      created_at: droptag.created_at
    },
    events: sortedEvents
  });
});

export default consumer;
