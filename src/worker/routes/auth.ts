import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { OAuth2Client } from "google-auth-library";
import { unifiedAuthMiddleware, signSession, SESSION_COOKIE } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env }>();

function getOAuthClient(env: Env) {
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

// Get Google OAuth redirect URL
auth.get("/oauth/google/redirect_url", async (c) => {
  const client = getOAuthClient(c.env);
  const redirectUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "consent",
  });
  return c.json({ redirectUrl }, 200);
});

// Exchange Google OAuth code for session
auth.post("/sessions", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.code) {
      return c.json({ error: "No authorization code provided" }, 400);
    }

    const client = getOAuthClient(c.env);
    const { tokens } = await client.getToken(body.code);
    client.setCredentials(tokens);

    // Get user info from Google
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: c.env.GOOGLE_CLIENT_ID,
    });
    const googlePayload = ticket.getPayload();
    if (!googlePayload || !googlePayload.email) {
      return c.json({ error: "Failed to get user info from Google" }, 500);
    }

    const { sub: googleId, email, name } = googlePayload;

    // Get or create user
    let user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE mocha_user_id = ?"
    ).bind(googleId).first() as Record<string, unknown> | null;

    if (!user) {
      // Check if user exists by email (might have been created via email auth)
      user = await c.env.DB.prepare(
        "SELECT * FROM users WHERE email = ? AND mocha_user_id NOT LIKE 'email_auth_%'"
      ).bind(email).first() as Record<string, unknown> | null;
    }

    if (!user) {
      await c.env.DB.prepare(
        `INSERT INTO users (mocha_user_id, email, full_name, profile_status) VALUES (?, ?, ?, ?)`
      ).bind(googleId, email, name || null, "incomplete").run();

      user = await c.env.DB.prepare(
        "SELECT * FROM users WHERE mocha_user_id = ?"
      ).bind(googleId).first() as Record<string, unknown> | null;
    }

    if (!user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    if (user.is_active === 0) {
      return c.json({ error: "Usuário desativado." }, 403);
    }

    const sessionToken = signSession(
      { userId: user.id as number, email: email!, type: "google", googleId },
      c.env.JWT_SECRET
    );

    setCookie(c, SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60,
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("[Sessions] Error:", error);
    return c.json({
      error: "Erro ao criar sessão",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// Get current user
auth.get("/users/me", unifiedAuthMiddleware, async (c) => {
  const user = (c as any).get("user") as any;
  if (!user) return c.json(null);
  return c.json(user);
});

// Logout
auth.get("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ success: true }, 200);
});

export default auth;
