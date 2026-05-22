import { Hono } from "hono";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { unifiedAuthMiddleware } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env }>();

// Get OAuth redirect URL
auth.get("/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

// Create session from OAuth code
auth.post("/sessions", async (c) => {
  try {
    console.log("[Sessions] POST /api/sessions called");
    console.log("[Sessions] Request URL:", c.req.url);
    
    const body = await c.req.json();
    console.log("[Sessions] Request body received, has code:", !!body.code);

    if (!body.code) {
      console.log("[Sessions] ERROR: No authorization code provided");
      return c.json({ error: "No authorization code provided" }, 400);
    }

    console.log("[Sessions] Calling exchangeCodeForSessionToken...");
    const sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
    console.log("[Sessions] Session token obtained:", !!sessionToken);
    console.log("[Sessions] Session token type:", typeof sessionToken);
    
    if (!sessionToken) {
      console.error("[Sessions] ERROR: exchangeCodeForSessionToken returned falsy value");
      return c.json({ error: "Failed to obtain session token" }, 500);
    }

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60,
    });

    console.log("[Sessions] Session created successfully");
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("[Sessions] Error creating session:", error);
    console.error("[Sessions] Error details:", JSON.stringify(error, null, 2));
    return c.json({ 
      error: "Erro ao criar sessão", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Get current user
auth.get("/users/me", unifiedAuthMiddleware, async (c) => {
  const user = c.get("user") as any;
  
  if (!user) {
    return c.json(null);
  }
  
  // For email auth users, return a user object similar to Mocha user format
  if (user.isEmailAuth) {
    return c.json({
      id: user.id,
      email: user.email,
      isEmailAuth: true,
    });
  }
  
  // For Google auth users, return the Mocha user
  return c.json(user);
});

// Logout
auth.get("/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  // Only call Mocha deleteSession for Google auth sessions
  if (typeof sessionToken === "string" && !sessionToken.startsWith("email_")) {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  // Clear cookie for both auth types
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

export default auth;
