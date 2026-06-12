import { Hono } from "hono";
// import { unifiedAuthMiddleware } from "@getmocha/users-service/backend";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { receiverPointApprovedEmail, receiverPointRejectedEmail, receiverPointPendingEmail, pendingHubReminderEmail, broadcastEmail } from "../utils/email-templates";
// Removed: import { createAsaasSubconta } from "../utils/asaas-helpers";

const admin = new Hono<{ Bindings: Env }>();

// Helper function to get user query based on auth type
function getUserQuery(c: any): { field: string; value: any; email: string | null } | null {
  const user = c.get("user");
  if (!user) return null;
  
  if (user.isEmailAuth) {
    return {
      field: "email_credential_id",
      value: user.email_credential_id,
      email: user.email
    };
  }
  return {
    field: "mocha_user_id",
    value: user.id,
    email: user.email || null
  };
}

// Helper function to get Asaas config based on environment
function getAsaasConfig(c: any) {
  const host = c.req.header('host') || '';
  const isProduction = host === 'app.toodrop.com';
  
  return {
    baseUrl: isProduction ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3',
    apiKey: isProduction ? c.env.ASAAS_API_KEY_PRODUCAO : c.env.ASAAS_API_KEY
  };
}

// Middleware to check admin access
const adminMiddleware = async (c: any, next: any) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (!adminKey || adminKey !== expectedKey) {
    return c.json({ error: "Unauthorized - Invalid admin key" }, 401);
  }

  await next();
};

// Check if current user is admin
admin.get("/check", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ isAdmin: false });
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ isAdmin: false });
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  return c.json({ isAdmin: !!adminRecord });
});

// Get receiver stats
admin.get("/receiver-stats", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  // Em Análise: pending status, never reviewed (no review_notes)
  const inAnalysis = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM users u
     INNER JOIN receiver_docs rd ON u.id = rd.user_id
     WHERE u.is_receiver_pending = 1 AND rd.review_notes IS NULL`
  ).first();

  // Pendente: pending status, but was reviewed (has review_notes)
  const pendingAction = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM users u
     INNER JOIN receiver_docs rd ON u.id = rd.user_id
     WHERE u.is_receiver_pending = 1 AND rd.review_notes IS NOT NULL`
  ).first();

  const approved = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE is_receiver_active = 1"
  ).first();

  const rejected = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM receiver_docs WHERE status = 'rejected'"
  ).first();

  return c.json({
    inAnalysis: (inAnalysis as any)?.count || 0,
    pendingAction: (pendingAction as any)?.count || 0,
    approved: (approved as any)?.count || 0,
    rejected: (rejected as any)?.count || 0,
  });
});

