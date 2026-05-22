import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { authMiddleware as mochaAuthMiddleware, MOCHA_SESSION_TOKEN_COOKIE_NAME } from "@getmocha/users-service/backend";

// Unified auth middleware that handles both Mocha (Google) and email auth
export const unifiedAuthMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  // Check if it's an email auth session
  if (sessionToken && sessionToken.startsWith("email_")) {
    // Parse email session token: email_{credentialId}_{randomString}
    const parts = sessionToken.split("_");
    if (parts.length >= 3) {
      const credentialId = parseInt(parts[1], 10);
      
      if (!isNaN(credentialId)) {
        // Verify credential exists and is verified
        const credential = await c.env.DB.prepare(
          "SELECT id, email, is_verified FROM email_credentials WHERE id = ?"
        ).bind(credentialId).first();

        if (credential && credential.is_verified === 1) {
          // Get or create user record
          let user = await c.env.DB.prepare(
            "SELECT * FROM users WHERE email_credential_id = ?"
          ).bind(credentialId).first();

          if (!user) {
            // Create user record for email auth user
            // Use a unique placeholder for mocha_user_id since it has NOT NULL constraint
            const placeholderMochaId = `email_auth_${credentialId}_${Date.now()}`;
            await c.env.DB.prepare(
              `INSERT INTO users (mocha_user_id, email_credential_id, email, profile_status) VALUES (?, ?, ?, ?)`
            ).bind(placeholderMochaId, credentialId, credential.email, "incomplete").run();

            user = await c.env.DB.prepare(
              "SELECT * FROM users WHERE email_credential_id = ?"
            ).bind(credentialId).first();
          }

          if (user) {
            const userData = user as any;
            
            // Check if user is deactivated
            if (userData.is_active === 0) {
              return c.json({ error: "Usuário desativado. Entre em contato com o suporte." }, 403);
            }

            // Set user in context with a format similar to Mocha user
            (c as any).set("user", {
              id: `email_${credentialId}`,
              email: credential.email,
              isEmailAuth: true,
              emailCredentialId: credentialId,
            });
            (c as any).set("appUser", userData);
            
            await next();
            return;
          }
        }
      }
    }
    
    // Invalid email session
    return c.json({ error: "Sessão inválida" }, 401);
  }

  // Fall back to Mocha auth for Google users
  try {
    await mochaAuthMiddleware(c, async () => {
      const mochaUser = c.get("user");
      if (mochaUser) {
        // Get app user for Google auth
        const appUser = await c.env.DB.prepare(
          "SELECT * FROM users WHERE mocha_user_id = ?"
        ).bind((mochaUser as any).id).first();
        
        if (appUser) {
          (c as any).set("appUser", appUser);
        }
      }
      await next();
    });
  } catch (error) {
    return c.json({ error: "Não autorizado" }, 401);
  }
};

// Export the Mocha middleware for routes that only need Google auth
export { mochaAuthMiddleware as authMiddleware };
