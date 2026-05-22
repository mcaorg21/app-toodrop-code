import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { AddressInputSchema } from "@/shared/types";

const addresses = new Hono<{ Bindings: Env }>();

// Helper to get user query based on auth type
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

// Get all addresses for user
addresses.get("/", unifiedAuthMiddleware, async (c) => {
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
    "SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();

  return c.json(results);
});

// Create new address
addresses.post("/", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  
  const parsed = AddressInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map(e => e.message).join(", ");
    return c.json({ error: errorMessage }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Check limits
  const { results } = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM addresses WHERE user_id = ? AND address_type = ?"
  ).bind(user.id, parsed.data.address_type).all();

  const count = (results[0] as any)?.count || 0;

  if (parsed.data.address_type === "consumer" && Number(count) >= 10) {
    return c.json({ error: "Limite de 10 endereços atingido" }, 400);
  }

  if (parsed.data.address_type === "receiver" && Number(count) >= 1) {
    return c.json({ error: "Apenas 1 endereço permitido para recebedor" }, 400);
  }

  const { nickname, cep, street, number, complement, neighborhood, city, state, address_type } = parsed.data;

  // Fetch coordinates from Nominatim API
  let latitude: number | null = null;
  let longitude: number | null = null;
  
  try {
    // Try multiple search strategies for better results
    const searchQueries = [
      `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brazil`,
      `${street}, ${number}, ${city}, ${state}, Brazil`,
      `${cep}, ${city}, ${state}, Brazil`,
      `${neighborhood}, ${city}, ${state}, Brazil`,
    ];
    
    for (const searchQuery of searchQueries) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
      
      const geoResponse = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Toodrop-App/1.0',
        },
      });
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json() as Array<{ lat: string; lon: string }>;
        if (geoData && geoData.length > 0) {
          latitude = parseFloat(geoData[0].lat);
          longitude = parseFloat(geoData[0].lon);
          break; // Found coordinates, stop searching
        }
      }
    }
  } catch (error) {
    console.error("Error fetching coordinates for address:", error);
  }

  // Validate coordinates for consumer addresses (required for finding nearby hubs)
  if (address_type === "consumer" && (latitude === null || longitude === null)) {
    return c.json({ 
      error: "Não foi possível obter as coordenadas do endereço. Verifique se o endereço está correto e tente novamente." 
    }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO addresses 
     (user_id, address_type, nickname, cep, street, number, complement, neighborhood, city, state, latitude, longitude) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, address_type, nickname, cep, street, number, complement || null, neighborhood, city, state, latitude, longitude).run();

  // Update user status if first consumer address
  if (address_type === "consumer" && count === 0) {
    await c.env.DB.prepare(
      "UPDATE users SET is_consumer_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id).run();
  }

  const address = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1"
  ).bind(user.id).first();

  return c.json(address);
});

// Update address
addresses.put("/:id", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const addressId = c.req.param("id");
  const body = await c.req.json();
  
  const parsed = AddressInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map(e => e.message).join(", ");
    return c.json({ error: errorMessage }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify address belongs to user
  const existingAddress = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE id = ? AND user_id = ?"
  ).bind(addressId, user.id).first();

  if (!existingAddress) {
    return c.json({ error: "Endereço não encontrado" }, 404);
  }

  // If it's a consumer address, check if there are any droptags linked to it
  if (existingAddress.address_type === "consumer") {
    const linkedDroptags = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM droptags WHERE address_id = ?"
    ).bind(addressId).first();

    const droptagCount = linkedDroptags ? Number(linkedDroptags.count) : 0;

    if (droptagCount > 0) {
      return c.json({ 
        error: "Não é possível editar este endereço pois existem pacotes vinculados a ele",
        linked_droptags: droptagCount
      }, 400);
    }
  }

  const { nickname, cep, street, number, complement, neighborhood, city, state } = parsed.data;

  // Fetch coordinates from Nominatim API
  let latitude: number | null = null;
  let longitude: number | null = null;
  
  try {
    // Try multiple search strategies for better results
    const searchQueries = [
      `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brazil`,
      `${street}, ${number}, ${city}, ${state}, Brazil`,
      `${cep}, ${city}, ${state}, Brazil`,
      `${neighborhood}, ${city}, ${state}, Brazil`,
    ];
    
    for (const searchQuery of searchQueries) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`;
      
      const geoResponse = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'Toodrop-App/1.0',
        },
      });
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json() as Array<{ lat: string; lon: string }>;
        if (geoData && geoData.length > 0) {
          latitude = parseFloat(geoData[0].lat);
          longitude = parseFloat(geoData[0].lon);
          break; // Found coordinates, stop searching
        }
      }
    }
  } catch (error) {
    console.error("Error fetching coordinates for address:", error);
  }

  // Validate coordinates for consumer addresses (required for finding nearby hubs)
  if (existingAddress.address_type === "consumer" && (latitude === null || longitude === null)) {
    return c.json({ 
      error: "Não foi possível obter as coordenadas do endereço. Verifique se o endereço está correto e tente novamente." 
    }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE addresses 
     SET nickname = ?, cep = ?, street = ?, number = ?, complement = ?, 
         neighborhood = ?, city = ?, state = ?, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND user_id = ?`
  ).bind(nickname, cep, street, number, complement || null, neighborhood, city, state, latitude, longitude, addressId, user.id).run();

  const address = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE id = ?"
  ).bind(addressId).first();

  return c.json(address);
});

// Delete address
addresses.delete("/:id", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const addressId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Check if address exists and get its type
  const address = await c.env.DB.prepare(
    "SELECT address_type FROM addresses WHERE id = ? AND user_id = ?"
  ).bind(addressId, user.id).first();

  if (!address) {
    return c.json({ error: "Endereço não encontrado" }, 404);
  }

  // If it's a consumer address, check if there are any droptags linked to it
  if (address.address_type === "consumer") {
    const linkedDroptags = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM droptags WHERE address_id = ?"
    ).bind(addressId).first();

    const droptagCount = linkedDroptags ? Number(linkedDroptags.count) : 0;

    if (droptagCount > 0) {
      return c.json({ 
        error: "Não é possível excluir este endereço pois existem pacotes vinculados a ele",
        linked_droptags: droptagCount
      }, 400);
    }
  }

  if (address.address_type === "receiver") {
    // Delete receiver docs when deleting receiver address
    await c.env.DB.prepare(
      "DELETE FROM receiver_docs WHERE user_id = ?"
    ).bind(user.id).run();

    // Reset receiver status
    await c.env.DB.prepare(
      "UPDATE users SET is_receiver_pending = 0, is_receiver_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id).run();
  }

  await c.env.DB.prepare(
    "DELETE FROM addresses WHERE id = ? AND user_id = ?"
  ).bind(addressId, user.id).run();

  return c.json({ success: true });
});

export default addresses;
