import { Resend } from "resend";

interface EmailParams {
  to: string;
  subject: string;
  html_body?: string;
  text_body?: string;
}

interface EmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

export function createEmailService() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Toodrop <noreply@toodrop.com.br>";
  let resend: Resend | null = null;

  function getClient(): Resend {
    if (!resend) {
      if (!apiKey) {
        throw new Error("RESEND_API_KEY not configured");
      }
      resend = new Resend(apiKey);
    }
    return resend;
  }

  return {
    async send(params: EmailParams): Promise<EmailResult> {
      try {
        const { data, error } = await getClient().emails.send({
          from,
          to: params.to,
          subject: params.subject,
          html: params.html_body,
          text: params.text_body,
        });

        if (error) {
          console.error("[Email] Resend error:", error);
          return { success: false, error: error.message };
        }

        return { success: true, message_id: data?.id };
      } catch (err) {
        console.error("[Email] Send error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
