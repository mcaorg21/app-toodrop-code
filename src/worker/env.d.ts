import type { DB } from "../server/db";
import type { StorageService } from "../server/storage";

interface EmailParams {
  to: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  reply_to?: string;
}

interface EmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

interface EmailService {
  send(params: EmailParams): Promise<EmailResult>;
}

interface Env {
  DB: DB;
  R2_BUCKET: StorageService;
  EMAILS: EmailService;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_SECRET: string;
  GOOGLE_CLOUD_VISION_API_KEY: string;
  ASAAS_API_KEY_PRODUCAO: string;
  ADMIN_KEY: string;
}