// Get withdrawal requests
admin.get("/withdrawals", unifiedAuthMiddleware, async (c) => {
  try {
    const mochaUser = c.get("user");
    if (!mochaUser) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();

    if (!user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const adminRecord = await c.env.DB.prepare(
      "SELECT id FROM admins WHERE user_id = ?"
    ).bind(user.id).first();

    if (!adminRecord) {
      return c.json({ error: "Acesso negado - Requer permissão de administrador" }, 401);
    }

    const withdrawals = await c.env.DB.prepare(
      `SELECT 
        wr.id,
        wr.user_id,
        wr.amount,
        wr.pix_key,
        wr.status,
        wr.admin_notes,
        wr.processed_by_admin_id,
        wr.processed_at,
        wr.created_at,
        u.full_name as user_name,
        u.cpf as user_cpf
      FROM withdrawal_requests wr
      INNER JOIN users u ON wr.user_id = u.id
      ORDER BY 
        CASE wr.status 
          WHEN 'pending' THEN 1 
          WHEN 'paid' THEN 2 
          WHEN 'cancelled' THEN 3 
        END,
        wr.created_at DESC`
    ).all();

    return c.json(withdrawals.results || []);
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return c.json({ error: "Erro ao carregar solicitações" }, 500);
  }
});

// Update withdrawal status
admin.put("/withdrawals/:id", unifiedAuthMiddleware, async (c) => {
  try {
    const mochaUser = c.get("user");
    if (!mochaUser) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();

    if (!user) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const adminRecord = await c.env.DB.prepare(
      "SELECT id FROM admins WHERE user_id = ?"
    ).bind(user.id).first();

    if (!adminRecord) {
      return c.json({ error: "Acesso negado - Requer permissão de administrador" }, 401);
    }

    const withdrawalId = parseInt(c.req.param("id"));
    const { status, admin_notes } = await c.req.json();

    if (!["paid", "cancelled"].includes(status)) {
      return c.json({ error: "Status inválido" }, 400);
    }

    // Get withdrawal details
    const withdrawal = await c.env.DB.prepare(
      "SELECT * FROM withdrawal_requests WHERE id = ?"
    ).bind(withdrawalId).first();

    if (!withdrawal) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }

    const withdrawalData = withdrawal as any;

    if (withdrawalData.status !== "pending") {
      return c.json({ error: "Esta solicitação já foi processada" }, 400);
    }

    // Update withdrawal status
    await c.env.DB.prepare(
      `UPDATE withdrawal_requests 
       SET status = ?, admin_notes = ?, processed_by_admin_id = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(status, admin_notes || null, user.id, withdrawalId).run();

    // If cancelled, return balance to user
    if (status === "cancelled") {
      const userBalance = await c.env.DB.prepare(
        "SELECT balance FROM users WHERE id = ?"
      ).bind(withdrawalData.user_id).first();

      const newBalance = (Number(userBalance?.balance) || 0) + Number(withdrawalData.amount);

      await c.env.DB.prepare(
        "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(newBalance, withdrawalData.user_id).run();

      // Create transaction record
      await c.env.DB.prepare(
        `INSERT INTO user_transactions (
          user_id, type, amount, description, balance_after, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        withdrawalData.user_id,
        "withdrawal_cancelled",
        withdrawalData.amount,
        `Saque cancelado${admin_notes ? ': ' + admin_notes : ''}`,
        newBalance,
        "completed"
      ).run();
    } else if (status === "paid") {
      // Update existing pending transaction to completed
      await c.env.DB.prepare(
        `UPDATE user_transactions 
         SET type = 'withdrawal_completed', 
             description = ?,
             status = 'completed',
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = (
           SELECT id FROM user_transactions 
           WHERE user_id = ? AND type = 'withdrawal_requested' AND amount = ? AND status = 'pending'
           ORDER BY created_at DESC 
           LIMIT 1
         )`
      ).bind(
        `Saque realizado via PIX${admin_notes ? ': ' + admin_notes : ''}`,
        withdrawalData.user_id,
        -withdrawalData.amount
      ).run();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    return c.json({ error: "Erro ao processar solicitação" }, 500);
  }
});

// Get all pending receiver approvals
admin.get("/receiver-approvals", adminMiddleware, async (c) => {
  const { results: pendingUsers } = await c.env.DB.prepare(
    `SELECT u.*, a.id as address_id, a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.cep, 
            a.latitude, a.longitude, rd.id as docs_id, rd.id_document_url, rd.id_document_back_url, rd.selfie_url, 
            rd.address_proof_url, rd.address_proof_type, rd.status as docs_status
     FROM users u
     INNER JOIN addresses a ON u.id = a.user_id AND a.address_type = 'receiver'
     LEFT JOIN receiver_docs rd ON u.id = rd.user_id
     WHERE u.is_receiver_pending = 1`
  ).all();

  return c.json(pendingUsers);
});

// Approve receiver
admin.post("/approve-receiver/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");
  const body = await c.req.json() as { notes?: string; manualLatitude?: number; manualLongitude?: number };

  const targetUser = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!targetUser) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const address = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(userId).first() as any;

  if (!address) {
    return c.json({ error: "Endereço do Toodroper não encontrado" }, 404);
  }

  // Check and fetch coordinates if missing
  let latitude = address.latitude;
  let longitude = address.longitude;

  // Use manual coordinates if provided
  if (body.manualLatitude && body.manualLongitude) {
    latitude = body.manualLatitude;
    longitude = body.manualLongitude;
    
    // Update address with manual coordinates
    await c.env.DB.prepare(
      "UPDATE addresses SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(latitude, longitude, address.id).run();
  } else if (!latitude || !longitude) {
    // Try to fetch coordinates from Nominatim
    const searchQueries = [
      `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brazil`,
      `${address.street}, ${address.number}, ${address.city}, ${address.state}, Brazil`,
      `${address.cep}, ${address.city}, ${address.state}, Brazil`,
      `${address.neighborhood}, ${address.city}, ${address.state}, Brazil`,
    ];

    for (const searchQuery of searchQueries) {
      try {
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
            
            // Update address with coordinates
            await c.env.DB.prepare(
              "UPDATE addresses SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(latitude, longitude, address.id).run();
            
            break; // Found coordinates, stop searching
          }
        }
      } catch (error) {
        console.error("Error fetching coordinates:", error);
      }
    }

    // If still no coordinates, return needs_coordinates flag
    if (!latitude || !longitude) {
      return c.json({ 
        error: "Não foi possível obter as coordenadas automaticamente. Clique no mapa para definir a localização manualmente.",
        needs_coordinates: true,
        address: {
          street: address.street,
          number: address.number,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          cep: address.cep
        }
      }, 400);
    }
  }

  let receiverKey = address.receiver_key as string | null;
  if (!receiverKey || !(receiverKey as string).startsWith('H2D-')) {
    receiverKey = `H2D-${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    await c.env.DB.prepare(
      "UPDATE addresses SET receiver_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(receiverKey, address.id).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO receiver_point_status (receiver_key, is_active, active_hub, latitude, longitude) 
     VALUES (?, 1, 1, ?, ?)
     ON CONFLICT(receiver_key) DO UPDATE SET is_active = 1, active_hub = 1, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(receiverKey, latitude, longitude, latitude, longitude).run();

  await c.env.DB.prepare(
    "UPDATE users SET is_receiver_pending = 0, is_receiver_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(userId).run();

  await c.env.DB.prepare(
    "UPDATE receiver_docs SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(userId).run();

  // Send approval email
  if (c.env.EMAILS && targetUser.email) {
    try {
      const emailContent = receiverPointApprovedEmail(
        targetUser.full_name as string,
        address.nickname as string
      );
      await c.env.EMAILS.send({
        to: targetUser.email as string,
        subject: emailContent.subject,
        html_body: emailContent.html_body,
        text_body: emailContent.text_body,
      });
    } catch (error) {
      console.error("Failed to send approval email:", error);
    }
  }

  // Check if this user was referred and pay R$30 commission to referrer
  try {
    let referral = await c.env.DB.prepare(
      `SELECT r.*, u.full_name as referrer_name, u.email as referrer_email
       FROM referrals r
       JOIN users u ON u.id = r.referrer_user_id
       WHERE r.referred_user_id = ? AND r.commission_paid = 0`
    ).bind(userId).first<{
      id: number;
      referrer_user_id: number;
      referrer_name: string;
      referrer_email: string;
    }>();

    // Fallback: match by email for referrals where link-referred didn't run
    if (!referral && (targetUser as any).email) {
      referral = await c.env.DB.prepare(
        `SELECT r.*, u.full_name as referrer_name, u.email as referrer_email
         FROM referrals r
         JOIN users u ON u.id = r.referrer_user_id
         WHERE LOWER(r.referred_email) = LOWER(?) AND r.commission_paid = 0 AND r.status != 'approved'`
      ).bind((targetUser as any).email).first<{
        id: number;
        referrer_user_id: number;
        referrer_name: string;
        referrer_email: string;
      }>();
      if (referral) {
        await c.env.DB.prepare(
          "UPDATE referrals SET referred_user_id = ?, status = 'registered', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(userId, referral.id).run();
      }
    }

    if (referral) {
      const commissionAmount = 30.00;

      // Calculate new balance for referrer
      const balanceResult = await c.env.DB.prepare(`
        SELECT COALESCE(SUM(
          CASE 
            WHEN type IN ('commission_received', 'referral_commission') AND status = 'completed' THEN amount
            WHEN type = 'withdrawal_completed' AND status = 'completed' THEN -amount
            ELSE 0
          END
        ), 0) as current_balance
        FROM user_transactions WHERE user_id = ?
      `).bind(referral.referrer_user_id).first<{ current_balance: number }>();

      const currentBalance = balanceResult?.current_balance || 0;
      const newBalance = currentBalance + commissionAmount;

      // Add commission transaction for referrer
      await c.env.DB.prepare(
        `INSERT INTO user_transactions (user_id, type, amount, description, status, balance_after, created_at, updated_at)
         VALUES (?, 'referral_commission', ?, ?, 'completed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        referral.referrer_user_id,
        commissionAmount,
        `Bônus de indicação - ${targetUser.full_name}`,
        newBalance
      ).run();

      // Mark referral as paid
      await c.env.DB.prepare(
        `UPDATE referrals SET commission_paid = 1, commission_amount = ?, approved_at = CURRENT_TIMESTAMP, status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(commissionAmount, referral.id).run();

      console.log(`Referral commission paid: R$${commissionAmount} to user ${referral.referrer_user_id} for referring user ${userId}`);
    }
  } catch (error) {
    console.error("Failed to process referral commission:", error);
    // Don't fail the approval if referral processing fails
  }

  return c.json({ success: true, receiver_key: receiverKey });
});

// Legacy approve endpoint
admin.post("/receiver-approvals/:userId/approve", adminMiddleware, async (c) => {
  const userId = c.req.param("userId");

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const address = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(userId).first() as any;

  if (!address) {
    return c.json({ error: "Endereço do Toodroper não encontrado" }, 404);
  }

  // Check and fetch coordinates if missing
  let latitude = address.latitude;
  let longitude = address.longitude;

  if (!latitude || !longitude) {
    // Try to fetch coordinates from Nominatim
    const searchQueries = [
      `${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}, ${address.state}, Brazil`,
      `${address.street}, ${address.number}, ${address.city}, ${address.state}, Brazil`,
      `${address.cep}, ${address.city}, ${address.state}, Brazil`,
      `${address.neighborhood}, ${address.city}, ${address.state}, Brazil`,
    ];

    for (const searchQuery of searchQueries) {
      try {
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
            
            // Update address with coordinates
            await c.env.DB.prepare(
              "UPDATE addresses SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(latitude, longitude, address.id).run();
            
            break; // Found coordinates, stop searching
          }
        }
      } catch (error) {
        console.error("Error fetching coordinates:", error);
      }
    }

    // If still no coordinates, block approval
    if (!latitude || !longitude) {
      return c.json({ 
        error: "Não foi possível obter as coordenadas do endereço do Toodroper. Verifique se o endereço está correto antes de aprovar." 
      }, 400);
    }
  }

  let receiverKey = address.receiver_key as string | null;
  if (!receiverKey || !(receiverKey as string).startsWith('H2D-')) {
    receiverKey = `H2D-${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    
    await c.env.DB.prepare(
      "UPDATE addresses SET receiver_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(receiverKey, address.id).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO receiver_point_status (receiver_key, is_active, active_hub, latitude, longitude) 
     VALUES (?, 1, 1, ?, ?)
     ON CONFLICT(receiver_key) DO UPDATE SET is_active = 1, active_hub = 1, latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(receiverKey, latitude, longitude, latitude, longitude).run();

  await c.env.DB.prepare(
    "UPDATE users SET is_receiver_pending = 0, is_receiver_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(userId).run();

  await c.env.DB.prepare(
    "UPDATE receiver_docs SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(userId).run();

  // Subconta creation removed - no longer using Asaas wallets for commission splits

  // Send approval email
  if (c.env.EMAILS && user.email) {
    try {
      const emailContent = receiverPointApprovedEmail(
        user.full_name as string,
        address.nickname as string
      );
      await c.env.EMAILS.send({
        to: user.email as string,
        subject: emailContent.subject,
        html_body: emailContent.html_body,
        text_body: emailContent.text_body,
      });
    } catch (error) {
      console.error("Failed to send approval email:", error);
    }
  }

  return c.json({ success: true, receiver_key: receiverKey });
});

// Reject receiver
admin.post("/reject-receiver/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");
  const body = await c.req.json();
  const { notes } = body;

  const targetUser = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get receiver_key to deactivate the hub
  const address = await c.env.DB.prepare(
    "SELECT receiver_key, nickname FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(userId).first();

  await c.env.DB.prepare(
    "UPDATE users SET is_receiver_pending = 0, is_receiver_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(userId).run();

  await c.env.DB.prepare(
    "UPDATE receiver_docs SET status = 'rejected', review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(notes || "Documentos não aprovados", userId).run();

  // Deactivate the hub in receiver_point_status
  if (address?.receiver_key) {
    await c.env.DB.prepare(
      "UPDATE receiver_point_status SET is_active = 0, active_hub = 0, updated_at = CURRENT_TIMESTAMP WHERE receiver_key = ?"
    ).bind(address.receiver_key).run();
  }

  // Send rejection email
  if (c.env.EMAILS && targetUser.email && address) {
    try {
      const emailContent = receiverPointRejectedEmail(
        targetUser.full_name as string,
        address.nickname as string,
        notes || "Documentos não aprovados"
      );
      await c.env.EMAILS.send({
        to: targetUser.email as string,
        subject: emailContent.subject,
        html_body: emailContent.html_body,
        text_body: emailContent.text_body,
      });
    } catch (error) {
      console.error("Failed to send rejection email:", error);
    }
  }

  return c.json({ success: true });
});

// Set pending receiver
admin.post("/set-pending/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");
  const body = await c.req.json();
  const { notes } = body;

  const targetUser = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get receiver_key to deactivate the hub
  const address = await c.env.DB.prepare(
    "SELECT receiver_key, nickname FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(userId).first();

  // Set user back to pending status (allow setting approved receivers back to pending)
  await c.env.DB.prepare(
    "UPDATE users SET is_receiver_pending = 1, is_receiver_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(userId).run();

  // Check if receiver_docs exists
  const existingDocs = await c.env.DB.prepare(
    "SELECT id FROM receiver_docs WHERE user_id = ?"
  ).bind(userId).first();

  if (existingDocs) {
    // Update existing receiver_docs with review_notes to maintain "Pendente" status
    await c.env.DB.prepare(
      "UPDATE receiver_docs SET status = 'pending', review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
    ).bind(notes || "Requer nova análise", userId).run();
  } else {
    // Create receiver_docs record if it doesn't exist (for hubs approved without documents)
    await c.env.DB.prepare(
      "INSERT INTO receiver_docs (user_id, id_document_url, selfie_url, address_proof_url, status, review_notes, created_at, updated_at) VALUES (?, '', '', '', 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(userId, notes || "Requer nova análise").run();
  }

  // Reset document validations so user can re-upload
  await c.env.DB.prepare(
    "DELETE FROM receiver_doc_validations WHERE user_id = ?"
  ).bind(userId).run();

  // Deactivate the hub in receiver_point_status
  if (address?.receiver_key) {
    await c.env.DB.prepare(
      "UPDATE receiver_point_status SET is_active = 0, active_hub = 0, updated_at = CURRENT_TIMESTAMP WHERE receiver_key = ?"
    ).bind(address.receiver_key).run();
  }

  // Send pending status email
  if (c.env.EMAILS && targetUser.email && address) {
    try {
      const emailContent = receiverPointPendingEmail(
        targetUser.full_name as string,
        address.nickname as string,
        notes || "Requer nova análise"
      );
      await c.env.EMAILS.send({
        to: targetUser.email as string,
        subject: emailContent.subject,
        html_body: emailContent.html_body,
        text_body: emailContent.text_body,
      });
    } catch (error) {
      console.error("Failed to send pending email:", error);
    }
  }

  return c.json({ success: true });
});

// Legacy reject endpoint
admin.post("/receiver-approvals/:userId/reject", adminMiddleware, async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json();
  const { reason } = body;

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE users SET is_receiver_pending = 0, is_receiver_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(userId).run();

  await c.env.DB.prepare(
    "UPDATE receiver_docs SET status = 'rejected', review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
  ).bind(reason || "Documentos não aprovados", userId).run();

  return c.json({ success: true });
});

// Get pending receivers with filter
admin.get("/pending-receivers", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const status = c.req.query("status");

  let query = `SELECT u.id as user_id, u.full_name, u.cpf, u.phone,
                      u.receiver_commission_percent, u.driver_commission_percent, u.platform_commission_percent,
                      u.is_receiver_pending, u.is_receiver_active,
                      a.id as address_id, a.nickname, a.street, a.number, a.complement, a.neighborhood, 
                      a.city, a.state, a.cep, a.latitude, a.longitude, a.receiver_key,
                      rd.id as docs_id, rd.id_document_url, rd.id_document_back_url, rd.selfie_url, 
                      rd.address_proof_url, rd.address_proof_type, rd.status as docs_status,
                      rd.created_at as submitted_at, rd.review_notes,
                      rps.is_active, rps.active_hub, rps.last_ping, rps.service_price
               FROM users u
               INNER JOIN addresses a ON u.id = a.user_id AND a.address_type = 'receiver'
               LEFT JOIN receiver_docs rd ON u.id = rd.user_id
               LEFT JOIN receiver_point_status rps ON a.receiver_key = rps.receiver_key`;

  // Map frontend filter values to database conditions
  if (status === "inAnalysis") {
    // Em Análise: pending and never reviewed (no review_notes)
    query += " WHERE u.is_receiver_pending = 1 AND rd.review_notes IS NULL";
  } else if (status === "pendingAction") {
    // Pendente: pending but was reviewed (has review_notes)
    query += " WHERE u.is_receiver_pending = 1 AND rd.review_notes IS NOT NULL";
  } else if (status === "approved") {
    query += " WHERE u.is_receiver_active = 1";
  } else if (status === "rejected") {
    query += " WHERE rd.status = 'rejected'";
  }

  query += " ORDER BY u.created_at DESC";

  const { results } = await c.env.DB.prepare(query).all();

  // Transform results to match frontend expected structure
  const formattedResults = results.map((r: any) => {
    // Calculate approval_status based on flags
    let approval_status: 'in_analysis' | 'pending_action' | 'approved' | 'rejected' = 'in_analysis';
    if (r.is_receiver_active === 1) {
      approval_status = 'approved';
    } else if (r.docs_status === 'rejected') {
      approval_status = 'rejected';
    } else if (r.is_receiver_pending === 1 && r.review_notes) {
      approval_status = 'pending_action';
    } else if (r.is_receiver_pending === 1) {
      approval_status = 'in_analysis';
    }
    
    return {
    user_id: r.user_id,
    full_name: r.full_name,
    cpf: r.cpf,
    phone: r.phone,
    approval_status,
    address: {
      nickname: r.nickname,
      street: r.street,
      number: r.number,
      complement: r.complement,
      neighborhood: r.neighborhood,
      city: r.city,
      state: r.state,
      cep: r.cep,
      latitude: r.latitude,
      longitude: r.longitude,
    },
    docs: {
      id_document_url: r.id_document_url ? `/api/receiver/documents/file/${encodeURIComponent(r.id_document_url)}` : null,
      id_document_back_url: r.id_document_back_url ? `/api/receiver/documents/file/${encodeURIComponent(r.id_document_back_url)}` : null,
      selfie_url: r.selfie_url ? `/api/receiver/documents/file/${encodeURIComponent(r.selfie_url)}` : null,
      address_proof_url: r.address_proof_url ? `/api/receiver/documents/file/${encodeURIComponent(r.address_proof_url)}` : null,
      address_proof_type: r.address_proof_type,
      submitted_at: r.submitted_at,
    },
    commission: {
      service_price: r.service_price || 10.00,
      receiver_percent: r.receiver_commission_percent || 60,
      driver_percent: r.driver_commission_percent || 20,
      platform_percent: r.platform_commission_percent || 20,
    },
    hub_status: {
      is_active: r.is_active === 1,
      active_hub: r.active_hub === 1,
      last_ping: r.last_ping,
      receiver_key: r.receiver_key,
    },
  };
  });

  return c.json(formattedResults);
});

// Toggle admin status for a user
admin.post("/toggle-admin/:userId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    `SELECT u.id FROM users u INNER JOIN admins a ON u.id = a.user_id WHERE u.${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = parseInt(c.req.param("userId"));

  // Check if user exists
  const user = await c.env.DB.prepare(
    "SELECT id, full_name FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Check if user is already admin
  const existingAdmin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(userId).first();

  if (existingAdmin) {
    // Remove admin
    await c.env.DB.prepare(
      "DELETE FROM admins WHERE user_id = ?"
    ).bind(userId).run();
    return c.json({ success: true, isAdmin: false, message: "Permissão de administrador removida" });
  } else {
    // Add admin
    await c.env.DB.prepare(
      "INSERT INTO admins (user_id) VALUES (?)"
    ).bind(userId).run();
    return c.json({ success: true, isAdmin: true, message: "Permissão de administrador concedida" });
  }
});

// Update receiver commission configuration
admin.put("/receiver-commission/:userId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    `SELECT u.id FROM users u INNER JOIN admins a ON u.id = a.user_id WHERE u.${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = parseInt(c.req.param("userId"));
  const body = await c.req.json();
  const { service_price, receiver_percent, driver_percent, platform_percent } = body;

  // Validate percentages sum to 100
  const total = (receiver_percent || 0) + (driver_percent || 0) + (platform_percent || 0);
  if (total !== 100) {
    return c.json({ error: `A soma das comissões deve ser 100%. Atual: ${total}%` }, 400);
  }

  // Validate individual percentages
  if (receiver_percent < 0 || driver_percent < 0 || platform_percent < 0) {
    return c.json({ error: "As porcentagens não podem ser negativas" }, 400);
  }

  if (service_price < 0) {
    return c.json({ error: "O preço do serviço não pode ser negativo" }, 400);
  }

  // Get user's receiver_key
  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(userId).first() as { receiver_key: string } | null;

  if (!address) {
    return c.json({ error: "Endereço de receiver não encontrado" }, 404);
  }

  // Update commissions in users table
  await c.env.DB.prepare(
    `UPDATE users SET 
      receiver_commission_percent = ?,
      driver_commission_percent = ?,
      platform_commission_percent = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).bind(receiver_percent, driver_percent, platform_percent, userId).run();

  // Update service_price in receiver_point_status
  await c.env.DB.prepare(
    `UPDATE receiver_point_status SET 
      service_price = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE receiver_key = ?`
  ).bind(service_price, address.receiver_key).run();

  // Log the change in commission_history
  await c.env.DB.prepare(
    `INSERT INTO commission_history (user_id, changed_by_user_id, receiver_commission_percent, driver_commission_percent, platform_commission_percent, service_price)
    VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, adminUser.id, receiver_percent, driver_percent, platform_percent, service_price).run();

  return c.json({ success: true });
});

// Get all active receivers (legacy endpoint)
admin.get("/receivers", adminMiddleware, async (c) => {
  const { results: receivers } = await c.env.DB.prepare(
    `SELECT u.*, a.receiver_key, a.street, a.number, a.neighborhood, a.city, a.state, 
            rps.is_active, rps.active_hub, rps.last_ping
     FROM users u
     INNER JOIN addresses a ON u.id = a.user_id AND a.address_type = 'receiver'
     LEFT JOIN receiver_point_status rps ON a.receiver_key = rps.receiver_key
     WHERE u.is_receiver_active = 1
     ORDER BY u.created_at DESC`
  ).all();

  return c.json(receivers);
});

// Get all active receivers (legacy endpoint)
admin.get("/active-receivers", adminMiddleware, async (c) => {
  const { results: receivers } = await c.env.DB.prepare(
    `SELECT u.*, a.receiver_key, a.street, a.number, a.neighborhood, a.city, a.state, 
            rps.is_active, rps.active_hub, rps.last_ping
     FROM users u
     INNER JOIN addresses a ON u.id = a.user_id AND a.address_type = 'receiver'
     LEFT JOIN receiver_point_status rps ON a.receiver_key = rps.receiver_key
     WHERE u.is_receiver_active = 1
     ORDER BY u.created_at DESC`
  ).all();

  return c.json(receivers);
});

// Deactivate inactive hubs manually
admin.post("/deactivate-inactive-hubs", adminMiddleware, async (c) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { results: inactiveHubs } = await c.env.DB.prepare(
    `SELECT receiver_key, last_ping 
     FROM receiver_point_status 
     WHERE active_hub = 1 
     AND (last_ping IS NULL OR last_ping < ?)`
  ).bind(oneHourAgo).all();
  
  for (const hub of inactiveHubs) {
    await c.env.DB.prepare(
      `UPDATE receiver_point_status 
       SET active_hub = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE receiver_key = ?`
    ).bind(hub.receiver_key).run();
  }
  
  return c.json({ 
    success: true, 
    deactivated: inactiveHubs.length,
    hubs: inactiveHubs 
  });
});

// Get all droptags with full relations (admin view)
admin.get("/droptags", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  // Get all droptags with consumer and receiver info
  const { results: droptags } = await c.env.DB.prepare(
    `SELECT 
       d.id, d.uuid, d.tracking_code, d.title, d.secret_word, d.notes, d.status, d.created_at, d.updated_at,
       d.consumer_user_id, d.receiver_user_id, d.address_id,
       cu.full_name as consumer_name, cu.phone as consumer_phone,
       ru.full_name as receiver_name, ru.phone as receiver_phone,
       a.nickname as address_nickname, a.street, a.number, a.complement, a.neighborhood, a.city, a.state, a.cep, a.receiver_key
     FROM droptags d
     LEFT JOIN users cu ON d.consumer_user_id = cu.id
     LEFT JOIN users ru ON d.receiver_user_id = ru.id
     LEFT JOIN addresses a ON d.address_id = a.id
     ORDER BY d.created_at DESC
     LIMIT 200`
  ).all();

  // Get authorized receivers for each droptag
  const { results: authorizedReceivers } = await c.env.DB.prepare(
    `SELECT dar.droptag_id, dar.receiver_key, a.nickname, a.street, a.number, a.city, u.full_name as user_name
     FROM droptag_authorized_receivers dar
     LEFT JOIN addresses a ON dar.receiver_key = a.receiver_key
     LEFT JOIN users u ON a.user_id = u.id
     WHERE dar.droptag_id IN (SELECT id FROM droptags ORDER BY created_at DESC LIMIT 200)`
  ).all();

  // Get driver deliveries for each droptag
  const { results: driverDeliveries } = await c.env.DB.prepare(
    `SELECT dd.*, u.full_name as driver_name
     FROM driver_deliveries dd
     LEFT JOIN users u ON dd.driver_user_id = u.id
     WHERE dd.droptag_id IN (SELECT id FROM droptags ORDER BY created_at DESC LIMIT 200)`
  ).all();

  // Get receiver deliveries for each droptag
  const { results: receiverDeliveries } = await c.env.DB.prepare(
    `SELECT rd.*, u.full_name as receiver_name, du.full_name as driver_name
     FROM receiver_deliveries rd
     LEFT JOIN users u ON rd.receiver_user_id = u.id
     LEFT JOIN users du ON rd.driver_user_id = du.id
     WHERE rd.droptag_id IN (SELECT id FROM droptags ORDER BY created_at DESC LIMIT 200)`
  ).all();

  // Get delivery scans for each droptag
  const { results: deliveryScans } = await c.env.DB.prepare(
    `SELECT ds.*, fu.full_name as from_user_name, tu.full_name as to_user_name
     FROM delivery_scans ds
     LEFT JOIN users fu ON ds.from_user_id = fu.id
     LEFT JOIN users tu ON ds.to_user_id = tu.id
     WHERE ds.droptag_id IN (SELECT id FROM droptags ORDER BY created_at DESC LIMIT 200)
     ORDER BY ds.scanned_at DESC`
  ).all();

  // Build relations map
  const relationsMap: Record<number, any> = {};
  
  for (const d of droptags as any[]) {
    relationsMap[d.id] = {
      authorizedReceivers: [],
      driverDeliveries: [],
      receiverDeliveries: [],
      deliveryScans: []
    };
  }

  for (const ar of authorizedReceivers as any[]) {
    if (relationsMap[ar.droptag_id]) {
      relationsMap[ar.droptag_id].authorizedReceivers.push(ar);
    }
  }

  for (const dd of driverDeliveries as any[]) {
    if (relationsMap[dd.droptag_id]) {
      relationsMap[dd.droptag_id].driverDeliveries.push(dd);
    }
  }

  for (const rd of receiverDeliveries as any[]) {
    if (relationsMap[rd.droptag_id]) {
      relationsMap[rd.droptag_id].receiverDeliveries.push(rd);
    }
  }

  for (const ds of deliveryScans as any[]) {
    if (relationsMap[ds.droptag_id]) {
      relationsMap[ds.droptag_id].deliveryScans.push(ds);
    }
  }

  // Combine droptags with their relations
  const droptagsWithRelations = (droptags as any[]).map(d => ({
    ...d,
    relations: relationsMap[d.id] || { authorizedReceivers: [], driverDeliveries: [], receiverDeliveries: [], deliveryScans: [] }
  }));

  return c.json(droptagsWithRelations);
});

// Get all users with commission data
admin.get("/users-commissions", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const { results: users } = await c.env.DB.prepare(
    `SELECT id, full_name, phone, cpf, is_receiver_active, is_consumer_active,
            receiver_commission_percent, driver_commission_percent, platform_commission_percent
     FROM users
     ORDER BY full_name ASC`
  ).all();

  return c.json(users);
});

