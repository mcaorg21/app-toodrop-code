import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { MOCHA_SESSION_TOKEN_COOKIE_NAME } from "@getmocha/users-service/backend";
import { emailTemplate, emailHeader, emailBody, emailFooter } from "../utils/email-templates";

const emailAuth = new Hono<{ Bindings: Env }>();

// Helper: Generate random 6-digit code
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper: Generate random salt
const generateSalt = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Helper: Hash password with PBKDF2
const hashPassword = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(salt);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(derivedBits), byte => 
    byte.toString(16).padStart(2, '0')
  ).join('');
};

// Helper: Generate session token for email auth users
const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Verification code email template
const verificationCodeEmail = (code: string) => {
  const subject = "Código de Verificação - Toodrop";
  
  const html_body = emailTemplate(`
    ${emailHeader("Código de Verificação")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Use o código abaixo para verificar seu email:
      </p>
      <div style="margin: 24px 0; padding: 20px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b;">${code}</span>
      </div>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Este código expira em 10 minutos. Se você não solicitou este código, ignore este email.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Seu código de verificação Toodrop é: ${code}\n\nEste código expira em 10 minutos. Se você não solicitou este código, ignore este email.`;

  return { subject, html_body, text_body };
};

// Check if email exists (for Google account detection)
emailAuth.post("/email-auth/check-email", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: "Email é obrigatório" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check email_credentials FIRST - this takes priority
    const existingEmailUser = await c.env.DB.prepare(
      "SELECT id, is_verified FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (existingEmailUser) {
      return c.json({ 
        exists: true, 
        isGoogleAccount: false,
        isVerified: existingEmailUser.is_verified === 1,
        message: existingEmailUser.is_verified === 1 
          ? "Esta conta já existe. Por favor, faça login."
          : "Esta conta existe mas não foi verificada. Solicite um novo código."
      });
    }

    // Only check users table for Google accounts if NOT found in email_credentials
    // Also exclude placeholder mocha_user_ids created for email auth users
    const existingGoogleUser = await c.env.DB.prepare(
      "SELECT id, email, mocha_user_id FROM users WHERE LOWER(email) = ? AND mocha_user_id NOT LIKE 'email_auth_%'"
    ).bind(normalizedEmail).first();

    if (existingGoogleUser) {
      return c.json({ 
        exists: true, 
        isGoogleAccount: true,
        message: "Este email já está vinculado a uma conta Google. Por favor, use o botão Entrar com Google."
      });
    }

    return c.json({ exists: false });
  } catch (error) {
    console.error("[EmailAuth] Check email error:", error);
    return c.json({ error: "Erro ao verificar email" }, 500);
  }
});

