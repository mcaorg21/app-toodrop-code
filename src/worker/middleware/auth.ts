import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE = "toodrop_session";

interface SessionPayload {
  userId: number;
  email: string;
  type: "google" | "email";
  emailCredentialId?: number;
  googleId?: string;
}

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "60d" });
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  try {
    return jwt.verify(token, secret) as SessionPayload;
  } catch {
    return null;
  }
}

export const unifiedAuthMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    return c.json({ error: "Não autorizado" }, 401);
  }

  const payload = verifySession(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "Sessão inválida ou expirada" }, 401);
  }

  // Load full user from DB
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(payload.userId).first();

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 401);
  }

  const userData = user as Record<string, unknown>;
  if (userData.is_active === 0) {
    return c.json({ error: "Usuário desativado. Entre em contato com o suporte." }, 403);
  }

  // Set context values matching existing route expectations
  (c as any).set("user", {
    id: payload.type === "email" ? `email_${payload.emailCredentialId}` : payload.googleId,
    email: payload.email,
    isEmailAuth: payload.type === "email",
    emailCredentialId: payload.emailCredentialId,
  });
  (c as any).set("appUser", userData);

  await next();
};

// Alias kept for routes that import authMiddleware directly
export const authMiddleware = unifiedAuthMiddleware;