// Update user commissions
admin.post("/update-commissions/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");
  const body = await c.req.json();
  const { receiver_commission_percent, driver_commission_percent, platform_commission_percent } = body;

  // Validate percentages
  const receiver = Number(receiver_commission_percent) || 0;
  const driver = Number(driver_commission_percent) || 0;
  const platform = Number(platform_commission_percent) || 0;

  if (receiver < 0 || driver < 0 || platform < 0) {
    return c.json({ error: "Percentuais não podem ser negativos" }, 400);
  }

  const total = receiver + driver + platform;
  if (total !== 100) {
    return c.json({ error: "A soma das comissões deve ser exatamente 100%" }, 400);
  }

  const targetUser = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first();

  if (!targetUser) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE users SET 
     receiver_commission_percent = ?, 
     driver_commission_percent = ?, 
     platform_commission_percent = ?,
     updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(receiver, driver, platform, userId).run();

  // Log the change in commission_history
  await c.env.DB.prepare(
    `INSERT INTO commission_history (user_id, changed_by_user_id, receiver_commission_percent, driver_commission_percent, platform_commission_percent)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(userId, user.id, receiver, driver, platform).run();

  return c.json({ success: true });
});

// Get commission history for a user
admin.get("/commission-history/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");

  const { results: history } = await c.env.DB.prepare(
    `SELECT ch.*, u.full_name as changed_by_name 
     FROM commission_history ch
     LEFT JOIN users u ON ch.changed_by_user_id = u.id
     WHERE ch.user_id = ?
     ORDER BY ch.created_at DESC
     LIMIT 20`
  ).bind(userId).all();

  return c.json(history || []);
});

// Bulk update commissions for multiple users
admin.post("/bulk-update-commissions", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first<{ id: number }>();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const body = await c.req.json();
  const { user_ids, receiver_commission_percent, driver_commission_percent, platform_commission_percent } = body;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return c.json({ error: "Nenhum usuário selecionado" }, 400);
  }

  const receiver = Number(receiver_commission_percent) || 0;
  const driver = Number(driver_commission_percent) || 0;
  const platform = Number(platform_commission_percent) || 0;

  if (receiver < 0 || driver < 0 || platform < 0) {
    return c.json({ error: "Percentuais não podem ser negativos" }, 400);
  }

  const total = receiver + driver + platform;
  if (total !== 100) {
    return c.json({ error: "A soma das comissões deve ser exatamente 100%" }, 400);
  }

  // Update all users and log history
  for (const userId of user_ids) {
    await c.env.DB.prepare(
      `UPDATE users SET 
       receiver_commission_percent = ?, 
       driver_commission_percent = ?, 
       platform_commission_percent = ?,
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(receiver, driver, platform, userId).run();

    await c.env.DB.prepare(
      `INSERT INTO commission_history (user_id, changed_by_user_id, receiver_commission_percent, driver_commission_percent, platform_commission_percent)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, user.id, receiver, driver, platform).run();
  }

  return c.json({ success: true, updated: user_ids.length });
});

// Get all users for admin view
admin.get("/users", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const { results: users } = await c.env.DB.prepare(
    `SELECT id, full_name, cpf, phone, profile_status, main_interest,
            is_consumer_active, is_receiver_pending, is_receiver_active, is_active,
            created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  ).all();

  return c.json(users);
});