// Register with email - Step 1: Send verification code
emailAuth.post("/email-auth/register", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists in email_credentials FIRST
    const existingUser = await c.env.DB.prepare(
      "SELECT id, is_verified FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (existingUser && existingUser.is_verified === 1) {
      return c.json({ error: "Este email já está cadastrado. Faça login." }, 400);
    }

    // Check if email exists in users table (Google login) - exclude email_auth placeholders
    const existingGoogleUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE LOWER(email) = ? AND mocha_user_id NOT LIKE 'email_auth_%'"
    ).bind(normalizedEmail).first();

    if (existingGoogleUser) {
      return c.json({ 
        error: "Este email já está vinculado a uma conta Google. Por favor, use o botão Entrar com Google.",
        isGoogleAccount: true
      }, 400);
    }

    // Generate salt and hash password
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Insert or update credentials
    if (existingUser) {
      // Update password for unverified account
      await c.env.DB.prepare(
        `UPDATE email_credentials SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(passwordHash, salt, existingUser.id).run();
    } else {
      // Create new credentials
      await c.env.DB.prepare(
        `INSERT INTO email_credentials (email, password_hash, salt) VALUES (?, ?, ?)`
      ).bind(normalizedEmail, passwordHash, salt).run();
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Save verification code (invalidate previous codes)
    await c.env.DB.prepare(
      `UPDATE email_verification_codes SET is_used = 1 WHERE LOWER(email) = ? AND is_used = 0`
    ).bind(normalizedEmail).run();

    await c.env.DB.prepare(
      `INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)`
    ).bind(normalizedEmail, code, expiresAt).run();

    // Send verification email
    const emailContent = verificationCodeEmail(code);
    const emailResult = await c.env.EMAILS!.send({
      to: normalizedEmail,
      subject: emailContent.subject,
      html_body: emailContent.html_body,
      text_body: emailContent.text_body,
    });

    if (!emailResult.success) {
      console.error("[EmailAuth] Failed to send verification email:", emailResult.error);
      return c.json({ error: "Erro ao enviar email de verificação. Tente novamente." }, 500);
    }

    return c.json({ success: true, message: "Código de verificação enviado para seu email." });
  } catch (error) {
    console.error("[EmailAuth] Register error:", error);
    return c.json({ error: "Erro ao registrar. Tente novamente." }, 500);
  }
});

// Verify email code
emailAuth.post("/email-auth/verify", async (c) => {
  try {
    const { email, code } = await c.req.json();
    
    if (!email || !code) {
      return c.json({ error: "Email e código são obrigatórios" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid verification code
    const verification = await c.env.DB.prepare(
      `SELECT id, code, expires_at FROM email_verification_codes 
       WHERE LOWER(email) = ? AND is_used = 0 
       ORDER BY created_at DESC LIMIT 1`
    ).bind(normalizedEmail).first();

    if (!verification) {
      return c.json({ error: "Código não encontrado ou já utilizado. Solicite um novo código." }, 400);
    }

    // Check if code expired
    if (new Date(verification.expires_at as string) < new Date()) {
      return c.json({ error: "Código expirado. Solicite um novo código." }, 400);
    }

    // Check if code matches
    if (verification.code !== code) {
      return c.json({ error: "Código inválido. Verifique e tente novamente." }, 400);
    }

    // Mark code as used
    await c.env.DB.prepare(
      `UPDATE email_verification_codes SET is_used = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(verification.id).run();

    // Mark email as verified
    await c.env.DB.prepare(
      `UPDATE email_credentials SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = ?`
    ).bind(normalizedEmail).run();

    // Get credentials to create session
    const credentials = await c.env.DB.prepare(
      "SELECT id FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (!credentials) {
      return c.json({ error: "Erro ao verificar conta" }, 500);
    }

    // Generate session token
    const sessionToken = `email_${credentials.id}_${generateSessionToken()}`;

    // Set session cookie
    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ 
      success: true, 
      message: "Email verificado com sucesso!",
      emailCredentialId: credentials.id
    });
  } catch (error) {
    console.error("[EmailAuth] Verify error:", error);
    return c.json({ error: "Erro ao verificar código" }, 500);
  }
});

