import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { referralInviteTemplate } from "../utils/email-templates";

type AppContext = { Bindings: Env };

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
    email: null
  };
}

const referrals = new Hono<AppContext>();

// Apply auth middleware to all routes
referrals.use("*", unifiedAuthMiddleware);

// Get user's referral code
referrals.get("/code", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;

  const user = await db
    .prepare(`SELECT id, mocha_user_id FROM users WHERE ${userQuery.field} = ?`)
    .bind(userQuery.value)
    .first<{ id: number; mocha_user_id: string }>();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const referralCode = encryptReferralCode(user.id, user.mocha_user_id);
  
  return c.json({
    code: referralCode,
    link: `https://app.toodrop.com/?ref=${referralCode}`,
  });
});

// Check if user has accepted referral terms
referrals.get("/check-terms", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;

  const user = await db
    .prepare(`SELECT referral_terms_accepted_at FROM users WHERE ${userQuery.field} = ?`)
    .bind(userQuery.value)
    .first<{ referral_terms_accepted_at: string | null }>();

  return c.json({
    accepted: !!user?.referral_terms_accepted_at,
  });
});

// Accept referral terms
referrals.post("/accept-terms", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  await db
    .prepare(`UPDATE users SET referral_terms_accepted_at = ?, updated_at = ? WHERE ${userQuery.field} = ?`)
    .bind(now, now, userQuery.value)
    .run();

  return c.json({ success: true });
});

// Send referral invite by email
referrals.post("/send-invite", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;
  const { email } = await c.req.json<{ email: string }>();

  if (!email || !email.includes("@")) {
    return c.json({ error: "Email inválido" }, 400);
  }

  // Generate referral link using new secure hash
  const user = await db
    .prepare(`SELECT id, full_name, email, mocha_user_id FROM users WHERE ${userQuery.field} = ?`)
    .bind(userQuery.value)
    .first<{ id: number; full_name: string; email: string; mocha_user_id: string }>();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Check if email is the user's own email
  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return c.json({ error: "Você não pode indicar a si mesmo" }, 400);
  }

  // Check if this email was already invited by this user
  const existingInvite = await db
    .prepare("SELECT id FROM referrals WHERE referrer_user_id = ? AND referred_email = ?")
    .bind(user.id, email.toLowerCase())
    .first();

  if (existingInvite) {
    return c.json({ error: "Você já enviou um convite para este email" }, 400);
  }

  // Check if this email is already registered
  const existingUser = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first();

  if (existingUser) {
    return c.json({ error: "Este email já está cadastrado na plataforma" }, 400);
  }

  // Create referral record
  const now = new Date().toISOString();
  await db
    .prepare(`
      INSERT INTO referrals (referrer_user_id, referred_email, status, created_at, updated_at)
      VALUES (?, ?, 'pending', ?, ?)
    `)
    .bind(user.id, email.toLowerCase(), now, now)
    .run();

  // Generate secure referral link
  const referralCode = encryptReferralCode(user.id, user.mocha_user_id);
  const referralLink = `https://app.toodrop.com/?ref=${referralCode}`;

  // Send invitation email
  try {
    const referrerFirstName = user.full_name?.split(" ")[0] || "Um usuário";
    
    if (c.env.EMAILS) {
      const htmlBody = referralInviteTemplate({
        referrerName: referrerFirstName,
        referralLink,
      });
      
      await c.env.EMAILS.send({
        to: email,
        subject: `${referrerFirstName} te convidou para a Toodrop!`,
        html_body: htmlBody,
        text_body: `${referrerFirstName} está te convidando para a Toodrop! Cadastre-se pelo link: ${referralLink}`,
      });
    }
  } catch (error) {
    console.error("Error sending referral email:", error);
    // Don't fail the request, the referral was still created
  }

  return c.json({ success: true });
});

// List user's referrals
referrals.get("/list", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;

  // Get current user
  const user = await db
    .prepare(`SELECT id FROM users WHERE ${userQuery.field} = ?`)
    .bind(userQuery.value)
    .first<{ id: number }>();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  const referralsList = await db
    .prepare(`
      SELECT 
        r.id,
        r.referred_email,
        r.status,
        r.created_at,
        r.approved_at,
        u.full_name as referred_name
      FROM referrals r
      LEFT JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = ?
      ORDER BY r.created_at DESC
    `)
    .bind(user.id)
    .all();

  return c.json({
    referrals: referralsList.results || [],
  });
});