// Get user details with all related data
admin.get("/users/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(adminUser.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = c.req.param("userId");

  // Get user
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(userId).first() as Record<string, unknown> | null;

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Email is now stored locally in the users table

  // Get addresses
  const { results: addresses } = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(userId).all();

  // Get droptags (as consumer)
  const { results: droptags } = await c.env.DB.prepare(
    `SELECT d.*, a.street, a.number, a.neighborhood, a.city
     FROM droptags d
     LEFT JOIN addresses a ON d.address_id = a.id
     WHERE d.consumer_user_id = ?
     ORDER BY d.created_at DESC
     LIMIT 50`
  ).bind(userId).all();

  // Get receiver docs
  const receiverDocs = await c.env.DB.prepare(
    "SELECT * FROM receiver_docs WHERE user_id = ?"
  ).bind(userId).first();

  // Get driver deliveries
  const { results: driverDeliveries } = await c.env.DB.prepare(
    `SELECT dd.*, d.tracking_code, d.title
     FROM driver_deliveries dd
     INNER JOIN droptags d ON dd.droptag_id = d.id
     WHERE dd.driver_user_id = ?
     ORDER BY dd.created_at DESC
     LIMIT 50`
  ).bind(userId).all();

  // Get receiver deliveries
  const { results: receiverDeliveries } = await c.env.DB.prepare(
    `SELECT rd.*, d.tracking_code, d.title
     FROM receiver_deliveries rd
     INNER JOIN droptags d ON rd.droptag_id = d.id
     WHERE rd.receiver_user_id = ?
     ORDER BY rd.created_at DESC
     LIMIT 50`
  ).bind(userId).all();

  // Get schedules
  const { results: schedules } = await c.env.DB.prepare(
    "SELECT * FROM schedules WHERE user_id = ? ORDER BY day_of_week"
  ).bind(userId).all();

  // Get commission history
  const { results: commissionHistory } = await c.env.DB.prepare(
    `SELECT ch.*, u.full_name as changed_by_name
     FROM commission_history ch
     LEFT JOIN users u ON ch.changed_by_user_id = u.id
     WHERE ch.user_id = ?
     ORDER BY ch.created_at DESC
     LIMIT 10`
  ).bind(userId).all();

  // Check if user is admin
  const isAdminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(userId).first();

  return c.json({
    user,
    addresses,
    droptags,
    receiverDocs,
    driverDeliveries,
    receiverDeliveries,
    schedules,
    commissionHistory,
    isAdmin: !!isAdminRecord,
  });
});