// Login with email and password
emailAuth.post("/email-auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email e senha são obrigatórios" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user in email_credentials FIRST
    const credentials = await c.env.DB.prepare(
      "SELECT id, password_hash, salt, is_verified, failed_attempts, locked_until FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (!credentials) {
      return c.json({ error: "Email ou senha incorretos" }, 401);
    }

    // Check if account is locked
    if (credentials.locked_until) {
      const lockExpiry = new Date(credentials.locked_until as string);
      if (lockExpiry > new Date()) {
        return c.json({ 
          error: "Conta bloqueada por tentativas excessivas. Use 'Esqueci minha senha' para recuperar.",
          isLocked: true,
          needsPasswordReset: true
        }, 401);
      } else {
        // Lock expired, reset failed attempts
        await c.env.DB.prepare(
          "UPDATE email_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(credentials.id).run();
      }
    }

    if (credentials.is_verified !== 1) {
      return c.json({ 
        error: "Email não verificado. Cadastre-se novamente para receber um novo código.",
        needsVerification: true
      }, 401);
    }

    // Verify password
    const passwordHash = await hashPassword(password, credentials.salt as string);
    
    if (passwordHash !== credentials.password_hash) {
      // Increment failed attempts
      const newFailedAttempts = ((credentials.failed_attempts as number) || 0) + 1;
      
      if (newFailedAttempts >= 3) {
        // Lock account - require password reset
        await c.env.DB.prepare(
          "UPDATE email_credentials SET failed_attempts = ?, locked_until = datetime('now', '+24 hours'), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newFailedAttempts, credentials.id).run();
        
        return c.json({ 
          error: "Conta bloqueada após 3 tentativas incorretas. Use 'Esqueci minha senha' para recuperar.",
          isLocked: true,
          needsPasswordReset: true
        }, 401);
      } else {
        await c.env.DB.prepare(
          "UPDATE email_credentials SET failed_attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newFailedAttempts, credentials.id).run();
        
        const attemptsRemaining = 3 - newFailedAttempts;
        return c.json({ 
          error: `Senha incorreta. ${attemptsRemaining} tentativa${attemptsRemaining > 1 ? 's' : ''} restante${attemptsRemaining > 1 ? 's' : ''}.`,
          attemptsRemaining
        }, 401);
      }
    }

    // Login successful - reset failed attempts
    await c.env.DB.prepare(
      "UPDATE email_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(credentials.id).run();

    // Generate session token
    const sessionToken = `email_${credentials.id}_${generateSessionToken()}`;

    // Set session cookie
    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ 
      success: true, 
      emailCredentialId: credentials.id 
    });
  } catch (error) {
    console.error("[EmailAuth] Login error:", error);
    return c.json({ error: "Erro ao fazer login" }, 500);
  }
});

// Resend verification code
emailAuth.post("/email-auth/resend-code", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: "Email é obrigatório" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if credentials exist
    const credentials = await c.env.DB.prepare(
      "SELECT id, is_verified FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (!credentials) {
      return c.json({ error: "Email não encontrado. Faça o cadastro primeiro." }, 400);
    }

    if (credentials.is_verified === 1) {
      return c.json({ error: "Email já verificado. Faça login." }, 400);
    }

    // Generate new verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate previous codes
    await c.env.DB.prepare(
      `UPDATE email_verification_codes SET is_used = 1 WHERE LOWER(email) = ? AND is_used = 0`
    ).bind(normalizedEmail).run();

    // Save new code
    await c.env.DB.prepare(
      `INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)`
    ).bind(normalizedEmail, code, expiresAt).run();

    // Send email
    const emailContent = verificationCodeEmail(code);
    const emailResult = await c.env.EMAILS!.send({
      to: normalizedEmail,
      subject: emailContent.subject,
      html_body: emailContent.html_body,
      text_body: emailContent.text_body,
    });

    if (!emailResult.success) {
      return c.json({ error: "Erro ao enviar email. Tente novamente." }, 500);
    }

    return c.json({ success: true, message: "Novo código enviado para seu email." });
  } catch (error) {
    console.error("[EmailAuth] Resend code error:", error);
    return c.json({ error: "Erro ao reenviar código" }, 500);
  }
});

// Password reset email template
const passwordResetEmail = (code: string) => {
  const subject = "Recuperação de Senha - Toodrop";
  
  const html_body = emailTemplate(`
    ${emailHeader("Recuperação de Senha")}
    ${emailBody(`
      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
        Você solicitou a recuperação de senha. Use o código abaixo para criar uma nova senha:
      </p>
      <div style="margin: 24px 0; padding: 20px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b;">${code}</span>
      </div>
      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
        Este código expira em 10 minutos. Se você não solicitou esta recuperação, ignore este email.
      </p>
    `)}
    ${emailFooter("© 2025 Toodrop. Todos os direitos reservados.")}
  `);

  const text_body = `Seu código de recuperação de senha Toodrop é: ${code}\n\nEste código expira em 10 minutos. Se você não solicitou esta recuperação, ignore este email.`;

  return { subject, html_body, text_body };
};

