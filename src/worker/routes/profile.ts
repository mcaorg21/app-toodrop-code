import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { CompleteProfileInputSchema } from "@/shared/types";
import { welcomeEmail } from "@/worker/utils/email-templates";

// Helper to get user identifier and query params for both auth types
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

const profile = new Hono<{ Bindings: Env }>();

// Helper function to get Asaas config based on environment
function getAsaasConfig(c: any) {
  const host = c.req.header('host') || '';
  const isProduction = host === 'app.toodrop.com';
  
  return {
    baseUrl: isProduction ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3',
    apiKey: isProduction ? c.env.ASAAS_API_KEY_PRODUCAO : c.env.ASAAS_API_KEY
  };
}

// Update last active tab
profile.post("/last-active-tab", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { tab } = body;

  if (!tab || !["consumer", "receiver", "delivery"].includes(tab)) {
    return c.json({ error: "Tab inválida" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET last_active_tab = ?, main_interest = ?, updated_at = CURRENT_TIMESTAMP WHERE ${userQuery.field} = ?`
  ).bind(tab, tab, userQuery.value).run();

  return c.json({ success: true });
});

// Check if CPF is available
profile.get("/check-cpf/:cpf", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cpf = c.req.param("cpf");
  const cleanCpf = cpf.replace(/\D/g, "");

  const existingUser = await c.env.DB.prepare(
    `SELECT id FROM users WHERE cpf = ? AND ${userQuery.field} != ?`
  ).bind(cleanCpf, userQuery.value).first();

  return c.json({ available: !existingUser });
});

// Get or create app user profile
profile.get("/", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  let user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    await c.env.DB.prepare(
      `INSERT INTO users (${userQuery.field}, profile_status, email) VALUES (?, ?, ?)`
    ).bind(userQuery.value, "incomplete", userQuery.email).run();

    user = await c.env.DB.prepare(
      `SELECT * FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first();
  } else {
    // Update email if changed or missing
    const userData = user as any;
    if (userQuery.email && userData.email !== userQuery.email) {
      await c.env.DB.prepare(
        `UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE ${userQuery.field} = ?`
      ).bind(userQuery.email, userQuery.value).run();
    }
  }

  // Check if user is deactivated
  const userData = user as any;
  if (userData.is_active === 0) {
    return c.json({ error: "Usuário desativado. Entre em contato com o suporte." }, 403);
  }

  // Check if user has complete profile but no Asaas customer ID
  if (userData.profile_status === "complete" && !userData.id_customer_asaas && userData.full_name && userData.cpf) {
    try {
      const asaasConfig = getAsaasConfig(c);
      
      // In development, modify email to avoid conflicts with existing Asaas accounts
      let asaasEmail = userQuery.email || '';
      const host = c.req.header('host') || '';
      const isProduction = host === 'app.toodrop.com';
      if (!isProduction && asaasEmail.includes('@gmail.com')) {
        asaasEmail = asaasEmail.replace('@gmail.com', '_2@gmail.com');
      }
      
      const asaasResponse = await fetch(`${asaasConfig.baseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": asaasConfig.apiKey,
          "User-Agent": "TDV4/1.0",
        },
        body: JSON.stringify({
          name: userData.full_name,
          cpfCnpj: userData.cpf.replace(/\D/g, ""),
          email: asaasEmail,
        }),
      });

      if (asaasResponse.ok) {
        const asaasData = await asaasResponse.json() as any;
        const asaasCustomerId = asaasData.id;
        console.log("Created Asaas customer for existing user:", asaasCustomerId);

        await c.env.DB.prepare(
          `UPDATE users SET id_customer_asaas = ?, updated_at = CURRENT_TIMESTAMP WHERE ${userQuery.field} = ?`
        ).bind(asaasCustomerId, userQuery.value).run();

        // Refresh user data
        user = await c.env.DB.prepare(
          `SELECT * FROM users WHERE ${userQuery.field} = ?`
        ).bind(userQuery.value).first();
      } else {
        const errorText = await asaasResponse.text();
        console.error("Failed to create Asaas customer for existing user:", errorText);
      }
    } catch (err) {
      console.error("Error creating Asaas customer for existing user:", err);
    }
  }

  return c.json(user);
});

// Complete profile
profile.post("/complete", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  
  const parsed = CompleteProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map(e => e.message).join(", ");
    return c.json({ error: errorMessage }, 400);
  }

  const { full_name, cpf, birth_date, phone, main_interest } = parsed.data;

  // Check if CPF is already used
  const existingUser = await c.env.DB.prepare(
    `SELECT id FROM users WHERE cpf = ? AND ${userQuery.field} != ?`
  ).bind(cpf, userQuery.value).first();

  if (existingUser) {
    return c.json({ error: "CPF já está em uso" }, 400);
  }

  // Create Asaas customer
  let asaasCustomerId: string | null = null;
  try {
    const asaasConfig = getAsaasConfig(c);
    
    // In development, modify email to avoid conflicts with existing Asaas accounts
    let asaasEmail = userQuery.email || '';
    const host = c.req.header('host') || '';
    const isProduction = host === 'app.toodrop.com';
    if (!isProduction && asaasEmail.includes('@gmail.com')) {
      asaasEmail = asaasEmail.replace('@gmail.com', '_2@gmail.com');
    }
    
    const asaasResponse = await fetch(`${asaasConfig.baseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": asaasConfig.apiKey,
        "User-Agent": "TDV4/1.0",
      },
      body: JSON.stringify({
        name: full_name,
        cpfCnpj: cpf.replace(/\D/g, ""),
        email: asaasEmail,
      }),
    });

    const responseText = await asaasResponse.text();
    console.log("Asaas customer response status:", asaasResponse.status);
    console.log("Asaas customer response body:", responseText);

    if (asaasResponse.ok) {
      const asaasData = JSON.parse(responseText);
      asaasCustomerId = asaasData.id;
      console.log("Created Asaas customer:", asaasCustomerId);
    } else {
      console.error("Failed to create Asaas customer:", responseText);
      // Continue with registration even if Asaas fails
    }
  } catch (err) {
    console.error("Error creating Asaas customer:", err);
    // Continue with registration even if Asaas fails
  }

  await c.env.DB.prepare(
    `UPDATE users 
     SET full_name = ?, cpf = ?, birth_date = ?, phone = ?, pix_key = ?, 
         main_interest = ?, last_active_tab = ?, profile_status = ?, id_customer_asaas = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE ${userQuery.field} = ?`
  ).bind(full_name, cpf, birth_date, phone, cpf, main_interest, main_interest, "complete", asaasCustomerId, userQuery.value).run();

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  // Send welcome email (only in production)
  if (userQuery.email && c.env.EMAILS) {
    try {
      const email = welcomeEmail(full_name, main_interest);
      await c.env.EMAILS.send({
        to: userQuery.email,
        subject: email.subject,
        html_body: email.html_body,
        text_body: email.text_body,
      });
      console.log(`[Welcome Email] Sent to ${userQuery.email}`);
    } catch (error) {
      console.error("[Welcome Email] Error:", error);
      // Don't fail registration if email fails
    }
  }

  return c.json(user);
});

// Update main interest (default profile)
profile.post("/main-interest", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { main_interest } = body;

  if (!main_interest || !["consumer", "receiver", "delivery"].includes(main_interest)) {
    return c.json({ error: "Interesse principal inválido" }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE users SET main_interest = ?, updated_at = CURRENT_TIMESTAMP WHERE ${userQuery.field} = ?`
  ).bind(main_interest, userQuery.value).run();

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  return c.json(user);
});

// Save commission address (subconta created later when needed)
profile.post("/commission-address", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { cep, street, number, complement, neighborhood, city, state } = body;

  // Validate required fields
  if (!cep || !street || !number || !neighborhood || !city || !state) {
    return c.json({ error: "Todos os campos obrigatórios devem ser preenchidos" }, 400);
  }

  // Get user data
  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first() as any;

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  if (!user.full_name || !user.cpf || !user.phone) {
    return c.json({ error: "Complete seu cadastro básico primeiro" }, 400);
  }

  // Save commission address to database
  // Asaas subconta will be created later:
  // - For TooDroper: when admin approves receiver point
  // - For Dropper: when they scan their first package
  await c.env.DB.prepare(
    `UPDATE users 
     SET commission_cep = ?, commission_street = ?, commission_number = ?, 
         commission_complement = ?, commission_neighborhood = ?, commission_city = ?, 
         commission_state = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(cep, street, number, complement || null, neighborhood, city, state, user.id).run();

  const updatedUser = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(user.id).first();

  return c.json(updatedUser);
});

// Mark tour as seen
profile.post("/tour-seen", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { tourKey } = body;

  const validTours = ["consumer", "receiver", "delivery"];
  if (!tourKey || !validTours.includes(tourKey)) {
    return c.json({ error: "Tour inválido" }, 400);
  }

  const columnName = `has_seen_${tourKey}_tour`;
  
  await c.env.DB.prepare(
    `UPDATE users SET ${columnName} = 1, updated_at = CURRENT_TIMESTAMP WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).run();

  return c.json({ success: true });
});

// Get user's balance from internal wallet


// List PIX keys from Asaas
profile.get("/pix-keys", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first() as any;

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  if (!user.asaas_api_key || !user.asaas_wallet_id) {
    return c.json({ error: "Carteira não configurada" }, 400);
  }

  try {
    const asaasConfig = getAsaasConfig(c);
    // First, check existing PIX keys
    const response = await fetch(`${asaasConfig.baseUrl}/pix/addressKeys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Toodrop/1.0",
        "access_token": user.asaas_api_key || asaasConfig.apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      console.error("Asaas PIX keys error:", errorData);
      return c.json({ error: "Erro ao buscar chaves PIX", keys: [] }, 200);
    }

    const data = await response.json() as any;
    const keys = data.data || [];

    // If no keys exist and user has CPF, create one automatically
    if (keys.length === 0 && user.cpf) {
      try {
        console.log("No PIX keys found, creating CPF key for user:", user.id);
        
        const createResponse = await fetch(`${asaasConfig.baseUrl}/pix/addressKeys`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Toodrop/1.0",
            "access_token": user.asaas_api_key || asaasConfig.apiKey,
          },
          body: JSON.stringify({
            type: "CPF",
            addressKey: user.cpf.replace(/[^\d]/g, ''), // Remove formatting
          }),
        });

        if (createResponse.ok) {
          const newKey = await createResponse.json();
          console.log("PIX key created successfully:", newKey);
          
          // Update user's pix_key in database
          await c.env.DB.prepare(
            "UPDATE users SET pix_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(user.cpf.replace(/[^\d]/g, ''), user.id).run();
          
          // Return the newly created key
          return c.json({ keys: [newKey], created: true });
        } else {
          const errorData = await createResponse.json();
          console.error("Error creating PIX key:", errorData);
          // Return empty array if creation failed
          return c.json({ keys: [], error: "Não foi possível criar chave PIX automaticamente" });
        }
      } catch (createError) {
        console.error("Error creating PIX key:", createError);
        return c.json({ keys: [], error: "Erro ao criar chave PIX" });
      }
    }

    return c.json({ keys });
  } catch (error) {
    console.error("Error fetching PIX keys:", error);
    return c.json({ error: "Erro interno ao buscar chaves PIX", keys: [] }, 200);
  }
});