// Get system stats
admin.get("/stats", adminMiddleware, async (c) => {
  const totalUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users"
  ).first();

  const activeConsumers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE is_consumer_active = 1"
  ).first();

  const activeReceivers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE is_receiver_active = 1"
  ).first();

  const pendingReceivers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE is_receiver_pending = 1"
  ).first();

  const totalDroptags = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM droptags"
  ).first();

  const activeDroptags = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM droptags WHERE status IN ('created', 'in_transit', 'awaiting_pickup')"
  ).first();

  return c.json({
    total_users: (totalUsers as any)?.count || 0,
    active_consumers: (activeConsumers as any)?.count || 0,
    active_receivers: (activeReceivers as any)?.count || 0,
    pending_receivers: (pendingReceivers as any)?.count || 0,
    total_droptags: (totalDroptags as any)?.count || 0,
    active_droptags: (activeDroptags as any)?.count || 0,
  });
});

// Toggle user active status
admin.post("/users/:userId/toggle-active", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(adminUser.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const userId = parseInt(c.req.param("userId"));
  
  // Get current status and email
  const user = await c.env.DB.prepare(
    "SELECT is_active, email FROM users WHERE id = ?"
  ).bind(userId).first() as any;

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Prevent toggling protected user
  if (user.email === "mcaorg@gmail.com") {
    return c.json({ error: "Este usuário não pode ser desativado" }, 403);
  }

  const newStatus = user.is_active === 1 ? 0 : 1;

  await c.env.DB.prepare(
    "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(newStatus, userId).run();

  return c.json({ success: true, is_active: newStatus });
});

// Get platform commissions
admin.get("/commissions", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(adminUser.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  // Get all platform commissions with related data
  const commissions = await c.env.DB.prepare(
    `SELECT 
      pc.*,
      d.title as droptag_description,
      d.tracking_code,
      consumer.full_name as consumer_name,
      driver.full_name as driver_name,
      receiver.full_name as receiver_name
     FROM platform_commissions pc
     LEFT JOIN droptags d ON pc.droptag_id = d.id
     LEFT JOIN users consumer ON pc.consumer_user_id = consumer.id
     LEFT JOIN users driver ON pc.driver_user_id = driver.id
     LEFT JOIN users receiver ON pc.receiver_user_id = receiver.id
     ORDER BY pc.paid_at DESC
     LIMIT 100`
  ).all();

  // Calculate totals
  const totals = await c.env.DB.prepare(
    `SELECT 
      COUNT(*) as total_count,
      SUM(total_value) as total_revenue,
      SUM(platform_commission_amount) as total_platform_commission,
      SUM(driver_commission_amount) as total_driver_commission,
      SUM(receiver_commission_amount) as total_receiver_commission
     FROM platform_commissions`
  ).first();

  return c.json({ 
    commissions: commissions.results,
    totals
  });
});

// Asaas financial extract
admin.get("/asaas-extract", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const asaasConfig = getAsaasConfig(c);
    const url = new URL(c.req.url);
    const offset = url.searchParams.get("offset") || "0";
    const limit = url.searchParams.get("limit") || "50";
    const startDate = url.searchParams.get("startDate") || "";
    const finishDate = url.searchParams.get("finishDate") || "";

    let asaasUrl = `${asaasConfig.baseUrl}/financialTransactions?offset=${offset}&limit=${limit}`;
    
    if (startDate) {
      asaasUrl += `&startDate=${startDate}`;
    }
    if (finishDate) {
      asaasUrl += `&finishDate=${finishDate}`;
    }

    const response = await fetch(asaasUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Toodrop/1.0",
        "access_token": asaasConfig.apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Asaas API error:", errorData);
      return c.json({ error: "Erro ao consultar Asaas", details: errorData }, 400);
    }

    const data = await response.json() as Record<string, unknown>;
    
    // Enrich fee transactions with original payment value for percentage calculation
    const transactions = (data.data || []) as Array<Record<string, unknown>>;
    const enrichedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        let enrichedTransaction = { ...transaction };
        
        // For fee transactions, fetch original payment value
        if (transaction.type && String(transaction.type).includes("FEE") && transaction.paymentId) {
          try {
            const paymentResponse = await fetch(
              `${asaasConfig.baseUrl}/payments/${transaction.paymentId}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "User-Agent": "Toodrop/1.0",
                  "access_token": asaasConfig.apiKey,
                },
              }
            );
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json() as Record<string, unknown>;
              enrichedTransaction.originalPaymentValue = paymentData.value;
            }
          } catch (err) {
            console.error("Error fetching payment details:", err);
          }
        }
        
        
        return enrichedTransaction;
      })
    );
    
    return c.json({ ...data, data: enrichedTransactions });
  } catch (error) {
    console.error("Error fetching Asaas extract:", error);
    return c.json({ error: "Erro interno ao consultar extrato" }, 500);
  }
});

// Asaas balance
admin.get("/asaas-balance", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Acesso negado" }, 403);
  }

  try {
    const asaasConfig = getAsaasConfig(c);
    const response = await fetch(`${asaasConfig.baseUrl}/finance/balance`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Toodrop/1.0",
        "access_token": asaasConfig.apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Asaas balance error:", errorData);
      return c.json({ error: "Erro ao consultar saldo" }, 400);
    }

    const data = await response.json() as Record<string, unknown>;
    return c.json(data);
  } catch (error) {
    console.error("Error fetching Asaas balance:", error);
    return c.json({ error: "Erro interno ao consultar saldo" }, 500);
  }
});

// Delete user with cascade (requires password)
admin.delete("/users/:userId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const { password } = await c.req.json();
  if (password !== "2645") {
    return c.json({ error: "Senha incorreta" }, 401);
  }

  const userId = c.req.param("userId");

  // Check if trying to delete protected user (mcaorg@gmail.com)
  const userToDelete = await c.env.DB.prepare(
    "SELECT email FROM users WHERE id = ?"
  ).bind(userId).first();

  if (userToDelete && userToDelete.email === "mcaorg@gmail.com") {
    return c.json({ error: "Este usuário não pode ser deletado" }, 403);
  }

  try {
    // First, get all droptags created by or assigned to this user
    const droptags = await c.env.DB.prepare(
      "SELECT id FROM droptags WHERE consumer_user_id = ? OR receiver_user_id = ?"
    ).bind(userId, userId).all();

    // Delete all droptag-related records for each droptag
    for (const droptag of droptags.results || []) {
      const droptagId = droptag.id;
      
      // Delete droptag cascade records
      await c.env.DB.prepare("DELETE FROM delivery_scans WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM asaas_charges WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM platform_commissions WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM droptag_authorized_receivers WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM driver_deliveries WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM receiver_deliveries WHERE droptag_id = ?").bind(droptagId).run();
      await c.env.DB.prepare("DELETE FROM secret_word_attempts WHERE droptag_id = ?").bind(droptagId).run();
      
      // Delete the droptag itself
      await c.env.DB.prepare("DELETE FROM droptags WHERE id = ?").bind(droptagId).run();
    }

    // Delete user-specific records (child tables first)
    await c.env.DB.prepare("DELETE FROM receiver_doc_validations WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM receiver_docs WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM addresses WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM saved_cards WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM commission_history WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM admins WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM schedules WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM delivery_driver_locations WHERE user_id = ?").bind(userId).run();
    
    // Delete any remaining deliveries (shouldn't exist after droptag deletion, but just in case)
    await c.env.DB.prepare("DELETE FROM driver_deliveries WHERE driver_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM receiver_deliveries WHERE receiver_user_id = ?").bind(userId).run();
    
    // Delete any remaining platform commissions referencing this user
    await c.env.DB.prepare("DELETE FROM platform_commissions WHERE consumer_user_id = ? OR driver_user_id = ? OR receiver_user_id = ?").bind(userId, userId, userId).run();
    await c.env.DB.prepare("DELETE FROM asaas_charges WHERE driver_user_id = ? OR receiver_user_id = ?").bind(userId, userId).run();
    
    // Finally delete the user
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Erro ao deletar usuário" }, 500);
  }
});

// Delete droptag with cascade (requires password)
admin.delete("/droptags/:droptagId", unifiedAuthMiddleware, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminRecord = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE user_id = ?"
  ).bind(user.id).first();

  if (!adminRecord) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const { password } = await c.req.json();
  if (password !== "2645") {
    return c.json({ error: "Senha incorreta" }, 401);
  }

  const droptagId = c.req.param("droptagId");

  try {
    // Delete related records first
    await c.env.DB.prepare("DELETE FROM driver_deliveries WHERE droptag_id = ?").bind(droptagId).run();
    await c.env.DB.prepare("DELETE FROM receiver_deliveries WHERE droptag_id = ?").bind(droptagId).run();
    await c.env.DB.prepare("DELETE FROM asaas_charges WHERE droptag_id = ?").bind(droptagId).run();
    await c.env.DB.prepare("DELETE FROM platform_commissions WHERE droptag_id = ?").bind(droptagId).run();
    
    // Finally delete the droptag
    await c.env.DB.prepare("DELETE FROM droptags WHERE id = ?").bind(droptagId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting droptag:", error);
    return c.json({ error: "Erro ao deletar droptag" }, 500);
  }
});

// Get withdrawal requests
admin.get("/withdrawals", unifiedAuthMiddleware, async (c) => {
  try {
    const mochaUser = c.get("user");
    if (!mochaUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const adminRecord = await c.env.DB.prepare(
      "SELECT id FROM admins WHERE user_id = ?"
    ).bind(user.id).first();

    if (!adminRecord) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Get all withdrawal requests
    const withdrawals = await c.env.DB.prepare(
      `SELECT 
        wr.id,
        wr.user_id,
        wr.amount,
        wr.pix_key,
        wr.status,
        wr.created_at,
        wr.updated_at,
        wr.processed_at,
        wr.admin_notes,
        u.full_name as user_name,
        u.cpf as user_cpf,
        u.phone
      FROM withdrawal_requests wr
      JOIN users u ON wr.user_id = u.id
      ORDER BY 
        CASE wr.status 
          WHEN 'pending' THEN 1 
          WHEN 'paid' THEN 2 
          WHEN 'cancelled' THEN 3 
        END,
        wr.created_at DESC`
    ).all();

    return c.json({ withdrawals: withdrawals.results || [] });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return c.json({ 
      error: "Erro ao buscar solicitações de saque",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Update withdrawal status
admin.put("/withdrawals/:id", unifiedAuthMiddleware, async (c) => {
  try {
    const mochaUser = c.get("user");
    if (!mochaUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is admin
    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const adminRecord = await c.env.DB.prepare(
      "SELECT id FROM admins WHERE user_id = ?"
    ).bind(user.id).first();

    if (!adminRecord) {
      return c.json({ error: "Access denied" }, 403);
    }

    const withdrawalId = parseInt(c.req.param("id"));
    const { status } = await c.req.json();

    if (!["pending", "paid", "cancelled"].includes(status)) {
      return c.json({ error: "Status inválido" }, 400);
    }

    // Get withdrawal request
    const withdrawal = await c.env.DB.prepare(
      "SELECT * FROM withdrawal_requests WHERE id = ?"
    ).bind(withdrawalId).first() as any;

    if (!withdrawal) {
      return c.json({ error: "Solicitação não encontrada" }, 404);
    }

    // If cancelling, return amount to user balance
    if (status === "cancelled" && withdrawal.status === "pending") {
      const userBalance = await c.env.DB.prepare(
        "SELECT balance FROM users WHERE id = ?"
      ).bind(withdrawal.user_id).first() as { balance: number } | null;

      const newBalance = (Number(userBalance?.balance) || 0) + Number(withdrawal.amount);

      await c.env.DB.prepare(
        "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(newBalance, withdrawal.user_id).run();

      // Create transaction record
      await c.env.DB.prepare(
        `INSERT INTO user_transactions (
          user_id, type, amount, description, balance_after, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        withdrawal.user_id,
        "withdrawal_cancelled",
        Number(withdrawal.amount),
        "Saque cancelado - valor devolvido",
        newBalance,
        "completed"
      ).run();
    }

    // Update withdrawal status
    await c.env.DB.prepare(
      `UPDATE withdrawal_requests 
       SET status = ?, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(status, withdrawalId).run();

    // Update related transaction status if exists - find the most recent matching transaction
    await c.env.DB.prepare(
      `UPDATE user_transactions 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = (
         SELECT id FROM user_transactions 
         WHERE user_id = ? AND type = 'withdrawal_requested' AND amount = ? AND status = 'pending'
         ORDER BY created_at DESC 
         LIMIT 1
       )`
    ).bind(
      status === "paid" ? "completed" : status === "cancelled" ? "cancelled" : "pending",
      withdrawal.user_id,
      -Number(withdrawal.amount)
    ).run();

    return c.json({ success: true, message: "Status atualizado com sucesso" });
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    return c.json({ 
      error: "Erro ao atualizar status",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Send reminder emails to pending hub registrations
// Called by Google Cloud Scheduler every 3 days
admin.post("/send-pending-reminders", adminMiddleware, async (c) => {
  try {
    // Find users with:
    // 1. is_receiver_pending = 1 AND no receiver_docs record at all
    // 2. is_receiver_pending = 1 AND receiver_docs without address_proof_url (incomplete docs)
    // 3. receiver_docs.status = 'pending' (in_analysis) AND no address_proof_url
    const pendingUsers = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        ec.email as credential_email,
        a.nickname as hub_nickname
      FROM users u
      LEFT JOIN email_credentials ec ON u.email_credential_id = ec.id
      INNER JOIN addresses a ON u.id = a.user_id AND a.address_type = 'receiver'
      WHERE u.is_receiver_pending = 1
        AND u.is_receiver_active = 0
        AND (u.email IS NOT NULL OR ec.email IS NOT NULL)
    `).all();

    const results = {
      total: pendingUsers.results?.length || 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const user of pendingUsers.results || []) {
      const userEmail = user.email || user.credential_email;
      if (!userEmail || !user.full_name) continue;

      // Extract first name
      const firstName = (user.full_name as string).split(' ')[0];
      const hubNickname = (user.hub_nickname as string) || "";

      const emailData = pendingHubReminderEmail(firstName, hubNickname);

      try {
        if (!c.env.EMAILS) {
          results.failed++;
          results.errors.push(`User ${user.id}: Email service not configured`);
          continue;
        }

        const result = await c.env.EMAILS.send({
          to: userEmail as string,
          subject: emailData.subject,
          html_body: emailData.html_body,
          text_body: emailData.text_body,
        });

        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`User ${user.id}: ${result.error}`);
        }
      } catch (emailError) {
        results.failed++;
        results.errors.push(`User ${user.id}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
      }
    }

    return c.json({
      success: true,
      message: `Lembretes enviados: ${results.sent} de ${results.total}`,
      results
    });
  } catch (error) {
    console.error("Error sending pending reminders:", error);
    return c.json({
      error: "Erro ao enviar lembretes",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Test endpoint to preview email template
admin.post("/test-email", adminMiddleware, async (c) => {
  try {
    const { template, email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    let emailData;
    
    switch (template) {
      case "pending-reminder":
        emailData = pendingHubReminderEmail("Marcelo");
        break;
      case "approved":
        emailData = receiverPointApprovedEmail("Marcelo Amancio", "Hub Teste");
        break;
      case "rejected":
        emailData = receiverPointRejectedEmail("Marcelo Amancio", "Hub Teste", "Documentos ilegíveis");
        break;
      case "pending":
        emailData = receiverPointPendingEmail("Marcelo Amancio", "Hub Teste", "Por favor, envie novamente o documento de identidade com melhor qualidade.");
        break;
      default:
        emailData = pendingHubReminderEmail("Marcelo");
    }

    if (!c.env.EMAILS) {
      return c.json({ error: "Email service not configured" }, 500);
    }

    const result = await c.env.EMAILS.send({
      to: email,
      subject: emailData.subject,
      html_body: emailData.html_body,
      text_body: emailData.text_body,
    });

    if (result.success) {
      return c.json({ success: true, message: "Email enviado!", message_id: result.message_id });
    } else {
      return c.json({ error: result.error }, 500);
    }
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Get communication recipients by group
admin.get("/communication/recipients", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    `SELECT u.id FROM users u INNER JOIN admins a ON u.id = a.user_id WHERE u.${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const group = c.req.query("group") as string;

  let sql = `
    SELECT u.id, u.full_name, u.email, ec.email as credential_email
    FROM users u
    LEFT JOIN email_credentials ec ON u.email_credential_id = ec.id
    WHERE (u.email IS NOT NULL OR ec.email IS NOT NULL)
      AND u.is_active != 0
  `;

  const bindings: string[] = [];

  if (group && group !== "all") {
    sql += ` AND u.main_interest = ?`;
    bindings.push(group);
  }

  sql += ` ORDER BY u.full_name ASC`;

  const stmt = bindings.length > 0
    ? c.env.DB.prepare(sql).bind(...bindings)
    : c.env.DB.prepare(sql);

  const { results } = await stmt.all();

  const recipients = (results as any[]).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email || row.credential_email,
  }));

  return c.json(recipients);
});

// Send broadcast email to recipients
admin.post("/communication/send", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const adminUser = await c.env.DB.prepare(
    `SELECT u.id FROM users u INNER JOIN admins a ON u.id = a.user_id WHERE u.${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!adminUser) {
    return c.json({ error: "Unauthorized - Admin access required" }, 401);
  }

  const { subject, message, recipients } = await c.req.json() as {
    subject: string;
    message: string;
    recipients: Array<{ id: number; email: string; full_name: string }>;
  };

  if (!subject || !message || !recipients || recipients.length === 0) {
    return c.json({ error: "Campos obrigatórios ausentes" }, 400);
  }


  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const recipient of recipients) {
    try {
      const firstName = recipient.full_name ? recipient.full_name.trim().split(/\s+/)[0] : "";
      const fullName = recipient.full_name || "";
      const personalize = (text: string) =>
        text.replace(/\{\{nome\}\}/gi, firstName).replace(/\{\{nome_completo\}\}/gi, fullName);

      const emailContent = broadcastEmail(personalize(subject), personalize(message));
      await c.env.EMAILS.send({
        to: recipient.email,
        subject: emailContent.subject,
        html_body: emailContent.html_body,
        text_body: emailContent.text_body,
      });
      sent++;
    } catch (err) {
      failed++;
      errors.push(`${recipient.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return c.json({ sent, failed, errors });
});

export default admin;