// Generate a referral code encoding userId and mochaUserId
function encryptReferralCode(userId: number, mochaUserId: string): string {
  const verifier = ((userId * 31337) % 65536).toString(16).padStart(4, "0");
  const payload = `${userId}|${mochaUserId}|${verifier}`;
  return Buffer.from(payload, "utf-8").toString("base64url");
}

// Decrypt the referral code to get userId and mochaUserId
function decryptReferralCode(code: string): { userId: number; mochaUserId: string } | null {
  try {
    const payload = Buffer.from(code, "base64url").toString("utf-8");
    const parts = payload.split("|");
    if (parts.length < 3) return null;
    const verifier = parts[parts.length - 1];
    const userId = parseInt(parts[0], 10);
    const mochaUserId = parts.slice(1, -1).join("|");
    if (isNaN(userId) || !mochaUserId) return null;
    const expectedVerifier = ((userId * 31337) % 65536).toString(16).padStart(4, "0");
    if (verifier !== expectedVerifier) return null;
    return { userId, mochaUserId };
  } catch {
    return null;
  }
}

// Link a newly registered user to their referrer (called after registration)
referrals.post("/link-referred", async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const db = c.env.DB;
  const { referralCode } = await c.req.json<{ referralCode: string }>();

  if (!referralCode) {
    return c.json({ error: "Código de indicação não fornecido" }, 400);
  }

  // Decrypt the referral code to get referrer info
  const referrerInfo = decryptReferralCode(referralCode);
  if (!referrerInfo) {
    return c.json({ error: "Código de indicação inválido" }, 400);
  }

  // Get current user
  const newUser = await db
    .prepare(`SELECT id, email FROM users WHERE ${userQuery.field} = ?`)
    .bind(userQuery.value)
    .first<{ id: number; email: string }>();

  if (!newUser) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Verify referrer exists
  const referrer = await db
    .prepare("SELECT id, mocha_user_id FROM users WHERE id = ?")
    .bind(referrerInfo.userId)
    .first<{ id: number; mocha_user_id: string }>();

  if (!referrer) {
    return c.json({ error: "Usuário indicador não encontrado" }, 400);
  }

  // Verify the mocha_user_id matches for extra security
  if (referrer.mocha_user_id !== referrerInfo.mochaUserId) {
    return c.json({ error: "Código de indicação inválido" }, 400);
  }

  // Check if user is trying to refer themselves
  if (referrer.id === newUser.id) {
    return c.json({ error: "Você não pode se auto-indicar" }, 400);
  }

  // Check if this user was already referred
  const existingReferral = await db
    .prepare("SELECT id FROM referrals WHERE referred_user_id = ?")
    .bind(newUser.id)
    .first();

  if (existingReferral) {
    return c.json({ error: "Você já foi indicado anteriormente" }, 400);
  }

  const now = new Date().toISOString();

  // Check if there's a pending referral with this email
  const pendingReferral = await db
    .prepare("SELECT id FROM referrals WHERE referrer_user_id = ? AND LOWER(referred_email) = LOWER(?) AND referred_user_id IS NULL")
    .bind(referrer.id, newUser.email || "")
    .first<{ id: number }>();

  if (pendingReferral) {
    // Update existing pending referral
    await db
      .prepare(`
        UPDATE referrals 
        SET referred_user_id = ?, status = 'registered', updated_at = ?
        WHERE id = ?
      `)
      .bind(newUser.id, now, pendingReferral.id)
      .run();
  } else {
    // Create new referral record
    await db
      .prepare(`
        INSERT INTO referrals (referrer_user_id, referred_user_id, referred_email, status, created_at, updated_at)
        VALUES (?, ?, ?, 'registered', ?, ?)
      `)
      .bind(referrer.id, newUser.id, newUser.email || "", now, now)
      .run();
  }

  return c.json({ success: true, message: "Indicação registrada com sucesso!" });
});

export { encryptReferralCode, decryptReferralCode };
export default referrals;