// Create PIX withdrawal
profile.post("/withdraw", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const { value } = await c.req.json();

    if (!value || value < 20) {
      return c.json({ error: "Valor mínimo para saque é R$ 20,00" }, 400);
    }

    // Get user
    const user = await c.env.DB.prepare(
      `SELECT id, cpf FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first() as { id: number; cpf: string } | null;

    if (!user) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    // Get PIX key (CPF)
    const pixKey = user.cpf;
    if (!pixKey) {
      return c.json({ error: "CPF não encontrado no cadastro" }, 400);
    }

    // Calculate actual balance from transactions (same as /balance endpoint)
    // Includes: confirmed/completed commissions (+), referral commissions (always valid),
    // and pending withdrawals (-)
    const balanceResult = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as calculated_balance
       FROM user_transactions 
       WHERE user_id = ? AND (
         status IN ('confirmed', 'completed') 
         OR (type = 'withdrawal_requested' AND status = 'pending')
         OR type = 'referral_commission'
       )`
    ).bind(user.id).first() as { calculated_balance: number } | null;

    const currentBalance = Number(balanceResult?.calculated_balance) || 0;
    if (currentBalance < value) {
      return c.json({ error: "Saldo insuficiente" }, 400);
    }

    // Create withdrawal request
    await c.env.DB.prepare(
      `INSERT INTO withdrawal_requests (
        user_id, amount, pix_key, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(user.id, value, pixKey, "pending").run();

    // Calculate new balance after withdrawal (for balance_after field)
    const newBalance = currentBalance - value;

    // Create transaction record (balance is now calculated dynamically from transactions)
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, balance_after, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      user.id,
      "withdrawal_requested",
      -value,
      "Solicitação de saque",
      newBalance,
      "pending"
    ).run();

    return c.json({
      success: true,
      message: "Solicitação de saque enviada com sucesso",
      new_balance: newBalance
    });

  } catch (error) {
    console.error("Withdrawal request error:", error);
    return c.json({ 
      error: "Erro ao processar solicitação de saque",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get wallet balance
profile.get("/balance", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const user = await c.env.DB.prepare(
      `SELECT id FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first() as { id: number } | null;

    if (!user) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    // Calculate actual balance from transactions
    // Includes: confirmed/completed commissions (+), referral commissions (always valid), 
    // completed withdrawals (-), and pending withdrawals (-)
    const balanceResult = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as calculated_balance
       FROM user_transactions 
       WHERE user_id = ? AND (
         status IN ('confirmed', 'completed') 
         OR (type = 'withdrawal_requested' AND status = 'pending')
         OR type = 'referral_commission'
       )`
    ).bind(user.id).first() as { calculated_balance: number } | null;

    // Calculate pending balance (pending commission_received transactions)
    const pendingResult = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as pending_total 
       FROM user_transactions 
       WHERE user_id = ? AND type = 'commission_received' AND status = 'pending'`
    ).bind(user.id).first() as { pending_total: number } | null;

    return c.json({ 
      balance: Number(balanceResult?.calculated_balance) || 0,
      pending_balance: Number(pendingResult?.pending_total) || 0
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return c.json({ error: "Erro ao carregar saldo" }, 500);
  }
});