// Forgot password - send reset code
emailAuth.post("/email-auth/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: "Email é obrigatório" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if credentials exist
    const credentials = await c.env.DB.prepare(
      "SELECT id, is_verified FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (!credentials) {
      // Don't reveal if email exists - just say code sent
      return c.json({ success: true, message: "Se o email estiver cadastrado, você receberá um código de recuperação." });
    }

    if (credentials.is_verified !== 1) {
      return c.json({ error: "Email não verificado. Faça o cadastro novamente." }, 400);
    }

    // Generate reset code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate previous codes
    await c.env.DB.prepare(
      `UPDATE email_verification_codes SET is_used = 1 WHERE LOWER(email) = ? AND is_used = 0`
    ).bind(normalizedEmail).run();

    // Save new code
    await c.env.DB.prepare(
      `INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)`
    ).bind(normalizedEmail, code, expiresAt).run();

    // Send email
    const emailContent = passwordResetEmail(code);
    const emailResult = await c.env.EMAILS!.send({
      to: normalizedEmail,
      subject: emailContent.subject,
      html_body: emailContent.html_body,
      text_body: emailContent.text_body,
    });

    if (!emailResult.success) {
      console.error("[EmailAuth] Failed to send password reset email:", emailResult.error);
      return c.json({ error: "Erro ao enviar email. Tente novamente." }, 500);
    }

    return c.json({ success: true, message: "Código de recuperação enviado para seu email." });
  } catch (error) {
    console.error("[EmailAuth] Forgot password error:", error);
    return c.json({ error: "Erro ao processar solicitação" }, 500);
  }
});

// Reset password with code
emailAuth.post("/email-auth/reset-password", async (c) => {
  try {
    const { email, code, newPassword } = await c.req.json();
    
    if (!email || !code || !newPassword) {
      return c.json({ error: "Email, código e nova senha são obrigatórios" }, 400);
    }

    if (newPassword.length < 6) {
      return c.json({ error: "Senha deve ter no mínimo 6 caracteres" }, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find valid verification code
    const verification = await c.env.DB.prepare(
      `SELECT id, code, expires_at FROM email_verification_codes 
       WHERE LOWER(email) = ? AND is_used = 0 
       ORDER BY created_at DESC LIMIT 1`
    ).bind(normalizedEmail).first();

    if (!verification) {
      return c.json({ error: "Código não encontrado ou já utilizado. Solicite um novo código." }, 400);
    }

    // Check if code expired
    if (new Date(verification.expires_at as string) < new Date()) {
      return c.json({ error: "Código expirado. Solicite um novo código." }, 400);
    }

    // Check if code matches
    if (verification.code !== code) {
      return c.json({ error: "Código inválido. Verifique e tente novamente." }, 400);
    }

    // Mark code as used
    await c.env.DB.prepare(
      `UPDATE email_verification_codes SET is_used = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(verification.id).run();

    // Generate new salt and hash password
    const salt = generateSalt();
    const passwordHash = await hashPassword(newPassword, salt);

    // Update password and unlock account
    await c.env.DB.prepare(
      `UPDATE email_credentials SET password_hash = ?, salt = ?, failed_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = ?`
    ).bind(passwordHash, salt, normalizedEmail).run();

    // Get credentials to create session
    const credentials = await c.env.DB.prepare(
      "SELECT id FROM email_credentials WHERE LOWER(email) = ?"
    ).bind(normalizedEmail).first();

    if (!credentials) {
      return c.json({ error: "Erro ao recuperar conta" }, 500);
    }

    // Generate session token and log user in
    const sessionToken = `email_${credentials.id}_${generateSessionToken()}`;

    // Set session cookie
    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ 
      success: true, 
      message: "Senha alterada com sucesso!",
      emailCredentialId: credentials.id
    });
  } catch (error) {
    console.error("[EmailAuth] Reset password error:", error);
    return c.json({ error: "Erro ao redefinir senha" }, 500);
  }
});

export default emailAuth;
