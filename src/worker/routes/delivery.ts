import { Hono } from "hono";
// authMiddleware kept for reference but not used - using unifiedAuthMiddleware instead
import { unifiedAuthMiddleware } from "../middleware/auth";
import { calculateDistance } from "../utils";
// Removed: import { createAsaasSubconta } from "../utils/asaas-helpers";

const delivery = new Hono<{ Bindings: Env }>();

// Helper to get user query field based on auth type
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

// Delivery driver location update
delivery.post("/location", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { latitude, longitude } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return c.json({ error: "Latitude e longitude são obrigatórios" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await c.env.DB.prepare(
    `INSERT INTO delivery_driver_locations (user_id, latitude, longitude) 
     VALUES (?, ?, ?)`
  ).bind(user.id, latitude, longitude).run();

  return c.json({ success: true, latitude, longitude });
});

// Get nearby deliveries
delivery.get("/nearby-deliveries", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const latitude = parseFloat(c.req.query("latitude") || "0");
  const longitude = parseFloat(c.req.query("longitude") || "0");
  const maxDistance = parseInt(c.req.query("maxDistance") || "5000", 10);

  if (!latitude || !longitude) {
    return c.json({ error: "Latitude e longitude são obrigatórios" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const { results: droptags } = await c.env.DB.prepare(
    `SELECT d.*, a.latitude, a.longitude, a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.cep
     FROM droptags d
     INNER JOIN addresses a ON d.address_id = a.id
     WHERE d.status = 'created' AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL`
  ).all();

  const nearbyDeliveries = [];
  for (const droptag of droptags) {
    const distance = calculateDistance(
      latitude,
      longitude,
      Number(droptag.latitude),
      Number(droptag.longitude)
    );

    if (distance <= maxDistance) {
      const consumer = await c.env.DB.prepare(
        "SELECT full_name, phone FROM users WHERE id = ?"
      ).bind(droptag.consumer_user_id).first();

      nearbyDeliveries.push({
        id: droptag.id,
        uuid: droptag.uuid,
        title: droptag.title,
        tracking_code: droptag.tracking_code,
        distance: Math.round(distance),
        address: {
          street: droptag.street,
          number: droptag.number,
          complement: droptag.complement,
          neighborhood: droptag.neighborhood,
          city: droptag.city,
          state: droptag.state,
          cep: droptag.cep,
          latitude: droptag.latitude,
          longitude: droptag.longitude,
        },
        consumer: {
          name: consumer?.full_name || "Consumidor",
          phone: consumer?.phone || "",
        },
        created_at: droptag.created_at,
      });
    }
  }

  nearbyDeliveries.sort((a, b) => a.distance - b.distance);

  return c.json({
    count: nearbyDeliveries.length,
    deliveries: nearbyDeliveries,
  });
});

// Scan package
delivery.post("/scan-package", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { image, tracked_delivery_ids } = body;

    if (!image || typeof image !== "string") {
      return c.json({ error: "Imagem é obrigatória" }, 400);
    }

    if (!tracked_delivery_ids || !Array.isArray(tracked_delivery_ids) || tracked_delivery_ids.length === 0) {
      return c.json({ 
        error: "Erro ao Processar",
        message: "Nenhum pacote disponível para entrega"
      }, 400);
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${c.env.GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Data,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      return c.json({ error: 'Erro ao processar imagem com OCR' }, 500);
    }

    const visionData = await visionResponse.json() as {
      responses?: Array<{
        textAnnotations?: Array<{
          description?: string;
        }>;
      }>;
    };
    const textAnnotations = visionData.responses?.[0]?.textAnnotations;
    const extractedText = textAnnotations?.[0]?.description || '';

    console.log('[OCR] Extracted text length:', extractedText.length);

    const webhookResponse = await fetch(
      'https://primary-production-1a8e5.up.railway.app/webhook/7c97d8c1-ac29-4e8e-87d7-6ed4bed40599',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ocr_text: extractedText,
          timestamp: new Date().toISOString(),
        }),
      }
    );

    if (!webhookResponse.ok) {
      return c.json({ 
        success: false,
        error: 'Erro ao processar dados do pacote',
        message: 'Não foi possível extrair informações da etiqueta'
      }, 500);
    }

    const webhookData = await webhookResponse.json();

    if (!Array.isArray(webhookData) || webhookData.length === 0 || !webhookData[0].output) {
      return c.json({ 
        success: false,
        error: 'Formato de resposta inválido',
        message: 'Não foi possível processar os dados da etiqueta'
      }, 500);
    }

    const labelData = webhookData[0].output;

    const placeholders = tracked_delivery_ids.map(() => '?').join(',');
    const { results: droptags } = await c.env.DB.prepare(
      `SELECT d.*, a.cep, a.street, a.number, a.neighborhood, a.city, a.state, a.latitude, a.longitude,
              u.full_name as consumer_name
       FROM droptags d
       INNER JOIN addresses a ON d.address_id = a.id
       INNER JOIN users u ON d.consumer_user_id = u.id
       WHERE d.id IN (${placeholders}) AND d.status = 'created'`
    ).bind(...tracked_delivery_ids).all();

    const matchedPackages = [];
    
    for (const droptag of droptags) {
      let score = 0;
      let totalWeight = 0;
      const matchDetails: string[] = [];

      // Data: peso 1
      if (labelData.data_pacote && typeof labelData.data_pacote === 'string') {
        totalWeight += 1;
        const labelDate = new Date(labelData.data_pacote);
        const droptagDate = new Date(String(droptag.created_at));
        
        if (labelDate > droptagDate) {
          score += 1;
          matchDetails.push('data válida');
        }
      }

      // CEP: peso 1
      if (labelData.cep && droptag.cep) {
        totalWeight += 1;
        const normalizedLabelCep = String(labelData.cep).replace(/\D/g, '');
        const normalizedDroptagCep = String(droptag.cep).replace(/\D/g, '');
        
        if (normalizedLabelCep === normalizedDroptagCep) {
          score += 1;
          matchDetails.push('CEP');
        }
      }

      // Rua: peso 1
      if (labelData.logradouro && droptag.street) {
        totalWeight += 1;
        const labelStreet = String(labelData.logradouro).toLowerCase().trim();
        const droptagStreet = String(droptag.street).toLowerCase().trim();
        
        if (labelStreet.includes(droptagStreet) || droptagStreet.includes(labelStreet)) {
          score += 1;
          matchDetails.push('rua');
        }
      }

      // Bairro: peso 1
      if (labelData.bairro && droptag.neighborhood) {
        totalWeight += 1;
        const labelBairro = String(labelData.bairro).toLowerCase().trim();
        const droptagBairro = String(droptag.neighborhood).toLowerCase().trim();
        
        if (labelBairro.includes(droptagBairro) || droptagBairro.includes(labelBairro)) {
          score += 1;
          matchDetails.push('bairro');
        }
      }

      // Cidade: peso 1
      if (labelData.cidade && droptag.city) {
        totalWeight += 1;
        const labelCity = String(labelData.cidade).toLowerCase().trim();
        const droptagCity = String(droptag.city).toLowerCase().trim();
        
        if (labelCity.includes(droptagCity) || droptagCity.includes(labelCity)) {
          score += 1;
          matchDetails.push('cidade');
        }
      }

      // Estado: peso 1
      if (labelData.estado && droptag.state) {
        totalWeight += 1;
        const labelState = String(labelData.estado).toLowerCase().trim();
        const droptagState = String(droptag.state).toLowerCase().trim();
        
        if (labelState.includes(droptagState) || droptagState.includes(labelState)) {
          score += 1;
          matchDetails.push('estado');
        }
      }

      // Nome: peso 3 (peso maior)
      if (labelData.nome_completo && droptag.consumer_name) {
        totalWeight += 3;
        const labelName = String(labelData.nome_completo).toLowerCase().trim();
        const droptagName = String(droptag.consumer_name).toLowerCase().trim();
        
        if (labelData.primeiro_nome) {
          const firstName = String(labelData.primeiro_nome).toLowerCase().trim();
          if (droptagName.includes(firstName)) {
            score += 3;
            matchDetails.push('nome');
          }
        } else if (labelName.includes(droptagName) || droptagName.includes(labelName)) {
          score += 3;
          matchDetails.push('nome');
        }
      }

      // Código de rastreio: peso 3
      if (labelData.codigo_rastreio && droptag.tracking_code) {
        totalWeight += 3;
        const labelTrackingCode = String(labelData.codigo_rastreio).toUpperCase().trim();
        const droptagTrackingCode = String(droptag.tracking_code).toUpperCase().trim();
        
        if (labelTrackingCode === droptagTrackingCode) {
          score += 3;
          matchDetails.push('código de rastreio');
        }
      }

      const matchPercentage = totalWeight > 0 ? (score / totalWeight) * 100 : 0;

      if (matchPercentage >= 65) {
        matchedPackages.push({
          id: droptag.id,
          uuid: droptag.uuid,
          title: droptag.title,
          tracking_code: droptag.tracking_code,
          consumer_name: droptag.consumer_name,
          address: `${droptag.street}, ${droptag.number} - ${droptag.neighborhood}, ${droptag.city}/${droptag.state}`,
          cep: droptag.cep,
          match_percentage: Math.round(matchPercentage),
          match_details: matchDetails,
        });
      }
    }

    matchedPackages.sort((a, b) => b.match_percentage - a.match_percentage);

    if (matchedPackages.length === 0) {
      return c.json({ 
        success: false,
        error: 'Pacote não encontrado',
        message: 'Nenhum pacote com os dados fornecidos pela etiqueta foi encontrado nessa região',
        label_data: labelData
      }, 404);
    }

    // Create Asaas subconta for driver on their first successful scan (if they don't have one)
    const driverUser = await c.env.DB.prepare(
      `SELECT * FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first() as any;

    if (driverUser && !driverUser.asaas_wallet_id && driverUser.commission_cep && driverUser.commission_street) {
      // Subconta creation removed - no longer using Asaas wallets for commission splits
    }

    return c.json({ 
      success: true, 
      message: `Pacote encontrado! ${matchedPackages[0].match_percentage}% de compatibilidade`,
      package: matchedPackages[0],
      total_matches: matchedPackages.length
    });
  } catch (error) {
    return c.json({ 
      error: 'Erro ao processar pacote',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get nearby receivers for a droptag
delivery.get("/nearby-receivers/:droptagId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("droptagId");

  const droptag = await c.env.DB.prepare(
    `SELECT d.*, a.latitude, a.longitude, a.street, a.number, a.neighborhood, a.city, a.state
     FROM droptags d
     INNER JOIN addresses a ON d.address_id = a.id
     WHERE d.id = ?`
  ).bind(droptagId).first() as any;

  if (!droptag) {
    return c.json({ error: "Pacote não encontrado" }, 404);
  }

  if (!droptag.latitude || !droptag.longitude) {
    return c.json({ error: "Endereço sem coordenadas" }, 400);
  }

  const { results: authorizedReceiverKeys } = await c.env.DB.prepare(
    "SELECT receiver_key FROM droptag_authorized_receivers WHERE droptag_id = ?"
  ).bind(droptagId).all();

  if (!authorizedReceiverKeys || authorizedReceiverKeys.length === 0) {
    return c.json({
      droptag: {
        id: droptag.id,
        title: droptag.title,
        tracking_code: droptag.tracking_code,
        destination: `${droptag.street}, ${droptag.number} - ${droptag.neighborhood}, ${droptag.city}/${droptag.state}`,
        has_secret_word: !!droptag.secret_word,
      },
      receivers: [],
    });
  }

  const nearbyReceivers = [];
  for (const { receiver_key } of authorizedReceiverKeys) {
    
    const receiverStatus = await c.env.DB.prepare(
      `SELECT * FROM receiver_point_status 
       WHERE receiver_key = ? AND is_active = 1 AND active_hub = 1 
       AND latitude IS NOT NULL AND longitude IS NOT NULL`
    ).bind(receiver_key).first() as any;

    if (!receiverStatus) {
      continue;
    }

    const distance = calculateDistance(
      Number(droptag.latitude),
      Number(droptag.longitude),
      Number(receiverStatus.latitude),
      Number(receiverStatus.longitude)
    );

    const receiverAddress = await c.env.DB.prepare(
      "SELECT * FROM addresses WHERE receiver_key = ? AND address_type = 'receiver'"
    ).bind(receiver_key).first();

    if (!receiverAddress) {
      continue;
    }

    const receiverUser = await c.env.DB.prepare(
      "SELECT full_name, phone, driver_commission_percent FROM users WHERE id = ?"
    ).bind(receiverAddress.user_id).first() as any;

    if (!receiverUser) {
      continue;
    }

    const servicePrice = receiverStatus.service_price ?? 10;
    const driverCommissionPercent = receiverUser.driver_commission_percent ?? 20;
    const driverEarning = (servicePrice * driverCommissionPercent) / 100;

    nearbyReceivers.push({
      receiver_key: receiver_key,
      name: receiverUser.full_name,
      phone: receiverUser.phone,
      distance: Math.round(distance),
      address: `${receiverAddress.street}, ${receiverAddress.number}`,
      complement: receiverAddress.complement || null,
      neighborhood: receiverAddress.neighborhood,
      city: receiverAddress.city,
      state: receiverAddress.state,
      cep: receiverAddress.cep,
      latitude: Number(receiverStatus.latitude),
      longitude: Number(receiverStatus.longitude),
      last_ping: receiverStatus.last_ping,
      driver_earning: driverEarning,
    });
  }

  nearbyReceivers.sort((a, b) => a.distance - b.distance);

  return c.json({
    droptag: {
      id: droptag.id,
      title: droptag.title,
      tracking_code: droptag.tracking_code,
      destination: `${droptag.street}, ${droptag.number} - ${droptag.neighborhood}, ${droptag.city}/${droptag.state}`,
      has_secret_word: !!droptag.secret_word,
    },
    receivers: nearbyReceivers,
  });
});

// Get driver's deliveries
delivery.get("/my-deliveries", unifiedAuthMiddleware, async (c) => {
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

  // Optimized single query with JOINs instead of N+1 queries
  // Join with receiver via selected_receiver_key to get the correct TooDroper info
  const { results: deliveries } = await c.env.DB.prepare(
    `SELECT 
       dd.id,
       dd.droptag_id,
       dd.picked_up_at,
       dd.status,
       dd.sub_status,
       dd.delivered_at,
       dd.service_price,
       dd.commission_percent,
       dd.commission_amount,
       dd.selected_receiver_key,
       d.uuid,
       d.title,
       d.tracking_code,
       d.notes,
       consumer.full_name as consumer_name,
       addr.street as consumer_street,
       addr.number as consumer_number,
       addr.neighborhood as consumer_neighborhood,
       receiver_addr.user_id as receiver_user_id,
       receiver.full_name as receiver_name,
       receiver.phone as receiver_phone,
       receiver_addr.street as receiver_street,
       receiver_addr.number as receiver_number,
       receiver_addr.complement as receiver_complement,
       receiver_addr.neighborhood as receiver_neighborhood,
       receiver_addr.city as receiver_city
     FROM driver_deliveries dd
     INNER JOIN droptags d ON dd.droptag_id = d.id
     LEFT JOIN users consumer ON d.consumer_user_id = consumer.id
     LEFT JOIN addresses addr ON d.address_id = addr.id
     LEFT JOIN addresses receiver_addr ON dd.selected_receiver_key = receiver_addr.receiver_key
     LEFT JOIN users receiver ON receiver_addr.user_id = receiver.id
     WHERE dd.driver_user_id = ?
     ORDER BY dd.created_at DESC`
  ).bind(user.id).all();

  const formattedDeliveries = deliveries.map((delivery: any) => ({
    id: delivery.id,
    tracking_code: delivery.tracking_code,
    consumer_name: delivery.consumer_name || 'Consumidor não encontrado',
    picked_up_at: delivery.picked_up_at,
    status: delivery.status,
    sub_status: delivery.sub_status,
    title: delivery.title,
    destination: delivery.consumer_street 
      ? `${delivery.consumer_street}, ${delivery.consumer_number} - ${delivery.consumer_neighborhood}` 
      : 'Endereço não encontrado',
    delivered_at: delivery.delivered_at,
    service_price: delivery.service_price,
    commission_percent: delivery.commission_percent,
    commission_amount: delivery.commission_amount,
    receiver_name: delivery.receiver_name || null,
    receiver_address: delivery.receiver_street
      ? `${delivery.receiver_street}, ${delivery.receiver_number}${delivery.receiver_complement ? ' - ' + delivery.receiver_complement : ''} - ${delivery.receiver_neighborhood}, ${delivery.receiver_city}`
      : null,
    receiver_phone: delivery.receiver_phone || null,
    notes: delivery.notes || null,
  }));

  return c.json(formattedDeliveries);
});

// Activate receiver point - called when driver generates QR code
delivery.post("/activate-receiver-point", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { droptag_id, receiver_key } = body;

  if (!droptag_id || !receiver_key) {
    return c.json({ error: "droptag_id e receiver_key são obrigatórios" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify receiver_key is authorized for this droptag
  const authorized = await c.env.DB.prepare(
    "SELECT * FROM droptag_authorized_receivers WHERE droptag_id = ? AND receiver_key = ?"
  ).bind(droptag_id, receiver_key).first();

  if (!authorized) {
    return c.json({ error: "Ponto de entrega não autorizado" }, 403);
  }

  // Check if driver already has this droptag in_transit
  let driverDelivery = await c.env.DB.prepare(
    `SELECT * FROM driver_deliveries 
     WHERE driver_user_id = ? AND droptag_id = ? AND status = 'in_transit'`
  ).bind(user.id, droptag_id).first() as { id: number } | null;

  if (!driverDelivery) {
    // Create driver_deliveries record with in_transit status
    // This is the first time the driver is activating delivery for this droptag
    await c.env.DB.prepare(
      `INSERT INTO driver_deliveries (driver_user_id, droptag_id, status, sub_status, selected_receiver_key, picked_up_at, created_at, updated_at)
       VALUES (?, ?, 'in_transit', 'qr_generated', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(user.id, droptag_id, receiver_key).run();
    
    console.log('[ACTIVATE] Created new driver_deliveries record with in_transit status for droptag:', droptag_id);
    
    // Generate QR data for receiver to scan
    const qrData = JSON.stringify({
      receiver_key: receiver_key,
      droptag_id: droptag_id,
      driver_user_id: user.id,
    });
    
    return c.json({ success: true, created: true, qr_data: qrData });
  }

  // Update existing driver_delivery with selected receiver and clear wrong receiver scan
  await c.env.DB.prepare(
    `UPDATE driver_deliveries 
     SET selected_receiver_key = ?, sub_status = 'qr_generated', wrong_receiver_scan_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(receiver_key, driverDelivery.id).run();

  // Generate QR data for receiver to scan
  const qrData = JSON.stringify({
    receiver_key: receiver_key,
    droptag_id: droptag_id,
    driver_user_id: user.id,
  });

  return c.json({ success: true, qr_data: qrData });
});

// Get pending secret word validation - driver polls this to see if receiver scanned QR
delivery.get("/pending-secret-word", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first() as { id: number } | null;

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  console.log('[SECRET_WORD] pending-secret-word: Checking for driver_user_id:', user.id);
  
  // Debug: Check all driver_deliveries for this driver
  const allDD = await c.env.DB.prepare(
    `SELECT id, droptag_id, status, sub_status FROM driver_deliveries WHERE driver_user_id = ?`
  ).bind(user.id).all();
  console.log('[SECRET_WORD] pending-secret-word: All driver_deliveries for this user:', allDD.results);
  
  // Find delivery awaiting secret word validation
  const pending = await c.env.DB.prepare(
    `SELECT dd.id, dd.droptag_id, dd.selected_receiver_key, d.secret_word, d.title, d.tracking_code,
            u.full_name as receiver_name, dd.sub_status
     FROM driver_deliveries dd
     JOIN droptags d ON dd.droptag_id = d.id
     LEFT JOIN addresses a ON dd.selected_receiver_key = a.receiver_key
     LEFT JOIN users u ON a.user_id = u.id
     WHERE dd.driver_user_id = ? 
       AND dd.sub_status = 'awaiting_secret_word'
       AND dd.status = 'in_transit'
     LIMIT 1`
  ).bind(user.id).first() as {
    id: number;
    droptag_id: number;
    selected_receiver_key: string;
    secret_word: string;
    title: string;
    tracking_code: string;
    receiver_name: string | null;
  } | null;
  
  console.log('[SECRET_WORD] pending-secret-word: Found pending:', pending ? { id: pending.id, droptag_id: pending.droptag_id } : null);

  if (!pending) {
    return c.json({ pending: false });
  }

  // Get receiver user id from addresses
  const receiverAddress = await c.env.DB.prepare(
    `SELECT user_id FROM addresses WHERE receiver_key = ?`
  ).bind(pending.selected_receiver_key).first() as { user_id: number } | null;

  // Get first name only from full name
  const receiverFirstName = pending.receiver_name?.split(' ')[0] || 'Recebedor';
  
  return c.json({
    pending: true,
    droptag_id: pending.droptag_id,
    driver_user_id: user.id,
    receiver_id: receiverAddress?.user_id || null,
    receiver_key: pending.selected_receiver_key,
    receiver_nickname: receiverFirstName,
    package_title: pending.title,
    tracking_code: pending.tracking_code
  });
});

// Validate secret word (POST)
delivery.post("/pending-secret-word", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { droptag_id, secret_word } = await c.req.json();

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first() as { id: number } | null;

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  console.log('[SECRET_WORD_VALIDATE] Validating for droptag_id:', droptag_id, 'driver_user_id:', user.id);

  // Get the driver_delivery record
  const driverDelivery = await c.env.DB.prepare(
    `SELECT dd.id, dd.droptag_id, dd.driver_user_id, dd.selected_receiver_key,
            d.secret_word, d.consumer_user_id
     FROM driver_deliveries dd
     JOIN droptags d ON dd.droptag_id = d.id
     WHERE dd.driver_user_id = ? AND dd.droptag_id = ? AND dd.sub_status = 'awaiting_secret_word'
     LIMIT 1`
  ).bind(user.id, droptag_id).first() as {
    id: number;
    droptag_id: number;
    driver_user_id: number;
    selected_receiver_key: string;
    secret_word: string;
    consumer_user_id: number;
  } | null;

  if (!driverDelivery) {
    return c.json({ error: "Entrega não encontrada" }, 404);
  }

  // Get or create secret_word_attempts record
  let attemptsRecord = await c.env.DB.prepare(
    `SELECT id, failed_attempts, blocked_until FROM secret_word_attempts 
     WHERE droptag_id = ? AND driver_user_id = ?`
  ).bind(droptag_id, user.id).first() as {
    id: number;
    failed_attempts: number;
    blocked_until: string | null;
  } | null;

  if (!attemptsRecord) {
    await c.env.DB.prepare(
      `INSERT INTO secret_word_attempts (droptag_id, driver_user_id, failed_attempts, created_at, updated_at)
       VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(droptag_id, user.id).run();

    attemptsRecord = await c.env.DB.prepare(
      `SELECT id, failed_attempts, blocked_until FROM secret_word_attempts WHERE droptag_id = ? AND driver_user_id = ?`
    ).bind(droptag_id, user.id).first() as typeof attemptsRecord;
  }

  // Check if blocked
  if (attemptsRecord.blocked_until) {
    const blockedUntil = new Date(attemptsRecord.blocked_until);
    const now = new Date();
    
    if (now < blockedUntil) {
      const remainingMinutes = Math.ceil((blockedUntil.getTime() - now.getTime()) / 60000);
      return c.json({
        error: `Bloqueado por ${remainingMinutes} minuto(s)`,
        blocked_until: attemptsRecord.blocked_until,
        remaining_minutes: remainingMinutes
      }, 403);
    } else {
      // Reset block
      await c.env.DB.prepare(
        `UPDATE secret_word_attempts SET blocked_until = NULL, failed_attempts = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(attemptsRecord.id).run();
      attemptsRecord.failed_attempts = 0;
    }
  }

  // Validate secret word
  const isValid = secret_word.toUpperCase().trim() === driverDelivery.secret_word?.toUpperCase().trim();

  console.log('[SECRET_WORD_VALIDATE] Comparing:', secret_word.toUpperCase().trim(), 'vs', driverDelivery.secret_word?.toUpperCase().trim(), 'Result:', isValid);

  if (!isValid) {
    // Increment attempts
    const currentAttempts = attemptsRecord.failed_attempts + 1;
    const attemptsRemaining = 3 - currentAttempts;

    if (currentAttempts >= 3) {
      // Block for 15 minutes
      const blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await c.env.DB.prepare(
        `UPDATE secret_word_attempts SET failed_attempts = ?, blocked_until = ?, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(currentAttempts, blockedUntil, attemptsRecord.id).run();

      return c.json({
        error: "Bloqueado por 15 minutos após 3 tentativas incorretas",
        blocked_until: blockedUntil,
        remaining_minutes: 15
      }, 403);
    } else {
      // Update attempts
      await c.env.DB.prepare(
        `UPDATE secret_word_attempts SET failed_attempts = ?, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(currentAttempts, attemptsRecord.id).run();

      return c.json({
        error: "Palavra secreta incorreta",
        attempts_remaining: attemptsRemaining
      }, 400);
    }
  }

  // Success - update statuses and record commissions
  console.log('[SECRET_WORD_VALIDATE] Success! Updating statuses...');

  // Clear attempts record
  await c.env.DB.prepare(
    `UPDATE secret_word_attempts SET failed_attempts = 0, blocked_until = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(attemptsRecord.id).run();

  // Get receiver_user_id from the selected_receiver_key
  const receiverAddress = await c.env.DB.prepare(
    `SELECT user_id FROM addresses WHERE receiver_key = ?`
  ).bind(driverDelivery.selected_receiver_key).first() as { user_id: number } | null;

  // Get commission data for driver and receiver
  const driverUserCommission = await c.env.DB.prepare(
    "SELECT driver_commission_percent FROM users WHERE id = ?"
  ).bind(driverDelivery.driver_user_id).first() as { driver_commission_percent: number } | null;

  const receiverUser = await c.env.DB.prepare(
    "SELECT receiver_commission_percent FROM users WHERE id = ?"
  ).bind(receiverAddress?.user_id).first() as { receiver_commission_percent: number } | null;

  const receiverPoint = await c.env.DB.prepare(
    "SELECT service_price FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(driverDelivery.selected_receiver_key).first() as { service_price: number } | null;

  const servicePrice = receiverPoint?.service_price ?? 10.00;
  const driverCommissionPercent = driverUserCommission?.driver_commission_percent ?? 20;
  const receiverCommissionPercent = receiverUser?.receiver_commission_percent ?? 60;
  const driverCommissionAmount = (servicePrice * driverCommissionPercent) / 100;
  const receiverCommissionAmount = (servicePrice * receiverCommissionPercent) / 100;

  // Update driver_delivery to delivered with commission data
  await c.env.DB.prepare(
    `UPDATE driver_deliveries 
     SET status = 'delivered', sub_status = 'awaiting_commission', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
         service_price = ?, commission_percent = ?, commission_amount = ?
     WHERE id = ?`
  ).bind(servicePrice, driverCommissionPercent, driverCommissionAmount, driverDelivery.id).run();

  // Create or update receiver_delivery - it might not exist for secret word flow
  if (receiverAddress) {
    // Check if receiver_deliveries record exists
    const existingRD = await c.env.DB.prepare(
      `SELECT id FROM receiver_deliveries WHERE droptag_id = ? AND receiver_user_id = ?`
    ).bind(droptag_id, receiverAddress.user_id).first();

    if (existingRD) {
      // Update existing record
      await c.env.DB.prepare(
        `UPDATE receiver_deliveries 
         SET status = 'awaiting_pickup', sub_status = 'awaiting_commission', updated_at = CURRENT_TIMESTAMP
         WHERE droptag_id = ? AND receiver_user_id = ?`
      ).bind(droptag_id, receiverAddress.user_id).run();
      console.log('[SECRET_WORD_VALIDATE] Updated receiver_deliveries for user_id:', receiverAddress.user_id);
    } else {
      // Create new record (secret word flow doesn't create it during scan)
      await c.env.DB.prepare(
        `INSERT INTO receiver_deliveries (receiver_user_id, droptag_id, driver_user_id, status, sub_status, service_price, commission_percent, commission_amount, created_at, updated_at)
         VALUES (?, ?, ?, 'awaiting_pickup', 'awaiting_commission', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(receiverAddress.user_id, droptag_id, driverDelivery.driver_user_id, servicePrice, receiverCommissionPercent, receiverCommissionAmount).run();
      console.log('[SECRET_WORD_VALIDATE] Created receiver_deliveries for user_id:', receiverAddress.user_id);
    }
  } else {
    console.log('[SECRET_WORD_VALIDATE] Warning: Could not find receiver address for key:', driverDelivery.selected_receiver_key);
  }

  // Update droptag status to awaiting_pickup (consumer needs to pick up from TooDroper)
  await c.env.DB.prepare(
    `UPDATE droptags SET status = 'awaiting_pickup', receiver_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(receiverAddress?.user_id, droptag_id).run();

  console.log('[SECRET_WORD_VALIDATE] All statuses updated successfully');

  // Register commissions for driver and receiver
  console.log('[SECRET_WORD_VALIDATE] Registering commissions...');

  // Check if transactions already exist for this droptag
  const existingDriverTx = await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(driverDelivery.driver_user_id, droptag_id).first();

  const existingReceiverTx = receiverAddress?.user_id ? await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(receiverAddress.user_id, droptag_id).first() : null;

  // Create pending transaction for driver (balance updated only after payment confirmation)
  if (driverDelivery.driver_user_id && driverCommissionAmount > 0 && !existingDriverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      driverDelivery.driver_user_id,
      "commission_received",
      driverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();

    console.log(`[SECRET_WORD_VALIDATE] Driver ${driverDelivery.driver_user_id} commission R$ ${driverCommissionAmount.toFixed(2)} registered as PENDING`);
  } else if (existingDriverTx) {
    console.log(`[SECRET_WORD_VALIDATE] Driver ${driverDelivery.driver_user_id} already has transaction for droptag ${droptag_id}`);
  }

  // Create pending transaction for receiver (balance updated only after payment confirmation)
  if (receiverAddress?.user_id && receiverCommissionAmount > 0 && !existingReceiverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      receiverAddress.user_id,
      "commission_received",
      receiverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();

    console.log(`[SECRET_WORD_VALIDATE] Receiver ${receiverAddress.user_id} commission R$ ${receiverCommissionAmount.toFixed(2)} registered as pending`);
  } else if (existingReceiverTx) {
    console.log(`[SECRET_WORD_VALIDATE] Receiver ${receiverAddress?.user_id} already has transaction for droptag ${droptag_id}`);
  }

  console.log('[SECRET_WORD_VALIDATE] Commissions registered successfully');

  return c.json({ success: true, message: "Entrega confirmada com sucesso!" });
  } catch (error) {
    console.error('[SECRET_WORD_VALIDATE] Error:', error);
    return c.json({ 
      error: "Erro ao validar palavra secreta",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Check if delivery was confirmed (driver polls this while showing QR code)
delivery.get("/check-delivery-confirmed/:droptagId", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const droptagId = parseInt(c.req.param("droptagId"));

    const user = await c.env.DB.prepare(
      `SELECT id FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first() as { id: number } | null;

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if delivery was confirmed (status changed to 'delivered')
    // Get the most recent record in case there are duplicates
    const delivery = await c.env.DB.prepare(
      `SELECT id, status, sub_status, wrong_receiver_scan_at, selected_receiver_key, updated_at FROM driver_deliveries 
       WHERE driver_user_id = ? AND droptag_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ).bind(user.id, droptagId).first() as { id: number; status: string; sub_status: string | null; wrong_receiver_scan_at: string | null; selected_receiver_key: string | null; updated_at: string } | null;
    
    console.log('[CHECK-CONFIRMED] Query params - user_id:', user.id, 'droptag_id:', droptagId);
    console.log('[CHECK-CONFIRMED] Found delivery record:', delivery ? {
      id: delivery.id,
      status: delivery.status,
      sub_status: delivery.sub_status,
      updated_at: delivery.updated_at
    } : 'NO RECORD FOUND');

    if (!delivery) {
      console.log('[CHECK-CONFIRMED] No delivery found for user_id:', user.id, 'droptag_id:', droptagId);
      return c.json({ confirmed: false, status: null, wrong_receiver_scan: false, awaiting_secret_word: false });
    }

    // If awaiting secret word, get receiver info
    let receiverInfo = null;
    if (delivery.sub_status === 'awaiting_secret_word' && delivery.selected_receiver_key) {
      const receiver = await c.env.DB.prepare(
        `SELECT rps.receiver_key, u.id as receiver_id, u.full_name 
         FROM receiver_point_status rps
         JOIN addresses a ON rps.receiver_key = a.receiver_key
         JOIN users u ON a.user_id = u.id
         WHERE rps.receiver_key = ?`
      ).bind(delivery.selected_receiver_key).first() as { receiver_key: string; receiver_id: number; full_name: string } | null;
      
      if (receiver) {
        receiverInfo = {
          receiver_id: receiver.receiver_id,
          receiver_key: receiver.receiver_key,
          receiver_name: receiver.full_name?.split(' ')[0] || 'Recebedor'
        };
      }
    }

    // Check for actual value (not string "null" or empty) - ensure boolean
    const hasWrongReceiverScan = !!(delivery.wrong_receiver_scan_at && 
      delivery.wrong_receiver_scan_at !== 'null' && 
      delivery.wrong_receiver_scan_at !== '');
    
    console.log('[CHECK-CONFIRMED] Returning for droptag:', droptagId, {
      status: delivery.status,
      sub_status: delivery.sub_status,
      wrong_receiver_scan_at: delivery.wrong_receiver_scan_at,
      wrong_receiver_scan_at_type: typeof delivery.wrong_receiver_scan_at,
      wrong_receiver_scan: hasWrongReceiverScan
    });

    return c.json({
      confirmed: delivery.status === 'delivered',
      status: delivery.status,
      sub_status: delivery.sub_status,
      wrong_receiver_scan: hasWrongReceiverScan,
      awaiting_secret_word: delivery.sub_status === 'awaiting_secret_word',
      receiver_info: receiverInfo
    });
  } catch (error) {
    console.error('[CHECK-CONFIRMED] Error:', error);
    return c.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Clear selected receiver - called when driver closes QR modal
delivery.post("/clear-receiver-point", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { droptag_id } = body;

  if (!droptag_id) {
    return c.json({ error: "droptag_id é obrigatório" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE driver_deliveries 
     SET selected_receiver_key = NULL, sub_status = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE driver_user_id = ? AND droptag_id = ? AND status = 'in_transit'`
  ).bind(user.id, droptag_id).run();

  return c.json({ success: true });
});

export default delivery;
