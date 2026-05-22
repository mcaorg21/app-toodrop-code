import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { packagePickedUpEmail } from "@/worker/utils/email-templates";

const payments = new Hono<{ Bindings: Env }>();

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

// Helper function to get Asaas config based on environment
function getAsaasConfig(c: any) {
  const host = c.req.header('host') || '';
  const isProduction = host === 'app.toodrop.com';
  
  return {
    baseUrl: isProduction ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3',
    apiKey: isProduction ? c.env.ASAAS_API_KEY_PRODUCAO : c.env.ASAAS_API_KEY
  };
}

// Create payment (PIX or Credit Card)
payments.post("/create", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { droptag_id, billing_type, creditCard, save_card, use_saved_card } = body;

  if (!droptag_id || !billing_type) {
    return c.json({ error: "droptag_id e billing_type são obrigatórios" }, 400);
  }

  if (!["PIX", "CREDIT_CARD"].includes(billing_type)) {
    return c.json({ error: "billing_type deve ser PIX ou CREDIT_CARD" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get user's primary address for credit card holder info
  const userAddress = await c.env.DB.prepare(
    "SELECT * FROM addresses WHERE user_id = ? AND address_type = 'consumer' ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id).first();

  // Check if user has Asaas customer ID, create if not
  let customerId = user.id_customer_asaas as string | null;
  
  if (!customerId) {
    // Create customer in Asaas
    const asaasConfig = getAsaasConfig(c);
    const customerPayload = {
      name: user.full_name || "Cliente Toodrop",
      cpfCnpj: (user.cpf as string)?.replace(/\D/g, "") || null,
      email: userQuery.email || null,
      phone: (user.phone as string)?.replace(/\D/g, "") || null,
      externalReference: String(user.id)
    };

    console.log("[Payment Create] Creating customer with payload:", JSON.stringify(customerPayload, null, 2));
    
    const customerResponse = await fetch(`${asaasConfig.baseUrl}/customers`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "access_token": asaasConfig.apiKey,
        "User-Agent": "Toodrop/1.0"
      },
      body: JSON.stringify(customerPayload)
    });

    const customerText = await customerResponse.text();
    console.log("[Payment Create] Customer response status:", customerResponse.status);
    console.log("[Payment Create] Customer response text:", customerText);
    
    let customerData: any;
    try {
      customerData = JSON.parse(customerText);
    } catch (parseError) {
      console.error("[Payment Create] Failed to parse customer response:", customerText);
      return c.json({ 
        error: "Resposta inválida do Asaas ao criar cliente", 
        details: customerText 
      }, 500);
    }

    if (!customerResponse.ok) {
      console.error("Asaas customer creation error:", customerData);
      
      // Extract user-friendly error message
      let errorMessage = "Erro ao criar cliente no Asaas";
      if (customerData.errors && Array.isArray(customerData.errors) && customerData.errors.length > 0) {
        const firstError = customerData.errors[0];
        if (firstError.description) {
          errorMessage = firstError.description;
        }
      }
      
      return c.json({ 
        error: errorMessage, 
        details: customerData 
      }, 400);
    }

    customerId = customerData.id;

    // Save customer ID to user
    await c.env.DB.prepare(
      "UPDATE users SET id_customer_asaas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(customerId, user.id).run();
  }

  // Get droptag and verify it belongs to user
  const droptag = await c.env.DB.prepare(
    "SELECT * FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptag_id, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag não encontrada" }, 404);
  }

  // Check if there's already a pending charge for this droptag
  const existingCharge = await c.env.DB.prepare(
    "SELECT * FROM asaas_charges WHERE droptag_id = ? AND status = 'pending' AND billing_type = ?"
  ).bind(droptag_id, billing_type).first();

  if (existingCharge) {
    // Return existing charge data
    return c.json({
      charge_id: existingCharge.id,
      asaas_payment_id: existingCharge.asaas_payment_id,
      billing_type: existingCharge.billing_type,
      value: existingCharge.value,
      status: existingCharge.status,
      pix_qr_code: existingCharge.pix_qr_code,
      pix_copy_paste: existingCharge.pix_copy_paste,
      invoice_url: existingCharge.invoice_url,
      message: "Cobrança existente encontrada"
    });
  }

  // Get receiver delivery data
  const receiverDelivery = await c.env.DB.prepare(
    "SELECT * FROM receiver_deliveries WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(droptag_id).first();

  if (!receiverDelivery) {
    return c.json({ error: "Entrega não encontrada no recebedor" }, 404);
  }

  // Get driver delivery data  
  const driverDelivery = await c.env.DB.prepare(
    "SELECT * FROM driver_deliveries WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(droptag_id).first();

  if (!driverDelivery) {
    return c.json({ error: "Entrega não encontrada no motorista" }, 404);
  }

  // Wallet validation removed - no longer using Asaas split

  // Get values from deliveries tables
  const servicePrice = Number(receiverDelivery.service_price) || 10;
  const driverCommissionPercent = Number(driverDelivery.commission_percent) || 20;
  const receiverCommissionPercent = Number(receiverDelivery.commission_percent) || 60;
  const platformCommissionPercent = 100 - driverCommissionPercent - receiverCommissionPercent;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (billing_type === "PIX" ? 1 : 2));
  const dueDateStr = dueDate.toISOString().split("T")[0];

  // Build description
  const description = `Toodrop - Entrega #${droptag_id} - ${droptag.title || droptag.tracking_code || "Sem título"}`;

  // Build payment payload without split - commission distribution handled internally
  const paymentPayload: any = {
    customer: customerId,
    billingType: billing_type,
    value: servicePrice,
    dueDate: dueDateStr,
    description: description,
    externalReference: String(droptag_id),
    postalService: false,
    callback: {
      autoRedirect: false,
      successUrl: "https://app.toodrop.com/"
    }
  };

  // Add credit card data if provided
  if (billing_type === "CREDIT_CARD") {
    if (use_saved_card) {
      // Get saved card token from saved_cards table
      const savedCard = await c.env.DB.prepare(
        "SELECT * FROM saved_cards WHERE user_id = ? AND is_default = 1 ORDER BY created_at DESC LIMIT 1"
      ).bind(user.id).first();

      if (savedCard && savedCard.card_token) {
        paymentPayload.creditCardToken = savedCard.card_token;
        // Note: creditCardHolderInfo is NOT needed when using a token
        // The token already contains all cardholder information
      } else {
        return c.json({ error: "Nenhum cartão salvo encontrado" }, 400);
      }
    } else if (creditCard) {
      // Use new card details
      paymentPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.number,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      };
      // Credit card holder info (required by Asaas for credit card payments)
      paymentPayload.creditCardHolderInfo = {
        name: creditCard.holderName,
        cpfCnpj: (user.cpf as string)?.replace(/\D/g, "") || null,
        email: userQuery.email || null,
        phone: (user.phone as string)?.replace(/\D/g, "") || null,
        postalCode: userAddress ? (userAddress.cep as string)?.replace(/\D/g, "") : null,
        addressNumber: userAddress ? String(userAddress.number) : null
      };
    } else {
      return c.json({ error: "Dados do cartão são obrigatórios" }, 400);
    }
  }

  try {
    const asaasConfig = getAsaasConfig(c);
    console.log("[Payment Create] customerId:", customerId);
    console.log("[Payment Create] use_saved_card:", use_saved_card);
    console.log("[Payment Create] billing_type:", billing_type);
    console.log("[Payment Create] paymentPayload:", JSON.stringify(paymentPayload, null, 2));
    
    // Create payment in Asaas
    const asaasResponse = await fetch(`${asaasConfig.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "access_token": asaasConfig.apiKey,
        "User-Agent": "Toodrop/1.0"
      },
      body: JSON.stringify(paymentPayload)
    });

    const asaasText = await asaasResponse.text();
    console.log("[Payment Create] Asaas response status:", asaasResponse.status);
    console.log("[Payment Create] Asaas response text:", asaasText);
    
    let asaasData: any;
    try {
      asaasData = JSON.parse(asaasText);
    } catch (parseError) {
      console.error("[Payment Create] Failed to parse Asaas response:", asaasText);
      return c.json({ 
        error: "Resposta inválida do Asaas", 
        details: asaasText 
      }, 500);
    }

    if (!asaasResponse.ok) {
      console.error("Asaas error:", asaasData);
      
      // Extract user-friendly error message from Asaas response
      let errorMessage = "Erro ao criar cobrança no Asaas";
      
      if (asaasData.errors && Array.isArray(asaasData.errors) && asaasData.errors.length > 0) {
        // Get the first error description (most relevant)
        const firstError = asaasData.errors[0];
        if (firstError.description) {
          errorMessage = firstError.description;
        }
        
        // Map common error codes to friendly Portuguese messages
        const errorCode = firstError.code;
        const errorMappings: Record<string, string> = {
          "invalid_creditCard": "Número do cartão de crédito inválido",
          "invalid_creditCardNumber": "Número do cartão de crédito inválido",
          "invalid_creditCard.expiryMonth": "Mês de validade inválido",
          "invalid_creditCard.expiryYear": "Ano de validade inválido", 
          "invalid_creditCard.ccv": "CVV inválido",
          "invalid_creditCard.holderName": "Nome do titular inválido",
          "credit_card_expired": "Cartão de crédito expirado",
          "credit_card_declined": "Cartão de crédito recusado",
          "insufficient_funds": "Saldo insuficiente no cartão",
          "card_declined": "Cartão recusado pela operadora",
          "expired_card": "Cartão expirado",
          "processing_error": "Erro no processamento do pagamento. Tente novamente.",
          "invalid_cpfCnpj": "CPF/CNPJ inválido",
          "invalid_customer": "Dados do cliente inválidos"
        };
        
        if (errorCode && errorMappings[errorCode]) {
          errorMessage = errorMappings[errorCode];
        }
      }
      
      return c.json({ 
        error: errorMessage, 
        details: asaasData 
      }, 400);
    }

    let pixQrCode = null;
    let pixCopyPaste = null;

    // If PIX, get QR code
    if (billing_type === "PIX" && asaasData.id) {
      const pixResponse = await fetch(`${asaasConfig.baseUrl}/payments/${asaasData.id}/pixQrCode`, {
        method: "GET",
        headers: {
          "accept": "application/json",
          "access_token": asaasConfig.apiKey,
          "User-Agent": "Toodrop/1.0"
        }
      });

      if (pixResponse.ok) {
        const pixData: any = await pixResponse.json();
        pixQrCode = pixData.encodedImage;
        pixCopyPaste = pixData.payload;
      }
    }

    // Save charge to database
    await c.env.DB.prepare(
      `INSERT INTO asaas_charges 
       (droptag_id, asaas_payment_id, billing_type, value, status, due_date, description, 
        pix_qr_code, pix_copy_paste, invoice_url, driver_user_id, receiver_user_id,
        driver_commission_percent, receiver_commission_percent, platform_commission_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      droptag_id,
      asaasData.id,
      billing_type,
      servicePrice,
      "pending",
      dueDateStr,
      description,
      pixQrCode,
      pixCopyPaste,
      asaasData.invoiceUrl,
      driverDelivery.driver_user_id,
      receiverDelivery.receiver_user_id,
      driverCommissionPercent,
      receiverCommissionPercent,
      platformCommissionPercent
    ).run();

    const newCharge = await c.env.DB.prepare(
      "SELECT * FROM asaas_charges WHERE asaas_payment_id = ?"
    ).bind(asaasData.id).first();

    // Save credit card token if requested and available
    if (save_card && billing_type === "CREDIT_CARD" && asaasData.creditCard?.creditCardToken) {
      // Check if user already has 3 cards
      const cardCount = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM saved_cards WHERE user_id = ?"
      ).bind(user.id).first();

      if (cardCount && (cardCount.count as number) >= 3) {
        // Remove oldest card if limit reached
        const oldestCard = await c.env.DB.prepare(
          "SELECT id FROM saved_cards WHERE user_id = ? ORDER BY created_at ASC LIMIT 1"
        ).bind(user.id).first();
        
        if (oldestCard) {
          await c.env.DB.prepare(
            "DELETE FROM saved_cards WHERE id = ?"
          ).bind(oldestCard.id).run();
        }
      }

      // Insert new card
      await c.env.DB.prepare(
        `INSERT INTO saved_cards (user_id, card_token, card_brand, card_last_digits, is_default)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        user.id,
        asaasData.creditCard.creditCardToken,
        asaasData.creditCard.creditCardBrand || "UNKNOWN",
        asaasData.creditCard.creditCardNumber || "****",
        0
      ).run();

      // If this is the user's first card, set it as default
      const totalCards = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM saved_cards WHERE user_id = ?"
      ).bind(user.id).first();

      if (totalCards && (totalCards.count as number) === 1) {
        await c.env.DB.prepare(
          "UPDATE saved_cards SET is_default = 1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(user.id).run();
      }
    }

    return c.json({
      charge_id: newCharge?.id,
      asaas_payment_id: asaasData.id,
      billing_type: billing_type,
      value: servicePrice,
      status: "pending",
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      invoice_url: asaasData.invoiceUrl,
      due_date: dueDateStr,
      message: "Cobrança criada com sucesso",
      credit_card_token: asaasData.creditCard?.creditCardToken || null
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return c.json({ 
      error: "Erro interno ao criar cobrança",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Webhook to receive payment confirmation from Asaas
payments.post("/webhook", async (c) => {
  try {
    const body = await c.req.json();
    
    console.log("[Asaas Webhook] Received:", JSON.stringify(body));

    const { event, payment } = body;

    if (!payment || !payment.id) {
      return c.json({ error: "Invalid webhook payload" }, 400);
    }

    // Find charge by asaas_payment_id
    const charge = await c.env.DB.prepare(
      "SELECT * FROM asaas_charges WHERE asaas_payment_id = ?"
    ).bind(payment.id).first();

    if (!charge) {
      console.log(`[Asaas Webhook] Charge not found for payment ${payment.id}`);
      return c.json({ message: "Charge not found" }, 200);
    }

    let newStatus = charge.status;
    let paidAt = null;

    // Map Asaas events to our status
    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        newStatus = "paid";
        paidAt = new Date().toISOString();
        break;
      case "PAYMENT_OVERDUE":
        newStatus = "overdue";
        break;
      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
        newStatus = "cancelled";
        break;
      case "PAYMENT_UPDATED":
        // Check payment status from payload
        if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
          newStatus = "paid";
          paidAt = new Date().toISOString();
        }
        break;
    }

    // Update charge status
    if (paidAt) {
      await c.env.DB.prepare(
        `UPDATE asaas_charges 
         SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).bind(newStatus, paidAt, charge.id).run();
    } else {
      await c.env.DB.prepare(
        `UPDATE asaas_charges 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).bind(newStatus, charge.id).run();
    }

    // If payment confirmed, update commission status and register platform commission
    if (newStatus === "paid") {
      // Update driver_deliveries sub_status to commission_paid
      await c.env.DB.prepare(
        `UPDATE driver_deliveries 
         SET sub_status = 'commission_paid', updated_at = CURRENT_TIMESTAMP 
         WHERE droptag_id = ?`
      ).bind(charge.droptag_id).run();

      // Update receiver_deliveries status to picked_up and sub_status to commission_paid
      await c.env.DB.prepare(
        `UPDATE receiver_deliveries 
         SET status = 'picked_up', sub_status = 'commission_paid', picked_up_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE droptag_id = ?`
      ).bind(charge.droptag_id).run();

      // Update droptag status to completed
      await c.env.DB.prepare(
        `UPDATE droptags 
         SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).bind(charge.droptag_id).run();

      // Get droptag info for consumer
      const droptag = await c.env.DB.prepare(
        "SELECT consumer_user_id, title, tracking_code FROM droptags WHERE id = ?"
      ).bind(charge.droptag_id).first();

      // Get driver and receiver info with commission amounts
      const driverDelivery = await c.env.DB.prepare(
        "SELECT driver_user_id, commission_amount FROM driver_deliveries WHERE droptag_id = ?"
      ).bind(charge.droptag_id).first();

      const receiverDelivery = await c.env.DB.prepare(
        "SELECT receiver_user_id, commission_amount FROM receiver_deliveries WHERE droptag_id = ?"
      ).bind(charge.droptag_id).first();

      // Insert platform commission record
      await c.env.DB.prepare(
        `INSERT INTO platform_commissions (
          asaas_charge_id, droptag_id, consumer_user_id, driver_user_id, receiver_user_id,
          total_value, driver_commission_percent, driver_commission_amount,
          receiver_commission_percent, receiver_commission_amount,
          platform_commission_percent, platform_commission_amount,
          asaas_payment_id, paid_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        charge.id,
        charge.droptag_id,
        droptag?.consumer_user_id || null,
        driverDelivery?.driver_user_id || charge.driver_user_id,
        receiverDelivery?.receiver_user_id || charge.receiver_user_id,
        Number(charge.value),
        Number(charge.driver_commission_percent),
        (Number(charge.value) * (Number(charge.driver_commission_percent) || 0)) / 100,
        Number(charge.receiver_commission_percent),
        (Number(charge.value) * (Number(charge.receiver_commission_percent) || 0)) / 100,
        Number(charge.platform_commission_percent),
        (Number(charge.value) * (Number(charge.platform_commission_percent) || 0)) / 100,
        charge.asaas_payment_id,
        paidAt
      ).run();

      console.log(`[Asaas Webhook] Payment ${payment.id} confirmed, commissions updated and recorded`);

      // Create wallet transactions for driver and receiver
      const driverCommissionAmount = Number(driverDelivery?.commission_amount) || 0;
      const receiverCommissionAmount = Number(receiverDelivery?.commission_amount) || 0;

      // Confirm driver pending transaction and update balance
      if (driverDelivery?.driver_user_id && driverCommissionAmount > 0) {
        const driverBalance = await c.env.DB.prepare(
          "SELECT balance FROM users WHERE id = ?"
        ).bind(driverDelivery.driver_user_id).first();

        const newDriverBalance = (Number(driverBalance?.balance) || 0) + driverCommissionAmount;

        await c.env.DB.prepare(
          "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newDriverBalance, driverDelivery.driver_user_id).run();

        // Update pending transaction to confirmed
        await c.env.DB.prepare(
          `UPDATE user_transactions 
           SET status = 'confirmed', balance_after = ?, asaas_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received' AND status = 'pending'`
        ).bind(newDriverBalance, charge.id, driverDelivery.driver_user_id, charge.droptag_id).run();

        console.log(`[Wallet] Driver ${driverDelivery.driver_user_id} commission CONFIRMED: R$ ${driverCommissionAmount.toFixed(2)}, new balance: R$ ${newDriverBalance.toFixed(2)}`);
      }

      // Confirm receiver pending transaction and update balance
      if (receiverDelivery?.receiver_user_id && receiverCommissionAmount > 0) {
        const receiverBalance = await c.env.DB.prepare(
          "SELECT balance FROM users WHERE id = ?"
        ).bind(receiverDelivery.receiver_user_id).first();

        const newReceiverBalance = (Number(receiverBalance?.balance) || 0) + receiverCommissionAmount;

        await c.env.DB.prepare(
          "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newReceiverBalance, receiverDelivery.receiver_user_id).run();

        // Update pending transaction to confirmed
        await c.env.DB.prepare(
          `UPDATE user_transactions 
           SET status = 'confirmed', balance_after = ?, asaas_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received' AND status = 'pending'`
        ).bind(newReceiverBalance, charge.id, receiverDelivery.receiver_user_id, charge.droptag_id).run();

        console.log(`[Wallet] Receiver ${receiverDelivery.receiver_user_id} commission CONFIRMED: R$ ${receiverCommissionAmount.toFixed(2)}, new balance: R$ ${newReceiverBalance.toFixed(2)}`);
      }

      // Send commission available emails to driver and receiver
      const driverUserData = await c.env.DB.prepare(
        `SELECT u.full_name, u.email, u.mocha_user_id 
         FROM users u 
         WHERE u.id = ?`
      ).bind(driverDelivery?.driver_user_id).first() as { full_name: string; email: string; mocha_user_id: string } | null;

      const receiverUserData = await c.env.DB.prepare(
        `SELECT u.full_name, u.email, u.mocha_user_id 
         FROM users u 
         WHERE u.id = ?`
      ).bind(receiverDelivery?.receiver_user_id).first() as { full_name: string; email: string; mocha_user_id: string } | null;

      // Commission amounts already calculated above for wallet transactions

      // Send email to driver (Dropper)
      if (driverUserData?.email && driverUserData?.full_name && c.env.EMAILS) {
        try {
          const email = packagePickedUpEmail(
            driverUserData.full_name,
            "Dropper",
            driverCommissionAmount
          );
          await c.env.EMAILS.send({
            to: driverUserData.email,
            subject: email.subject,
            html_body: email.html_body,
            text_body: email.text_body,
          });
          console.log(`[Commission Email] Sent to driver ${driverUserData.email}`);
        } catch (error) {
          console.error("[Commission Email] Error sending to driver:", error);
        }
      }

      // Send email to receiver (Toodroper)
      if (receiverUserData?.email && receiverUserData?.full_name && c.env.EMAILS) {
        try {
          const email = packagePickedUpEmail(
            receiverUserData.full_name,
            "Toodroper",
            receiverCommissionAmount
          );
          await c.env.EMAILS.send({
            to: receiverUserData.email,
            subject: email.subject,
            html_body: email.html_body,
            text_body: email.text_body,
          });
          console.log(`[Commission Email] Sent to receiver ${receiverUserData.email}`);
        } catch (error) {
          console.error("[Commission Email] Error sending to receiver:", error);
        }
      }
    }

    return c.json({ success: true, status: newStatus });

  } catch (error) {
    console.error("[Asaas Webhook] Error:", error);
    return c.json({ 
      error: "Internal error processing webhook",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Poll payment status from Asaas and update local database
payments.get("/poll/:droptagId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("droptagId");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify droptag belongs to user
  const droptag = await c.env.DB.prepare(
    "SELECT id FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag não encontrada" }, 404);
  }

  // Get latest charge for this droptag
  const charge = await c.env.DB.prepare(
    "SELECT * FROM asaas_charges WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(droptagId).first();

  if (!charge) {
    return c.json({ error: "Nenhuma cobrança encontrada" }, 404);
  }

  // If already paid, just return
  if (charge.status === "paid") {
    return c.json({ 
      status: "paid",
      asaas_status: "CONFIRMED",
      charge_id: charge.id,
      paid_at: charge.paid_at,
      message: "Pagamento já confirmado"
    });
  }

  try {
    const asaasConfig = getAsaasConfig(c);
    // Poll Asaas for current status
    const asaasResponse = await fetch(
      `${asaasConfig.baseUrl}/payments/${charge.asaas_payment_id}/status`,
      {
        method: "GET",
        headers: {
          "accept": "application/json",
          "access_token": asaasConfig.apiKey,
          "User-Agent": "Toodrop/1.0"
        }
      }
    );

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      return c.json({ 
        error: "Erro ao consultar status no Asaas",
        details: errorData
      }, 500);
    }

    const asaasData: any = await asaasResponse.json();
    const asaasStatus = asaasData.status;

    // Map Asaas status to our status
    let newStatus = charge.status;
    let paidAt = null;

    // Status that mean payment is confirmed
    if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(asaasStatus)) {
      newStatus = "paid";
      paidAt = new Date().toISOString();
    } 
    // Status that mean payment is overdue
    else if (asaasStatus === "OVERDUE") {
      newStatus = "overdue";
    }
    // Status that mean payment was refunded/cancelled
    else if (["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS"].includes(asaasStatus)) {
      newStatus = "refunded";
    }
    // Chargeback statuses
    else if (["CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"].includes(asaasStatus)) {
      newStatus = "chargeback";
    }
    // Still pending
    else if (["PENDING", "AWAITING_RISK_ANALYSIS"].includes(asaasStatus)) {
      newStatus = "pending";
    }

    // Update charge status if changed
    if (newStatus !== charge.status) {
      if (paidAt) {
        await c.env.DB.prepare(
          `UPDATE asaas_charges 
           SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        ).bind(newStatus, paidAt, charge.id).run();
      } else {
        await c.env.DB.prepare(
          `UPDATE asaas_charges 
           SET status = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        ).bind(newStatus, charge.id).run();
      }

      // If payment confirmed, update commission status and register platform commission
      if (newStatus === "paid") {
        // Update driver_deliveries sub_status to commission_paid
        await c.env.DB.prepare(
          `UPDATE driver_deliveries 
           SET sub_status = 'commission_paid', updated_at = CURRENT_TIMESTAMP 
           WHERE droptag_id = ?`
        ).bind(charge.droptag_id).run();

        // Update receiver_deliveries status to picked_up and sub_status to commission_paid
        await c.env.DB.prepare(
          `UPDATE receiver_deliveries 
           SET status = 'picked_up', sub_status = 'commission_paid', picked_up_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
           WHERE droptag_id = ?`
        ).bind(charge.droptag_id).run();

        // Update droptag status to completed
        await c.env.DB.prepare(
          `UPDATE droptags 
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        ).bind(charge.droptag_id).run();

        // Check if platform commission already exists
        const existingCommission = await c.env.DB.prepare(
          "SELECT id FROM platform_commissions WHERE asaas_charge_id = ?"
        ).bind(charge.id).first();

        if (!existingCommission) {
          // Get droptag info for consumer
          const droptag = await c.env.DB.prepare(
            "SELECT consumer_user_id FROM droptags WHERE id = ?"
          ).bind(charge.droptag_id).first();

          // Get driver and receiver delivery info with commission amounts
          const driverDeliveryFull = await c.env.DB.prepare(
            "SELECT driver_user_id, commission_amount FROM driver_deliveries WHERE droptag_id = ?"
          ).bind(charge.droptag_id).first();

          const receiverDeliveryFull = await c.env.DB.prepare(
            "SELECT receiver_user_id, commission_amount FROM receiver_deliveries WHERE droptag_id = ?"
          ).bind(charge.droptag_id).first();

          // Insert platform commission record
          await c.env.DB.prepare(
            `INSERT INTO platform_commissions (
              asaas_charge_id, droptag_id, consumer_user_id, driver_user_id, receiver_user_id,
              total_value, driver_commission_percent, driver_commission_amount,
              receiver_commission_percent, receiver_commission_amount,
              platform_commission_percent, platform_commission_amount,
              asaas_payment_id, paid_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).bind(
            charge.id,
            charge.droptag_id,
            droptag?.consumer_user_id || null,
            driverDeliveryFull?.driver_user_id || charge.driver_user_id,
            receiverDeliveryFull?.receiver_user_id || charge.receiver_user_id,
            Number(charge.value),
            Number(charge.driver_commission_percent),
            (Number(charge.value) * (Number(charge.driver_commission_percent) || 0)) / 100,
            Number(charge.receiver_commission_percent),
            (Number(charge.value) * (Number(charge.receiver_commission_percent) || 0)) / 100,
            Number(charge.platform_commission_percent),
            (Number(charge.value) * (Number(charge.platform_commission_percent) || 0)) / 100,
            charge.asaas_payment_id,
            paidAt
          ).run();

          // Create wallet transactions for driver and receiver
          const driverCommissionAmount = Number(driverDeliveryFull?.commission_amount) || 0;
          const receiverCommissionAmount = Number(receiverDeliveryFull?.commission_amount) || 0;

          // Update driver balance and confirm pending transaction
          if (driverDeliveryFull?.driver_user_id && driverCommissionAmount > 0) {
            const driverBalance = await c.env.DB.prepare(
              "SELECT balance FROM users WHERE id = ?"
            ).bind(driverDeliveryFull.driver_user_id).first();

            const newDriverBalance = (Number(driverBalance?.balance) || 0) + driverCommissionAmount;

            await c.env.DB.prepare(
              "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(newDriverBalance, driverDeliveryFull.driver_user_id).run();

            // Update existing pending transaction to confirmed (same as webhook)
            await c.env.DB.prepare(
              `UPDATE user_transactions 
               SET status = 'confirmed', balance_after = ?, asaas_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received' AND status = 'pending'`
            ).bind(newDriverBalance, charge.id, driverDeliveryFull.driver_user_id, charge.droptag_id).run();

            console.log(`[Poll Payment] Driver ${driverDeliveryFull.driver_user_id} commission CONFIRMED: R$ ${driverCommissionAmount.toFixed(2)}, new balance: R$ ${newDriverBalance.toFixed(2)}`);
          }

          // Update receiver balance and confirm pending transaction
          if (receiverDeliveryFull?.receiver_user_id && receiverCommissionAmount > 0) {
            const receiverBalance = await c.env.DB.prepare(
              "SELECT balance FROM users WHERE id = ?"
            ).bind(receiverDeliveryFull.receiver_user_id).first();

            const newReceiverBalance = (Number(receiverBalance?.balance) || 0) + receiverCommissionAmount;

            await c.env.DB.prepare(
              "UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(newReceiverBalance, receiverDeliveryFull.receiver_user_id).run();

            // Update existing pending transaction to confirmed (same as webhook)
            await c.env.DB.prepare(
              `UPDATE user_transactions 
               SET status = 'confirmed', balance_after = ?, asaas_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received' AND status = 'pending'`
            ).bind(newReceiverBalance, charge.id, receiverDeliveryFull.receiver_user_id, charge.droptag_id).run();

            console.log(`[Poll Payment] Receiver ${receiverDeliveryFull.receiver_user_id} commission CONFIRMED: R$ ${receiverCommissionAmount.toFixed(2)}, new balance: R$ ${newReceiverBalance.toFixed(2)}`);
          }

          console.log(`[Poll Payment] Wallet transactions created for droptag ${charge.droptag_id}`);
        }
      }
    }

    return c.json({
      status: newStatus,
      asaas_status: asaasStatus,
      charge_id: charge.id,
      paid_at: paidAt || charge.paid_at,
      message: newStatus === "paid" ? "Pagamento confirmado!" : "Aguardando pagamento"
    });

  } catch (error) {
    console.error("Payment poll error:", error);
    return c.json({ 
      error: "Erro interno ao consultar status",
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// Get charge status by droptag
payments.get("/charge/:droptagId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("droptagId");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify droptag belongs to user
  const droptag = await c.env.DB.prepare(
    "SELECT id FROM droptags WHERE id = ? AND consumer_user_id = ?"
  ).bind(droptagId, user.id).first();

  if (!droptag) {
    return c.json({ error: "DropTag não encontrada" }, 404);
  }

  // Get latest charge for this droptag
  const charge = await c.env.DB.prepare(
    "SELECT * FROM asaas_charges WHERE droptag_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(droptagId).first();

  if (!charge) {
    return c.json({ charge: null });
  }

  return c.json({ charge });
});

// Get saved cards for user
payments.get("/saved-cards", unifiedAuthMiddleware, async (c) => {
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

  const cards = await c.env.DB.prepare(
    "SELECT id, card_brand, card_last_digits, is_default, created_at FROM saved_cards WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();

  return c.json({ cards: cards.results || [] });
});

// Delete saved card
payments.delete("/saved-cards/:cardId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cardId = c.req.param("cardId");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify card belongs to user
  const card = await c.env.DB.prepare(
    "SELECT * FROM saved_cards WHERE id = ? AND user_id = ?"
  ).bind(cardId, user.id).first();

  if (!card) {
    return c.json({ error: "Cartão não encontrado" }, 404);
  }

  // Delete card
  await c.env.DB.prepare(
    "DELETE FROM saved_cards WHERE id = ?"
  ).bind(cardId).run();

  // If this was the default card, set another card as default
  if (card.is_default) {
    const remainingCard = await c.env.DB.prepare(
      "SELECT id FROM saved_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id).first();

    if (remainingCard) {
      await c.env.DB.prepare(
        "UPDATE saved_cards SET is_default = 1 WHERE id = ?"
      ).bind(remainingCard.id).run();
    }
  }

  return c.json({ message: "Cartão removido com sucesso" });
});

// Set default card
payments.put("/saved-cards/:cardId/set-default", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cardId = c.req.param("cardId");

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Verify card belongs to user
  const card = await c.env.DB.prepare(
    "SELECT * FROM saved_cards WHERE id = ? AND user_id = ?"
  ).bind(cardId, user.id).first();

  if (!card) {
    return c.json({ error: "Cartão não encontrado" }, 404);
  }

  // Unset all cards as default
  await c.env.DB.prepare(
    "UPDATE saved_cards SET is_default = 0 WHERE user_id = ?"
  ).bind(user.id).run();

  // Set this card as default
  await c.env.DB.prepare(
    "UPDATE saved_cards SET is_default = 1 WHERE id = ?"
  ).bind(cardId).run();

  return c.json({ message: "Cartão definido como padrão" });
});

export default payments;