// Get wallet extract (transactions)
profile.get("/extract", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const user = await c.env.DB.prepare(
      `SELECT id FROM users WHERE ${userQuery.field} = ?`
    ).bind(userQuery.value).first();

    if (!user) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    const startDate = c.req.query("startDate") || "";
    const endDate = c.req.query("endDate") || "";
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    // Build query with date filters
    let query = `
      SELECT * FROM user_transactions 
      WHERE user_id = ?
    `;
    const params: any[] = [user.id];

    if (startDate) {
      query += ` AND date(created_at) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date(created_at) <= date(?)`;
      params.push(endDate);
    }

    // Get total count
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
    const countResult = await c.env.DB.prepare(countQuery).bind(...params).first();
    const totalCount = (countResult?.count as number) || 0;

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const transactionsResult = await c.env.DB.prepare(query).bind(...params).all();
    const transactions = transactionsResult.results || [];

    // Enrich transactions with delivery details
    const enrichedTransactions = await Promise.all(
      transactions.map(async (transaction: any) => {
        if (!transaction.related_droptag_id) {
          return transaction;
        }

        // Get droptag details
        const droptag = await c.env.DB.prepare(
          `SELECT 
            d.*,
            consumer.full_name as consumer_name,
            consumer.phone as consumer_phone,
            addr.street, addr.number, addr.complement, addr.neighborhood, addr.city, addr.state
          FROM droptags d
          LEFT JOIN users consumer ON d.consumer_user_id = consumer.id
          LEFT JOIN addresses addr ON d.address_id = addr.id
          WHERE d.id = ?`
        ).bind(transaction.related_droptag_id).first();

        if (!droptag) {
          return transaction;
        }

        // Get driver delivery info
        const driverDelivery = await c.env.DB.prepare(
          `SELECT dd.*, driver.full_name as driver_name, driver.phone as driver_phone
          FROM driver_deliveries dd
          LEFT JOIN users driver ON dd.driver_user_id = driver.id
          WHERE dd.droptag_id = ?`
        ).bind(transaction.related_droptag_id).first();

        // Get receiver delivery info
        const receiverDelivery = await c.env.DB.prepare(
          `SELECT rd.*, receiver.full_name as receiver_name, receiver.phone as receiver_phone
          FROM receiver_deliveries rd
          LEFT JOIN users receiver ON rd.receiver_user_id = receiver.id
          WHERE rd.droptag_id = ?`
        ).bind(transaction.related_droptag_id).first();

        return {
          ...transaction,
          delivery_details: {
            droptag,
            driver_delivery: driverDelivery,
            receiver_delivery: receiverDelivery
          }
        };
      })
    );

    return c.json({
      data: enrichedTransactions,
      totalCount
    });
  } catch (error) {
    console.error("Error getting wallet extract:", error);
    return c.json({ error: "Erro ao carregar extrato" }, 500);
  }
});

export default profile;
