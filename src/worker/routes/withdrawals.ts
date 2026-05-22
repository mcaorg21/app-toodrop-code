import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";

const withdrawals = new Hono<{ Bindings: Env }>();

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

// Request withdrawal
withdrawals.post("/request", unifiedAuthMiddleware, async (c) => {
  try {
    const userQuery = getUserQuery(c);
    if (!userQuery) {
      return c.json({ error: "Não autorizado" }, 401);
    }

    const { amount } = await c.req.json();

    if (!amount || amount < 20) {
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

    const currentBalance = Number(balanceResult?.calculated_balance) || 0;
    if (currentBalance < amount) {
      return c.json({ error: "Saldo insuficiente" }, 400);
    }

    // Create withdrawal request
    await c.env.DB.prepare(
      `INSERT INTO withdrawal_requests (
        user_id, amount, pix_key, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(user.id, amount, pixKey, "pending").run();

    // Calculate new balance after withdrawal
    const newBalance = currentBalance - amount;

    // Create transaction record (pending until admin approves)
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, balance_after, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      user.id,
      "withdrawal_requested",
      -amount,
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

export default withdrawals;
