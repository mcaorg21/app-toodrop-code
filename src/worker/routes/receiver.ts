import { Hono } from "hono";
import { unifiedAuthMiddleware } from "../middleware/auth";
import { UpdateScheduleInputSchema } from "@/shared/types";
import { packageDeliveredToToodropperEmail } from "@/worker/utils/email-templates";

const receiver = new Hono<{ Bindings: Env }>();

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
    email: user.email || null
  };
}

// N8N Webhook URL for OCR validation
const N8N_OCR_WEBHOOK_URL = "https://primary-production-1a8e5.up.railway.app/webhook/093cd588-067c-462f-a058-796549fa0d12";

// N8N Webhook URL for address proof validation
const ADDRESS_PROOF_WEBHOOK_URL = "https://primary-production-1a8e5.up.railway.app/webhook/f32c6bd2-cea0-42f3-9575-e26e558be7a94";

// Production URL for callback URLs (always use prod so n8n can reach it)
const PRODUCTION_BASE_URL = "https://tdv4.mocha.app";

// Helper function to perform OCR using Google Cloud Vision
async function performOCR(
  imageBase64: string,
  apiKey: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    );

    if (!visionResponse.ok) {
      console.error('[OCR] Google Vision API failed:', visionResponse.status);
      return { success: false, error: 'Erro ao processar imagem' };
    }

    const visionData = await visionResponse.json() as {
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        textAnnotations?: Array<{ description?: string }>;
        error?: { message?: string };
      }>;
    };

    if (visionData.responses?.[0]?.error) {
      return { success: false, error: visionData.responses[0].error.message };
    }

    const text = visionData.responses?.[0]?.fullTextAnnotation?.text || 
                 visionData.responses?.[0]?.textAnnotations?.[0]?.description || '';

    return { success: true, text };
  } catch (error) {
    console.error('[OCR] Error:', error);
    return { success: false, error: 'Erro ao processar documento' };
  }
}

// Helper function to convert PDF to PNG
async function convertPdfToPng(pdfBase64: string): Promise<{ success: boolean; png?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch('https://pdf-to-png-service.up.railway.app/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfBase64 }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: 'Erro ao converter PDF' };
    }

    const result = await response.json() as { success?: boolean; png?: string; error?: string };
    
    if (!result.success || !result.png) {
      return { success: false, error: result.error || 'Erro ao converter PDF' };
    }

    return { success: true, png: result.png };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Timeout ao converter PDF. Tente enviar uma foto.' };
    }
    return { success: false, error: 'Erro ao converter PDF' };
  }
}

// Helper function to resize and compress image (for selfies)
async function resizeImage(imageBase64: string): Promise<{ success: boolean; resized?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch('https://pdf-to-png-service.up.railway.app/resize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: imageBase64,
        maxWidth: 600,
        maxHeight: 600,
        quality: 40,
        maxSizeKb: 300
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Image Resize] Service returned error:', response.status);
      // If resize service fails, return original image
      return { success: true, resized: imageBase64 };
    }

    const result = await response.json() as { success?: boolean; resized?: string; error?: string };
    
    if (!result.success || !result.resized) {
      // If resize fails, return original image
      return { success: true, resized: imageBase64 };
    }

    return { success: true, resized: result.resized };
  } catch (error) {
    console.warn('[Image Resize] Error, using original image:', error);
    // If any error occurs, return original image
    return { success: true, resized: imageBase64 };
  }
}

// Helper function to resize and compress documents (higher quality for legibility)
async function resizeDocumentImage(imageBase64: string): Promise<{ success: boolean; resized?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch('https://pdf-to-png-service.up.railway.app/resize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: imageBase64,
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 75,
        maxSizeKb: 800
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[Document Resize] Service returned error:', response.status);
      // If resize service fails, return original image
      return { success: true, resized: imageBase64 };
    }

    const result = await response.json() as { success?: boolean; resized?: string; error?: string };
    
    if (!result.success || !result.resized) {
      // If resize fails, return original image
      return { success: true, resized: imageBase64 };
    }

    return { success: true, resized: result.resized };
  } catch (error) {
    console.warn('[Document Resize] Error, using original image:', error);
    // If any error occurs, return original image
    return { success: true, resized: imageBase64 };
  }
}

// Helper function to get the correct base URL for callbacks
function getCallbackBaseUrl(requestUrl: string, hostHeader?: string | null, forwardedHost?: string | null): string {
  // Log for debugging
  console.log('[getCallbackBaseUrl] hostHeader:', hostHeader, 'forwardedHost:', forwardedHost, 'requestUrl:', requestUrl);
  
  // First, check X-Forwarded-Host (used by proxies)
  if (forwardedHost) {
    if (forwardedHost.includes('mocha.app') || forwardedHost.includes('mocha.run')) {
      return `https://${forwardedHost}`;
    }
  }
  
  // Then check the Host header
  // Accept mocha.app (production) or mocha.run (dev preview)
  if (hostHeader) {
    if (hostHeader.includes('mocha.app') || hostHeader.includes('mocha.run')) {
      return `https://${hostHeader}`;
    }
  }
  
  try {
    const url = new URL(requestUrl);
    // If it's a mocha.app or mocha.run URL, use it
    if (url.hostname.includes('mocha.app') || url.hostname.includes('mocha.run')) {
      return url.origin;
    }
  } catch (e) {
    console.log('[getCallbackBaseUrl] Error parsing URL:', e);
  }
  // Fallback to production URL for localhost, IPv6, or any other case
  return PRODUCTION_BASE_URL;
}

// Helper function to send OCR result to n8n
async function sendOCRToN8N(
  campo: string,
  ocrText: string,
  userId: number,
  docType: string,
  requestUrl: string,
  hostHeader?: string | null,
  forwardedHost?: string | null,
  webhookUrl?: string,
  imageBase64?: string
) {
  const apiKey = "toodrop_n8n_webhook_key_2024";
  
  // Use the correct URL based on environment
  const baseUrl = getCallbackBaseUrl(requestUrl, hostHeader, forwardedHost);
  console.log(`[n8n OCR] Using base URL: ${baseUrl} (from request: ${requestUrl})`);
  
  const approveUrl = `${baseUrl}/api/receiver/documents/webhook/validate?user_id=${userId}&doc_type=${docType}&status=approved&api_key=${apiKey}`;
  const rejectUrl = `${baseUrl}/api/receiver/documents/webhook/validate?user_id=${userId}&doc_type=${docType}&status=rejected&api_key=${apiKey}`;
  
  const payload: Record<string, unknown> = {
    campo,
    ocr_text: ocrText,
    timestamp: new Date().toISOString(),
    user_id: userId,
    doc_type: docType,
    approve_url: approveUrl,
    reject_url: rejectUrl,
    api_key: apiKey,
  };
  
  // Add image if provided
  if (imageBase64) {
    payload.image = imageBase64;
  }
  
  const targetUrl = webhookUrl || N8N_OCR_WEBHOOK_URL;
  console.log(`[n8n OCR] Sending ${campo} to n8n...`);
  console.log(`[n8n OCR] Payload:`, JSON.stringify(payload, null, 2));
  console.log(`[n8n OCR] URL:`, targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`[n8n OCR] Response status:`, response.status);
    console.log(`[n8n OCR] Response body:`, responseText);
    
    return response.ok;
  } catch (error) {
    console.error(`[n8n OCR] Error sending ${campo}:`, error);
    return false;
  }
}

// OCR endpoint for ID document
receiver.post("/documents/ocr-id", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log('[ID Document OCR] === NEW REQUEST ===');
  console.log('[ID Document OCR] Request received at:', new Date().toISOString());

  try {
    const body = await c.req.json();
    const { image, is_pdf } = body;

    console.log('[ID Document OCR] Request body parsed');
    console.log('[ID Document OCR] is_pdf:', is_pdf);
    console.log('[ID Document OCR] image exists:', !!image);
    console.log('[ID Document OCR] image type:', typeof image);

    if (!image || typeof image !== "string") {
      console.log('[ID Document OCR] ERROR: Missing or invalid image');
      return c.json({ error: "Imagem ou PDF é obrigatório" }, 400);
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    console.log(`[ID Document OCR] Processing ${is_pdf ? 'PDF' : 'image'} document...`);
    console.log('[ID Document OCR] base64Data length:', base64Data.length);

    let ocrText = '';
    let imageBase64Data = base64Data;

    if (is_pdf) {
      console.log('[ID Document OCR] === STARTING PDF CONVERSION ===');
      console.log('[ID Document OCR] PDF format detected - converting to PNG');
      console.log('[ID Document OCR] PDF base64 length:', base64Data.length);
      
      try {
        console.log('[ID Document OCR] Calling PDF conversion service...');
        console.log('[ID Document OCR] Service URL: https://pdf-to-png-service.up.railway.app/convert');
        
        // Create AbortController with longer timeout for PDF conversion (3 minutes)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('[ID Document OCR] PDF conversion timeout - aborting request');
          controller.abort();
        }, 180000); // 3 minutes
        
        const convertResponse = await fetch('https://pdf-to-png-service.up.railway.app/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pdf: base64Data,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        console.log('[ID Document OCR] Conversion service response status:', convertResponse.status);
        console.log('[ID Document OCR] Conversion service response ok:', convertResponse.ok);

        if (!convertResponse.ok) {
          const errorText = await convertResponse.text();
          console.error('[ID Document OCR] PDF conversion failed with status:', convertResponse.status);
          console.error('[ID Document OCR] Error response:', errorText);
          return c.json({ 
            success: false,
            error: 'Erro ao converter PDF',
            message: 'Não foi possível converter o documento PDF. Tente novamente ou envie uma foto do documento.',
          }, 500);
        }

        const convertResult = await convertResponse.json() as {
          success?: boolean;
          png?: string;
          size?: number;
          format?: string;
          error?: string;
        };

        console.log('[ID Document OCR] Conversion result keys:', Object.keys(convertResult));
        console.log('[ID Document OCR] Conversion success:', convertResult.success);

        if (!convertResult.success || !convertResult.png) {
          console.error('[ID Document OCR] PDF conversion returned no PNG');
          console.error('[ID Document OCR] Conversion result:', JSON.stringify(convertResult).substring(0, 200));
          return c.json({ 
            success: false,
            error: 'Erro ao converter PDF',
            message: convertResult.error || 'Não foi possível converter o documento PDF. Tente enviar uma foto do documento.',
          }, 500);
        }

        console.log('[ID Document OCR] PDF converted to PNG successfully');
        console.log('[ID Document OCR] PNG base64 length:', convertResult.png.length);
        console.log('[ID Document OCR] PNG size:', convertResult.size);
        console.log('[ID Document OCR] === PDF CONVERSION COMPLETE ===');
        imageBase64Data = convertResult.png;
      } catch (pdfError) {
        console.error('[ID Document OCR] === PDF CONVERSION FAILED ===');
        console.error('[ID Document OCR] PDF conversion exception:', pdfError);
        console.error('[ID Document OCR] Error type:', pdfError instanceof Error ? pdfError.constructor.name : typeof pdfError);
        console.error('[ID Document OCR] Error message:', pdfError instanceof Error ? pdfError.message : String(pdfError));
        console.error('[ID Document OCR] Error name:', pdfError instanceof Error ? pdfError.name : 'unknown');
        console.error('[ID Document OCR] Error stack:', pdfError instanceof Error ? pdfError.stack : 'no stack');
        console.error('[ID Document OCR] About to return error response');
        
        let errorMessage = 'Não foi possível processar o documento PDF. Tente novamente.';
        
        if (pdfError instanceof Error) {
          if (pdfError.name === 'AbortError') {
            errorMessage = 'O processamento do PDF está demorando muito. Tente enviar uma foto do documento ao invés do PDF.';
            console.error('[ID Document OCR] PDF conversion timed out after 3 minutes');
          } else if (pdfError.message.includes('fetch')) {
            errorMessage = 'Não foi possível conectar ao serviço de conversão de PDF. Tente enviar uma foto do documento.';
            console.error('[ID Document OCR] Network error connecting to PDF conversion service');
          }
        }
        
        const errorResponse = { 
          success: false,
          error: 'Erro ao converter PDF',
          message: errorMessage,
        };
        console.error('[ID Document OCR] Error response:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 500);
      }
    }

    console.log('[ID Document OCR] === STARTING GOOGLE VISION OCR ===');
    console.log('[ID Document OCR] Using image data length:', imageBase64Data.length);

    // Process image with Google Vision OCR
    {
      console.log('[ID Document OCR] Calling Google Vision API...');
      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${c.env.GOOGLE_CLOUD_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [
              {
                image: {
                  content: imageBase64Data,
                },
                features: [
                  {
                    type: 'DOCUMENT_TEXT_DETECTION',
                  },
                ],
              },
            ],
          }),
        }
      );

      console.log('[ID Document OCR] Google Vision response status:', visionResponse.status);
      console.log('[ID Document OCR] Google Vision response ok:', visionResponse.ok);

      if (!visionResponse.ok) {
        console.error('[ID Document OCR] Google Vision API failed');
        const errorResponse = { 
          success: false,
          error: 'Erro ao processar imagem',
          message: 'Não foi possível processar a imagem do documento.'
        };
        console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 500);
      }

      const visionData = await visionResponse.json() as {
        responses?: Array<{
          fullTextAnnotation?: {
            text?: string;
          };
          textAnnotations?: Array<{
            description?: string;
          }>;
          error?: {
            message?: string;
          };
        }>;
      };

      if (visionData.responses?.[0]?.error) {
        return c.json({ 
          success: false,
          error: 'Erro ao processar documento',
          message: 'Não foi possível processar a imagem do documento.'
        }, 500);
      }
      
      ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || 
                visionData.responses?.[0]?.textAnnotations?.[0]?.description || '';
      
      console.log('[ID Document OCR] Text extracted, length:', ocrText.length);
      console.log('[ID Document OCR] Text preview:', ocrText.substring(0, 200));
      
      if (!ocrText || ocrText.trim().length === 0) {
        console.error('[ID Document OCR] No text extracted from image');
        const errorResponse = { 
          success: false,
          error: 'Nenhum texto encontrado',
          message: 'Não foi possível extrair texto da imagem. Certifique-se de que o documento está legível e bem iluminado.'
        };
        console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 500);
      }
      
      console.log('[ID Document OCR] === GOOGLE VISION OCR COMPLETE ===');
    }

    // Send to webhook for validation
    console.log('[ID Document OCR] === STARTING VALIDATION WEBHOOK ===');
    console.log('[ID Document OCR] Sending to validation webhook...');
    
    try {
      const webhookResponse = await fetch(
        'https://primary-production-1a8e5.up.railway.app/webhook/093cd588-067c-462f-a058-796549fa0d12',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campo: 'documento_identificacao',
            ocr_text: ocrText,
            timestamp: new Date().toISOString(),
          }),
        }
      );
      
      console.log('[ID Document OCR] Validation webhook response status:', webhookResponse.status);
      console.log('[ID Document OCR] Validation webhook response ok:', webhookResponse.ok);
      
      if (!webhookResponse.ok) {
        console.error('[ID Document OCR] Validation webhook failed');
        const errorResponse = { 
          error: 'Erro ao validar documento',
          message: 'Não foi possível processar o documento. Tente novamente.'
        };
        console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 500);
      }

      const rawResponse = await webhookResponse.text();
      console.log('[ID Document OCR] Raw webhook response (first 500 chars):', rawResponse.substring(0, 500));
      
      const validationResult = JSON.parse(rawResponse);
      console.log('[ID Document OCR] Validation result structure:', JSON.stringify(validationResult).substring(0, 200));

      let finalResult;
      if (Array.isArray(validationResult) && validationResult.length > 0) {
        const firstItem = validationResult[0];
        if (firstItem.response?.result?.raw) {
          finalResult = JSON.parse(firstItem.response.result.raw);
        }
      }

      console.log('[ID Document OCR] Parsed final result:', finalResult);

      if (!finalResult) {
        console.error('[ID Document OCR] Could not parse final result from webhook');
        const errorResponse = { 
          success: false,
          error: 'Erro ao processar validação',
          message: 'Não foi possível validar o documento. Tente novamente.'
        };
        console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 500);
      }

      console.log('[ID Document OCR] Document status:', finalResult.status);

      if (finalResult.status === false || finalResult.status === "false") {
        console.log('[ID Document OCR] Document validation failed - invalid document');
        console.log('[ID Document OCR] Motivo:', finalResult.motivo);
        const errorResponse = { 
          success: false,
          error: 'Documento inválido',
          message: 'A foto ou arquivo enviado não é um documento de identificação válido. Por favor, envie uma foto clara do seu RG ou CNH.',
          motivo: finalResult.motivo || 'Documento não reconhecido como RG ou CNH'
        };
        console.log('[ID Document OCR] Returning invalid document error:', JSON.stringify(errorResponse));
        return c.json(errorResponse, 400);
      }

      const lado = finalResult.lado;
      console.log('[ID Document OCR] Document side detected:', lado);

      if (lado === "verso") {
        console.log('[ID Document OCR] Back side detected, requesting front side');
        const response = { 
          success: true,
          needs_additional: true,
          current_side: 'verso',
          needs_side: 'frente',
          message: 'Documento verso identificado. Agora envie a frente do documento.',
          text_length: ocrText.length,
          validation: finalResult
        };
        console.log('[ID Document OCR] Returning success response:', JSON.stringify(response));
        return c.json(response);
      }

      if (lado === "frente") {
        console.log('[ID Document OCR] Front side detected, requesting back side');
        const response = { 
          success: true,
          needs_additional: true,
          current_side: 'frente',
          needs_side: 'verso',
          message: 'Documento frente identificado. Agora envie o verso do documento.',
          text_length: ocrText.length,
          validation: finalResult
        };
        console.log('[ID Document OCR] Returning success response:', JSON.stringify(response));
        return c.json(response);
      }

      console.log('[ID Document OCR] Complete document detected');
      const response = { 
        success: true,
        needs_additional: false,
        current_side: 'frente_e_verso',
        message: 'Documento completo validado com sucesso',
        text_length: ocrText.length,
        validation: finalResult
      };
      console.log('[ID Document OCR] Returning success response:', JSON.stringify(response));
      console.log('[ID Document OCR] === VALIDATION COMPLETE ===');
      return c.json(response);
    } catch (webhookError) {
      console.error('[ID Document OCR] === WEBHOOK ERROR ===');
      console.error('[ID Document OCR] Webhook error:', webhookError);
      console.error('[ID Document OCR] Error type:', webhookError instanceof Error ? webhookError.constructor.name : typeof webhookError);
      console.error('[ID Document OCR] Error message:', webhookError instanceof Error ? webhookError.message : String(webhookError));
      const errorResponse = { 
        error: 'Erro ao validar documento',
        message: 'Não foi possível processar o documento. Tente novamente.',
      };
      console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
      return c.json(errorResponse, 500);
    }
  } catch (error) {
    console.error('[ID Document OCR] === GENERAL ERROR ===');
    console.error('[ID Document OCR] General error:', error);
    console.error('[ID Document OCR] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[ID Document OCR] Error message:', error instanceof Error ? error.message : String(error));
    const errorResponse = { 
      error: 'Erro ao processar documento',
      details: error instanceof Error ? error.message : String(error)
    };
    console.error('[ID Document OCR] Returning error:', JSON.stringify(errorResponse));
    return c.json(errorResponse, 500);
  }
});

// Upload receiver documents
// Upload individual document - ID Document (Step 1)
receiver.post("/documents/upload/id-document", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    const formData = await c.req.formData();
    const idDocumentFile = formData.get("id_document") as File | null;
    const idDocumentBackFile = formData.get("id_document_back") as File | null;

    if (!idDocumentFile) {
      return c.json({ error: "Documento de identificação é obrigatório" }, 400);
    }

    const userId = user.id as number;
    const timestamp = Date.now();

    // Upload to R2
    const idDocumentKey = `receiver-docs/${userId}/id-document-${timestamp}.${idDocumentFile.name.split('.').pop()}`;
    const idDocumentBuffer = await idDocumentFile.arrayBuffer();
    const contentType1 = idDocumentFile.type || (idDocumentFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    await c.env.R2_BUCKET.put(idDocumentKey, Buffer.from(idDocumentBuffer), contentType1);

    let idDocumentBackKey: string | null = null;
    let idDocumentBackBuffer: ArrayBuffer | null = null;
    let contentType2: string | null = null;
    if (idDocumentBackFile) {
      idDocumentBackKey = `receiver-docs/${userId}/id-document-back-${timestamp}.${idDocumentBackFile.name.split('.').pop()}`;
      idDocumentBackBuffer = await idDocumentBackFile.arrayBuffer();
      contentType2 = idDocumentBackFile.type || (idDocumentBackFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      await c.env.R2_BUCKET.put(idDocumentBackKey, Buffer.from(idDocumentBackBuffer), contentType2);
    }

    // Update or create receiver_docs record
    const existingDocs = await c.env.DB.prepare(
      "SELECT * FROM receiver_docs WHERE user_id = ?"
    ).bind(userId).first();

    if (existingDocs) {
      await c.env.DB.prepare(
        `UPDATE receiver_docs SET id_document_url = ?, id_document_back_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).bind(idDocumentKey, idDocumentBackKey, userId).run();
    } else {
      // Include empty strings for selfie_url and address_proof_url to satisfy NOT NULL constraints
      await c.env.DB.prepare(
        `INSERT INTO receiver_docs (user_id, id_document_url, id_document_back_url, selfie_url, address_proof_url, status) VALUES (?, ?, ?, '', '', 'pending')`
      ).bind(userId, idDocumentKey, idDocumentBackKey).run();
    }

    // Create pending validation record (delete+insert to avoid constraint dependency)
    await c.env.DB.prepare(`DELETE FROM receiver_doc_validations WHERE user_id = ? AND doc_type = 'id_document'`).bind(userId).run();
    await c.env.DB.prepare(`INSERT INTO receiver_doc_validations (user_id, doc_type, status, updated_at) VALUES (?, 'id_document', 'pending', CURRENT_TIMESTAMP)`).bind(userId).run();

    // Capture request URL and headers before background task
    const requestUrl = c.req.url;
    const hostHeader = c.req.header('host');
    const forwardedHost = c.req.header('x-forwarded-host');
    
    // Process OCR in background using waitUntil to keep worker alive
    const backgroundTask = (async () => {
      try {
        console.log("[Upload ID Doc] Starting OCR processing...");
        
        // Convert buffer to base64
        let imageBase64 = Buffer.from(idDocumentBuffer).toString('base64');
        const isPdf = contentType1 === 'application/pdf' || idDocumentFile.name.toLowerCase().endsWith('.pdf');
        
        // Convert PDF to PNG if needed
        if (isPdf) {
          console.log("[Upload ID Doc] Converting PDF to PNG...");
          const pdfResult = await convertPdfToPng(imageBase64);
          if (!pdfResult.success || !pdfResult.png) {
            console.error("[Upload ID Doc] PDF conversion failed:", pdfResult.error);
            return;
          }
          imageBase64 = pdfResult.png;
        }
        
        // Resize image to reduce size for GPT context window (higher quality for documents)
        console.log("[Upload ID Doc] Resizing image...");
        const resizeResult = await resizeDocumentImage(imageBase64);
        if (resizeResult.success && resizeResult.resized) {
          imageBase64 = resizeResult.resized;
        }
        
        // Perform OCR
        console.log("[Upload ID Doc] Calling Google Vision OCR...");
        const ocrResult = await performOCR(imageBase64, c.env.GOOGLE_CLOUD_VISION_API_KEY);
        if (!ocrResult.success || !ocrResult.text) {
          console.error("[Upload ID Doc] OCR failed:", ocrResult.error);
          return;
        }
        
        console.log("[Upload ID Doc] OCR successful, text length:", ocrResult.text.length);
        
        // Send OCR result to n8n (front)
        console.log("[Upload ID Doc] Sending front to n8n...");
        await sendOCRToN8N("documento_identificacao", ocrResult.text, userId, "id_document", requestUrl, hostHeader, forwardedHost);
        console.log("[Upload ID Doc] Successfully sent front to n8n");
        
        // Process back of document if it exists
        if (idDocumentBackBuffer && contentType2) {
          console.log("[Upload ID Doc] Starting OCR processing for back...");
          
          let backImageBase64 = Buffer.from(idDocumentBackBuffer).toString('base64');
          const isBackPdf = contentType2 === 'application/pdf' || (idDocumentBackFile?.name?.toLowerCase()?.endsWith('.pdf') ?? false);
          
          // Convert PDF to PNG if needed
          if (isBackPdf) {
            console.log("[Upload ID Doc] Converting back PDF to PNG...");
            const backPdfResult = await convertPdfToPng(backImageBase64);
            if (!backPdfResult.success || !backPdfResult.png) {
              console.error("[Upload ID Doc] Back PDF conversion failed:", backPdfResult.error);
            } else {
              backImageBase64 = backPdfResult.png;
            }
          }
          
          // Resize back image to reduce size for GPT context window (higher quality for documents)
          console.log("[Upload ID Doc] Resizing back image...");
          const backResizeResult = await resizeDocumentImage(backImageBase64);
          if (backResizeResult.success && backResizeResult.resized) {
            backImageBase64 = backResizeResult.resized;
          }
          
          // Perform OCR on back
          console.log("[Upload ID Doc] Calling Google Vision OCR for back...");
          const backOcrResult = await performOCR(backImageBase64, c.env.GOOGLE_CLOUD_VISION_API_KEY);
          if (backOcrResult.success && backOcrResult.text) {
            console.log("[Upload ID Doc] Back OCR successful, text length:", backOcrResult.text.length);
            
            // Send back OCR result to n8n
            console.log("[Upload ID Doc] Sending back to n8n...");
            await sendOCRToN8N("documento_identificacao_verso", backOcrResult.text, userId, "id_document_back", requestUrl, hostHeader, forwardedHost);
            console.log("[Upload ID Doc] Successfully sent back to n8n");
          } else {
            console.error("[Upload ID Doc] Back OCR failed:", backOcrResult.error);
          }
        }
      } catch (error) {
        console.error("[Upload ID Doc] Background OCR error:", error);
      }
    })();
    
    // Use waitUntil to keep the worker alive for the background task
    backgroundTask.catch((e) => console.error("[Background] Unhandled error:", e));

    return c.json({ success: true, id_document_key: idDocumentKey, id_document_back_key: idDocumentBackKey });
  } catch (error) {
    console.error("Error uploading ID document:", error);
    return c.json({ error: "Erro ao fazer upload do documento" }, 500);
  }
});

// Upload individual document - Selfie (Step 2)
receiver.post("/documents/upload/selfie", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    const formData = await c.req.formData();
    const selfieFile = formData.get("selfie") as File | null;

    if (!selfieFile) {
      return c.json({ error: "Selfie é obrigatória" }, 400);
    }

    const userId = user.id as number;
    const timestamp = Date.now();

    // Upload to R2
    const selfieKey = `receiver-docs/${userId}/selfie-${timestamp}.${selfieFile.name.split('.').pop()}`;
    const selfieBuffer = await selfieFile.arrayBuffer();
    const contentType = selfieFile.type || 'image/jpeg';
    
    // Convert to base64 for n8n
    let selfieBase64 = Buffer.from(selfieBuffer).toString('base64');

    await c.env.R2_BUCKET.put(selfieKey, Buffer.from(selfieBuffer), contentType);

    // Update receiver_docs record
    await c.env.DB.prepare(
      `UPDATE receiver_docs SET selfie_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
    ).bind(selfieKey, userId).run();

    // Create pending validation record
    await c.env.DB.prepare(`DELETE FROM receiver_doc_validations WHERE user_id = ? AND doc_type = 'selfie'`).bind(userId).run();
    await c.env.DB.prepare(`INSERT INTO receiver_doc_validations (user_id, doc_type, status, updated_at) VALUES (?, 'selfie', 'pending', CURRENT_TIMESTAMP)`).bind(userId).run();

    // Get ID document URL for selfie comparison
    const docs = await c.env.DB.prepare(
      "SELECT id_document_url FROM receiver_docs WHERE user_id = ?"
    ).bind(userId).first();

    // Send selfie to n8n for face validation (no OCR needed)
    const requestUrl = c.req.url;
    const hostHeader = c.req.header('host');
    const forwardedHost = c.req.header('x-forwarded-host');
    const baseUrl = getCallbackBaseUrl(requestUrl, hostHeader, forwardedHost);
    const approveUrl = `${baseUrl}/api/receiver/documents/webhook/validate?user_id=${userId}&doc_type=selfie&status=approved&api_key=toodrop_n8n_webhook_key_2024`;
    const rejectUrl = `${baseUrl}/api/receiver/documents/webhook/validate?user_id=${userId}&doc_type=selfie&status=rejected&api_key=toodrop_n8n_webhook_key_2024`;
    
    // Use waitUntil to keep worker alive for the n8n request
    const backgroundTask = (async () => {
      try {
        // Resize selfie before sending to n8n
        console.log("[Upload Selfie] Resizing selfie image...");
        const resizeResult = await resizeImage(selfieBase64);
        if (resizeResult.success && resizeResult.resized) {
          selfieBase64 = resizeResult.resized;
        }
        
        const SELFIE_WEBHOOK_URL = "https://primary-production-1a8e5.up.railway.app/webhook/f32c6bd2-cea0-42f3-9575-e26e558be7a9";
        console.log("[Upload Selfie] Sending to n8n:", SELFIE_WEBHOOK_URL);
        const response = await fetch(SELFIE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campo: "selfie",
            ocr_text: "", // Selfie doesn't need OCR
            image: selfieBase64,
            selfie_url: `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(selfieKey)}`,
            id_document_url: docs?.id_document_url ? `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(docs.id_document_url as string)}` : null,
            timestamp: new Date().toISOString(),
            user_id: userId,
            doc_type: "selfie",
            approve_url: approveUrl,
            reject_url: rejectUrl,
            api_key: "toodrop_n8n_webhook_key_2024",
          }),
        });
        console.log("[Upload Selfie] n8n response status:", response.status);
        const responseText = await response.text();
        console.log("[Upload Selfie] n8n response body:", responseText);
      } catch (n8nError) {
        console.error("[Upload Selfie] Error sending to n8n:", n8nError);
      }
    })();
    
    backgroundTask.catch((e) => console.error("[Background] Unhandled error:", e));

    return c.json({ success: true, selfie_key: selfieKey });
  } catch (error) {
    console.error("Error uploading selfie:", error);
    return c.json({ error: "Erro ao fazer upload da selfie" }, 500);
  }
});

// Upload individual document - Address Proof (Step 4)
receiver.post("/documents/upload/address-proof", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  try {
    const formData = await c.req.formData();
    const addressProofFile = formData.get("address_proof") as File | null;
    const addressProofType = formData.get("address_proof_type") as string | null;

    if (!addressProofFile || !addressProofType) {
      return c.json({ error: "Comprovante de endereço e tipo são obrigatórios" }, 400);
    }

    const userId = user.id as number;
    const timestamp = Date.now();

    // Upload to R2
    const addressProofKey = `receiver-docs/${userId}/address-proof-${timestamp}.${addressProofFile.name.split('.').pop()}`;
    const addressProofBuffer = await addressProofFile.arrayBuffer();
    const contentType = addressProofFile.type || (addressProofFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    await c.env.R2_BUCKET.put(addressProofKey, Buffer.from(addressProofBuffer), contentType);

    // Update receiver_docs record and set user as pending
    await c.env.DB.prepare(
      `UPDATE receiver_docs SET address_proof_url = ?, address_proof_type = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
    ).bind(addressProofKey, addressProofType, userId).run();

    await c.env.DB.prepare(
      "UPDATE users SET is_receiver_pending = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(userId).run();

    // Create pending validation record
    await c.env.DB.prepare(`DELETE FROM receiver_doc_validations WHERE user_id = ? AND doc_type = 'address_proof'`).bind(userId).run();
    await c.env.DB.prepare(`INSERT INTO receiver_doc_validations (user_id, doc_type, status, updated_at) VALUES (?, 'address_proof', 'pending', CURRENT_TIMESTAMP)`).bind(userId).run();

    // Capture request URL and headers before background task
    const requestUrl = c.req.url;
    const hostHeader = c.req.header('host');
    const forwardedHost = c.req.header('x-forwarded-host');
    
    // Process OCR in background using waitUntil to keep worker alive
    const backgroundTask = (async () => {
      try {
        console.log("[Upload Address Proof] Starting OCR processing...");
        
        // Convert buffer to base64
        let imageBase64 = Buffer.from(addressProofBuffer).toString('base64');
        const isPdf = contentType === 'application/pdf' || addressProofFile.name.toLowerCase().endsWith('.pdf');
        
        // Convert PDF to PNG if needed
        if (isPdf) {
          console.log("[Upload Address Proof] Converting PDF to PNG...");
          const pdfResult = await convertPdfToPng(imageBase64);
          if (!pdfResult.success || !pdfResult.png) {
            console.error("[Upload Address Proof] PDF conversion failed:", pdfResult.error);
            return;
          }
          imageBase64 = pdfResult.png;
        }
        
        // Resize image to reduce size for GPT context window (higher quality for documents)
        console.log("[Upload Address Proof] Resizing image...");
        const resizeResult = await resizeDocumentImage(imageBase64);
        if (resizeResult.success && resizeResult.resized) {
          imageBase64 = resizeResult.resized;
        }
        
        // Perform OCR
        console.log("[Upload Address Proof] Calling Google Vision OCR...");
        const ocrResult = await performOCR(imageBase64, c.env.GOOGLE_CLOUD_VISION_API_KEY);
        if (!ocrResult.success || !ocrResult.text) {
          console.error("[Upload Address Proof] OCR failed:", ocrResult.error);
          return;
        }
        
        console.log("[Upload Address Proof] OCR successful, text length:", ocrResult.text.length);
        
        // Send OCR result to n8n with image
        console.log("[Upload Address Proof] Sending to n8n with image...");
        await sendOCRToN8N("comprovante_endereco", ocrResult.text, userId, "address_proof", requestUrl, hostHeader, forwardedHost, ADDRESS_PROOF_WEBHOOK_URL, imageBase64);
        console.log("[Upload Address Proof] Successfully sent to n8n");
      } catch (error) {
        console.error("[Upload Address Proof] Background OCR error:", error);
      }
    })();
    
    // Use waitUntil to keep the worker alive for the background task
    backgroundTask.catch((e) => console.error("[Background] Unhandled error:", e));

    return c.json({ success: true, address_proof_key: addressProofKey });
  } catch (error) {
    console.error("Error uploading address proof:", error);
    return c.json({ error: "Erro ao fazer upload do comprovante" }, 500);
  }
});

// LEGACY - Upload all documents at once (keeping for compatibility)
receiver.post("/documents/upload", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const address = await c.env.DB.prepare(
    "SELECT id FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address) {
    return c.json({ error: "Endereço de recebedor não cadastrado" }, 400);
  }

  try {
    const formData = await c.req.formData();
    
    const idDocumentFile = formData.get("id_document") as File | null;
    const idDocumentBackFile = formData.get("id_document_back") as File | null;
    const selfieFile = formData.get("selfie") as File | null;
    const addressProofFile = formData.get("address_proof") as File | null;
    const addressProofType = formData.get("address_proof_type") as string | null;

    if (!idDocumentFile || !selfieFile || !addressProofFile || !addressProofType) {
      return c.json({ error: "Todos os documentos são obrigatórios" }, 400);
    }

    const userId = user.id;
    const timestamp = Date.now();

    const idDocumentKey = `receiver-docs/${userId}/id-document-${timestamp}.${idDocumentFile.name.split('.').pop()}`;
    const selfieKey = `receiver-docs/${userId}/selfie-${timestamp}.${selfieFile.name.split('.').pop()}`;
    const addressProofKey = `receiver-docs/${userId}/address-proof-${timestamp}.${addressProofFile.name.split('.').pop()}`;

    const idDocumentBuffer = await idDocumentFile.arrayBuffer();
    const selfieBuffer = await selfieFile.arrayBuffer();
    const addressProofBuffer = await addressProofFile.arrayBuffer();

    const contentType1 = idDocumentFile.type || (idDocumentFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const contentType2 = selfieFile.type || 'image/jpeg';
    const contentType3 = addressProofFile.type || (addressProofFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    await c.env.R2_BUCKET.put(idDocumentKey, Buffer.from(idDocumentBuffer), contentType1);
    await c.env.R2_BUCKET.put(selfieKey, Buffer.from(selfieBuffer), contentType2);
    await c.env.R2_BUCKET.put(addressProofKey, Buffer.from(addressProofBuffer), contentType3);

    let idDocumentBackKey: string | null = null;
    if (idDocumentBackFile) {
      idDocumentBackKey = `receiver-docs/${userId}/id-document-back-${timestamp}.${idDocumentBackFile.name.split('.').pop()}`;
      const idDocumentBackBuffer = await idDocumentBackFile.arrayBuffer();
      const contentType4 = idDocumentBackFile.type || (idDocumentBackFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      await c.env.R2_BUCKET.put(idDocumentBackKey, Buffer.from(idDocumentBackBuffer), contentType4);
    }

    await c.env.DB.prepare(
      `INSERT INTO receiver_docs
       (user_id, id_document_url, id_document_back_url, selfie_url, address_proof_url, address_proof_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         id_document_url = EXCLUDED.id_document_url,
         id_document_back_url = EXCLUDED.id_document_back_url,
         selfie_url = EXCLUDED.selfie_url,
         address_proof_url = EXCLUDED.address_proof_url,
         address_proof_type = EXCLUDED.address_proof_type,
         status = 'pending',
         updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, idDocumentKey, idDocumentBackKey, selfieKey, addressProofKey, addressProofType, "pending").run();

    await c.env.DB.prepare(
      "UPDATE users SET is_receiver_pending = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(userId).run();

    // Create pending validation records for each document type
    const docTypes = ["id_document", "selfie", "address_proof"];
    for (const docType of docTypes) {
      await c.env.DB.prepare(`DELETE FROM receiver_doc_validations WHERE user_id = ? AND doc_type = ?`).bind(userId, docType).run();
      await c.env.DB.prepare(`INSERT INTO receiver_doc_validations (user_id, doc_type, status, updated_at) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)`).bind(userId, docType).run();
    }

    // Send documents to n8n for async validation - one POST per document
    try {
      const hostHeader = c.req.header('host');
      const forwardedHost = c.req.header('x-forwarded-host');
      const baseUrl = getCallbackBaseUrl(c.req.url, hostHeader, forwardedHost);
      const callbackUrl = `${baseUrl}/api/receiver/documents/webhook/validate`;
      const n8nWebhookUrl = "https://primary-production-1a8e5.up.railway.app/webhook/receiver-docs-validation";
      const timestamp = new Date().toISOString();
      
      // POST 1: ID Document
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          doc_type: "id_document",
          document_url: `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(idDocumentKey)}`,
          document_back_url: idDocumentBackKey ? `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(idDocumentBackKey)}` : null,
          callback_url: callbackUrl,
          api_key: "toodrop_n8n_webhook_key_2024",
          timestamp,
        }),
      });
      console.log("[Upload Docs] Sent id_document to n8n");
      
      // POST 2: Selfie
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          doc_type: "selfie",
          document_url: `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(selfieKey)}`,
          id_document_url: `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(idDocumentKey)}`,
          callback_url: callbackUrl,
          api_key: "toodrop_n8n_webhook_key_2024",
          timestamp,
        }),
      });
      console.log("[Upload Docs] Sent selfie to n8n");
      
      // POST 3: Address Proof
      await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          doc_type: "address_proof",
          document_url: `${baseUrl}/api/receiver/documents/file/${encodeURIComponent(addressProofKey)}`,
          address_proof_type: addressProofType,
          callback_url: callbackUrl,
          api_key: "toodrop_n8n_webhook_key_2024",
          timestamp,
        }),
      });
      console.log("[Upload Docs] Sent address_proof to n8n");
      
    } catch (n8nError) {
      console.error("[Upload Docs] Error sending to n8n:", n8nError);
      // Continue anyway - admin can manually approve
    }

    const docs = await c.env.DB.prepare(
      "SELECT * FROM receiver_docs WHERE user_id = ?"
    ).bind(userId).first();

    return c.json({ ...docs, validation_pending: true });
  } catch (error) {
    console.error("Error uploading documents:", error);
    return c.json({ error: "Erro ao fazer upload dos documentos" }, 500);
  }
});

// Get receiver documents
receiver.get("/documents", unifiedAuthMiddleware, async (c) => {
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

  const docs = await c.env.DB.prepare(
    "SELECT * FROM receiver_docs WHERE user_id = ?"
  ).bind(user.id).first();

  // Check if all individual documents have been validated/approved by n8n
  const { results: validations } = await c.env.DB.prepare(
    "SELECT * FROM receiver_doc_validations WHERE user_id = ?"
  ).bind(user.id).all();

  // Check for required docs: id_document, selfie, address_proof (id_document_back is optional)
  const requiredDocs = ['id_document', 'selfie', 'address_proof'];
  const hasAllRequiredDocs = requiredDocs.every(docType => 
    validations.some((v: any) => v.doc_type === docType)
  );
  
  const allDocsApprovedByN8N = hasAllRequiredDocs && 
    validations.every((v: any) => v.status === "approved");

  if (docs) {
    return c.json({ ...docs, all_docs_validated: allDocsApprovedByN8N });
  }
  return c.json(null);
});

// Get document file from GCS
receiver.get("/documents/file/:key", async (c) => {
  const key = c.req.param("key");
  const decodedKey = decodeURIComponent(key);

  try {
    const data = await c.env.R2_BUCKET.get(decodedKey);

    if (!data) {
      return c.json({ error: "File not found", key: decodedKey }, 404);
    }

    const ext = decodedKey.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = contentTypeMap[ext ?? ""] ?? "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Content-Security-Policy": "frame-ancestors 'self' https://*.toodrop.com",
      },
    });
  } catch (error) {
    return c.json({
      error: "Error fetching file",
      details: error instanceof Error ? error.message : String(error),
      key: decodedKey,
    }, 500);
  }
});

// Get receiver point status
receiver.get("/point-status", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, is_receiver_active, receiver_commission_percent, driver_commission_percent, platform_commission_percent FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não ativo" }, 403);
  }

  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address || !address.receiver_key) {
    return c.json({ error: "Chave do ponto não encontrada" }, 404);
  }

  const status = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(address.receiver_key).first();

  const commissionData = {
    receiver_commission_percent: user.receiver_commission_percent ?? 60,
    driver_commission_percent: user.driver_commission_percent ?? 20,
    platform_commission_percent: user.platform_commission_percent ?? 20,
  };

  if (!status) {
    return c.json({
      receiver_key: address.receiver_key,
      is_active: 0,
      service_price: 10.00,
      ...commissionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return c.json({ ...status, ...commissionData });
});

// Update receiver point status
receiver.post("/point-status", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { is_active } = body;

  if (typeof is_active !== "boolean") {
    return c.json({ error: "is_active deve ser um boolean" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, is_receiver_active FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não ativo" }, 403);
  }

  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address || !address.receiver_key) {
    return c.json({ error: "Chave do ponto não encontrada" }, 404);
  }

  await c.env.DB.prepare(
    `INSERT INTO receiver_point_status (receiver_key, is_active, updated_at) 
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(receiver_key) DO UPDATE SET is_active = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(address.receiver_key, is_active ? 1 : 0, is_active ? 1 : 0).run();

  const status = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(address.receiver_key).first();

  return c.json(status);
});

// Update hub active status
receiver.post("/hub-active-status", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { active_hub } = body;

  if (typeof active_hub !== "number" || (active_hub !== 0 && active_hub !== 1)) {
    return c.json({ error: "active_hub deve ser 0 ou 1" }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, is_receiver_active FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  if (!user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não ativo" }, 403);
  }

  const address = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND address_type = 'receiver'"
  ).bind(user.id).first();

  if (!address || !address.receiver_key) {
    return c.json({ error: "Chave do ponto não encontrada" }, 404);
  }

  const timestamp = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE receiver_point_status 
     SET active_hub = ?, last_ping = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE receiver_key = ?`
  ).bind(active_hub, timestamp, address.receiver_key).run();

  const status = await c.env.DB.prepare(
    "SELECT * FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(address.receiver_key).first();

  return c.json(status);
});

// Get receiver schedule
receiver.get("/schedule", unifiedAuthMiddleware, async (c) => {
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

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM schedules WHERE user_id = ? ORDER BY day_of_week"
  ).bind(user.id).all();

  return c.json(results);
});

// Update receiver schedule
receiver.post("/schedule", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();

  const parsed = UpdateScheduleInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.errors.map(e => e.message).join(", ");
    return c.json({ error: errorMessage }, 400);
  }

  const user = await c.env.DB.prepare(
    `SELECT * FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first();

  if (!user || !user.is_receiver_active) {
    return c.json({ error: "Perfil de recebedor não habilitado" }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM schedules WHERE user_id = ?"
  ).bind(user.id).run();

  for (const schedule of parsed.data.schedules) {
    await c.env.DB.prepare(
      `INSERT INTO schedules 
       (user_id, day_of_week, range1_start, range1_end, range2_start, range2_end, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.id,
      schedule.day_of_week,
      schedule.range1_start,
      schedule.range1_end,
      schedule.range2_start,
      schedule.range2_end,
      schedule.is_active ? 1 : 0
    ).run();
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM schedules WHERE user_id = ? ORDER BY day_of_week"
  ).bind(user.id).all();

  return c.json(results);
});

// Scan delivery QR code
receiver.post("/scan-delivery", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { receiver_key, droptag_id, driver_user_id } = body;

  if (!receiver_key || !droptag_id || !driver_user_id) {
    return c.json({ error: "Dados inválidos" }, 400);
  }

  // First, get the scanning user's receiver info
  const scanningUser = await c.env.DB.prepare(
    `SELECT u.id, a.receiver_key as user_receiver_key, a.nickname FROM users u
     INNER JOIN addresses a ON u.id = a.user_id
     WHERE u.${userQuery.field} = ? AND u.is_receiver_active = 1 AND a.address_type = 'receiver'`
  ).bind(userQuery.value).first();

  if (!scanningUser) {
    return c.json({ error: "Você não está cadastrado como recebedor ativo" }, 403);
  }

  // Check if the scanning user's receiver_key matches the one in the QR code
  if (scanningUser.user_receiver_key !== receiver_key) {
    // Get the name of the intended receiver to show in the message
    const intendedReceiver = await c.env.DB.prepare(
      `SELECT u.full_name FROM addresses a 
       INNER JOIN users u ON a.user_id = u.id 
       WHERE a.receiver_key = ?`
    ).bind(receiver_key).first();

    const fullName = intendedReceiver?.full_name as string || '';
    const firstName = fullName.split(' ')[0] || 'outra pessoa';
    
    // Record the wrong receiver scan attempt so the driver can be notified
    const driverIdInt = parseInt(String(driver_user_id), 10);
    const droptagIdInt = parseInt(String(droptag_id), 10);
    console.log('[WRONG_RECEIVER] Updating wrong_receiver_scan_at for droptag:', droptagIdInt, 'driver:', driverIdInt);
    
    // First check if the record exists
    const existingRecord = await c.env.DB.prepare(
      `SELECT id, droptag_id, driver_user_id, status, sub_status FROM driver_deliveries 
       WHERE droptag_id = ? AND driver_user_id = ?`
    ).bind(droptagIdInt, driverIdInt).first();
    console.log('[WRONG_RECEIVER] Existing record:', JSON.stringify(existingRecord));
    
    // Update without status condition - we want to mark wrong scan regardless
    const updateResult = await c.env.DB.prepare(
      `UPDATE driver_deliveries 
       SET wrong_receiver_scan_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE droptag_id = ? AND driver_user_id = ?`
    ).bind(droptagIdInt, driverIdInt).run();
    const rowsAffected = updateResult.meta?.changes || 0;
    console.log('[WRONG_RECEIVER] Update result:', rowsAffected, 'rows affected');
    
    return c.json({ 
      error: "QR Code de outro recebedor",
      message: `O entregador gerou o QrCode do ponto do(a) ${firstName}. Peça para gerar o seu QrCode.`,
      wrong_receiver: true,
      debug: {
        droptag_id: droptagIdInt,
        driver_user_id: driverIdInt,
        existing_record: existingRecord,
        rows_updated: rowsAffected
      }
    }, 403);
  }

  const receiver = scanningUser;

  const droptag = await c.env.DB.prepare(
    `SELECT * FROM droptags WHERE id = ?`
  ).bind(droptag_id).first();

  if (!droptag) {
    return c.json({ error: "Pacote não encontrado" }, 404);
  }

  const isAuthorized = await c.env.DB.prepare(
    `SELECT id FROM droptag_authorized_receivers WHERE droptag_id = ? AND receiver_key = ?`
  ).bind(droptag_id, receiver_key).first();

  if (!isAuthorized) {
    return c.json({ error: "Você não está autorizado a receber este pacote" }, 403);
  }

  // If droptag has a secret word, require validation before confirming
  if (droptag.secret_word) {
    // Update driver_deliveries to signal awaiting secret word validation
    // Note: driver_user_id from QR might be string, convert to integer for DB query
    const driverIdInt = parseInt(String(driver_user_id), 10);
    const droptagIdInt = parseInt(String(droptag_id), 10);
    
    console.log('[SECRET_WORD] scan-delivery: Looking for driver_deliveries with droptag_id:', droptagIdInt, 'driver_user_id:', driverIdInt);
    
    // Find the driver_deliveries record - must be in_transit status
    const existingDD = await c.env.DB.prepare(
      `SELECT id, sub_status, status, driver_user_id, droptag_id 
       FROM driver_deliveries 
       WHERE droptag_id = ? AND driver_user_id = ? AND status = 'in_transit'`
    ).bind(droptagIdInt, driverIdInt).first() as {
      id: number;
      sub_status: string;
      status: string;
      driver_user_id: number;
      droptag_id: number;
    } | null;

    console.log('[SECRET_WORD] scan-delivery: Found existingDD:', existingDD);

    if (!existingDD) {
      // Debug: Check if record exists with different status or IDs
      const anyDD = await c.env.DB.prepare(
        `SELECT id, status, sub_status, driver_user_id, droptag_id 
         FROM driver_deliveries 
         WHERE droptag_id = ? OR driver_user_id = ?
         LIMIT 5`
      ).bind(droptagIdInt, driverIdInt).all();
      
      console.log('[SECRET_WORD] scan-delivery: DEBUG - Related driver_deliveries:', anyDD.results);
      console.log('[SECRET_WORD] scan-delivery: ERROR - No in_transit delivery found for droptag_id:', droptagIdInt, 'driver_user_id:', driverIdInt);
      
      return c.json({ 
        error: "Entrega não encontrada",
        message: "O entregador precisa gerar um novo QR Code. Este QR Code pode estar desatualizado.",
        debug: { droptag_id: droptagIdInt, driver_user_id: driverIdInt }
      }, 404);
    }

    // Update to awaiting_secret_word status
    const updateResult = await c.env.DB.prepare(
      `UPDATE driver_deliveries 
       SET sub_status = 'awaiting_secret_word', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(existingDD.id).run();
    
    console.log('[SECRET_WORD] scan-delivery: Updated sub_status to awaiting_secret_word, changes:', updateResult.meta.changes);

    if (updateResult.meta.changes === 0) {
      console.log('[SECRET_WORD] scan-delivery: ERROR - Update failed, no rows changed');
      return c.json({ 
        error: "Erro ao processar entrega",
        message: "Não foi possível atualizar o status. Tente novamente."
      }, 500);
    }

    return c.json({
      requires_secret_word: true,
      droptag_id,
      driver_user_id,
      receiver_id: receiver.id,
      receiver_key,
      secret_word: droptag.secret_word, // Send to receiver so they can display and speak it
      message: "Pacote requer validação da palavra secreta"
    });
  }

  // No secret word - proceed with auto-confirmation
  
  // Fetch service price and commission percentages
  const receiverPoint = await c.env.DB.prepare(
    "SELECT service_price FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(receiver_key).first() as { service_price: number } | null;
  
  const driverUser = await c.env.DB.prepare(
    "SELECT driver_commission_percent FROM users WHERE id = ?"
  ).bind(driver_user_id).first() as { driver_commission_percent: number } | null;
  
  const receiverUser = await c.env.DB.prepare(
    "SELECT receiver_commission_percent FROM users WHERE id = ?"
  ).bind(receiver.id).first() as { receiver_commission_percent: number } | null;
  
  const servicePrice = receiverPoint?.service_price ?? 10.00;
  const driverCommissionPercent = driverUser?.driver_commission_percent ?? 20;
  const receiverCommissionPercent = receiverUser?.receiver_commission_percent ?? 60;
  
  const driverCommissionAmount = servicePrice * driverCommissionPercent / 100;
  const receiverCommissionAmount = servicePrice * receiverCommissionPercent / 100;
  
  const existingDriverDelivery = await c.env.DB.prepare(
    `SELECT id FROM driver_deliveries WHERE droptag_id = ? AND driver_user_id = ?`
  ).bind(droptag_id, driver_user_id).first();

  if (!existingDriverDelivery) {
    await c.env.DB.prepare(
      `INSERT INTO driver_deliveries (driver_user_id, droptag_id, status, sub_status, delivered_at, service_price, commission_percent, commission_amount)
       VALUES (?, ?, 'delivered', 'awaiting_commission', CURRENT_TIMESTAMP, ?, ?, ?)`
    ).bind(driver_user_id, droptag_id, servicePrice, driverCommissionPercent, driverCommissionAmount).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE driver_deliveries 
       SET status = 'delivered', sub_status = 'awaiting_commission', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
           service_price = ?, commission_percent = ?, commission_amount = ?
       WHERE droptag_id = ? AND driver_user_id = ?`
    ).bind(servicePrice, driverCommissionPercent, driverCommissionAmount, droptag_id, driver_user_id).run();
  }

  await c.env.DB.prepare(
    `UPDATE droptags 
     SET status = 'awaiting_pickup', receiver_user_id = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(receiver.id, droptag_id).run();

  // Check if receiver_deliveries already exists
  const existingReceiverDelivery = await c.env.DB.prepare(
    `SELECT id FROM receiver_deliveries WHERE droptag_id = ? AND receiver_user_id = ?`
  ).bind(droptag_id, receiver.id).first();

  if (!existingReceiverDelivery) {
    await c.env.DB.prepare(
      `INSERT INTO receiver_deliveries (receiver_user_id, droptag_id, driver_user_id, status, sub_status, service_price, commission_percent, commission_amount)
       VALUES (?, ?, ?, 'awaiting_pickup', 'awaiting_commission', ?, ?, ?)`
    ).bind(receiver.id, droptag_id, driver_user_id, servicePrice, receiverCommissionPercent, receiverCommissionAmount).run();
    console.log(`[SCAN_DELIVERY] Created receiver_deliveries for user_id: ${receiver.id}`);
  } else {
    await c.env.DB.prepare(
      `UPDATE receiver_deliveries 
       SET status = 'awaiting_pickup', sub_status = 'awaiting_commission', updated_at = CURRENT_TIMESTAMP,
           service_price = ?, commission_percent = ?, commission_amount = ?
       WHERE droptag_id = ? AND receiver_user_id = ?`
    ).bind(servicePrice, receiverCommissionPercent, receiverCommissionAmount, droptag_id, receiver.id).run();
    console.log(`[SCAN_DELIVERY] Updated existing receiver_deliveries for user_id: ${receiver.id}`);
  }

  // Register pending commissions for driver and receiver
  // Check if transactions already exist for this droptag
  const existingDriverTx = await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(driver_user_id, droptag_id).first();

  const existingReceiverTx = await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(receiver.id, droptag_id).first();

  // Create pending transaction for driver (balance updated only after payment confirmation)
  if (driver_user_id && driverCommissionAmount > 0 && !existingDriverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      driver_user_id,
      "commission_received",
      driverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();
    console.log(`[SCAN_DELIVERY] Driver ${driver_user_id} commission R$ ${driverCommissionAmount.toFixed(2)} registered as pending`);
  } else if (existingDriverTx) {
    console.log(`[SCAN_DELIVERY] Driver ${driver_user_id} already has transaction for droptag ${droptag_id}`);
  }

  // Create pending transaction for receiver (balance updated only after payment confirmation)
  if (receiver.id && receiverCommissionAmount > 0 && !existingReceiverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      receiver.id,
      "commission_received",
      receiverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();
    console.log(`[SCAN_DELIVERY] Receiver ${receiver.id} commission R$ ${receiverCommissionAmount.toFixed(2)} registered as pending`);
  } else if (existingReceiverTx) {
    console.log(`[SCAN_DELIVERY] Receiver ${receiver.id} already has transaction for droptag ${droptag_id}`);
  }

  return c.json({ 
    success: true, 
    message: "Entrega registrada com sucesso" 
  });
});

// Validate secret word - called by driver after receiver scans QR
receiver.post("/validate-secret-word", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const { droptag_id, driver_user_id, receiver_id, receiver_key, secret_word } = body;

  if (!droptag_id || !driver_user_id || !receiver_id || !receiver_key || !secret_word) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Get the droptag to verify secret word
  const droptag = await c.env.DB.prepare(
    "SELECT id, secret_word FROM droptags WHERE id = ?"
  ).bind(droptag_id).first() as { id: number; secret_word: string } | null;

  if (!droptag) {
    return c.json({ error: "Pacote não encontrado" }, 404);
  }

  if (!droptag.secret_word) {
    return c.json({ error: "Este pacote não requer palavra secreta" }, 400);
  }

  // Check for existing attempt record
  let attemptRecord = await c.env.DB.prepare(
    "SELECT id, failed_attempts, blocked_until FROM secret_word_attempts WHERE droptag_id = ? AND driver_user_id = ?"
  ).bind(droptag_id, driver_user_id).first() as { id: number; failed_attempts: number; blocked_until: string | null } | null;

  // Check if blocked
  if (attemptRecord?.blocked_until) {
    const blockedUntil = new Date(attemptRecord.blocked_until);
    const now = new Date();
    if (now < blockedUntil) {
      const remainingMs = blockedUntil.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
      return c.json({ 
        error: `Tentativas esgotadas. Aguarde ${remainingMinutes} minuto(s) para tentar novamente.`,
        blocked: true,
        blocked_until: attemptRecord.blocked_until,
        remaining_minutes: remainingMinutes
      }, 429);
    }
    // Block expired, reset attempts
    await c.env.DB.prepare(
      "UPDATE secret_word_attempts SET failed_attempts = 0, blocked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(attemptRecord.id).run();
    attemptRecord.failed_attempts = 0;
    attemptRecord.blocked_until = null;
  }

  // Validate secret word (case insensitive, trimmed)
  const isValid = secret_word.trim().toLowerCase() === droptag.secret_word.trim().toLowerCase();

  if (!isValid) {
    // Wrong secret word
    if (!attemptRecord) {
      // Create new attempt record
      await c.env.DB.prepare(
        "INSERT INTO secret_word_attempts (droptag_id, driver_user_id, failed_attempts, last_attempt_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)"
      ).bind(droptag_id, driver_user_id).run();
      return c.json({ 
        error: "Palavra secreta incorreta", 
        attempts_remaining: 2 
      }, 400);
    } else {
      const newFailedAttempts = attemptRecord.failed_attempts + 1;
      if (newFailedAttempts >= 3) {
        // Block for 15 minutes
        const blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await c.env.DB.prepare(
          "UPDATE secret_word_attempts SET failed_attempts = ?, last_attempt_at = CURRENT_TIMESTAMP, blocked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newFailedAttempts, blockedUntil, attemptRecord.id).run();
        return c.json({ 
          error: "Tentativas esgotadas. Aguarde 15 minutos para tentar novamente.",
          blocked: true,
          blocked_until: blockedUntil,
          remaining_minutes: 15
        }, 429);
      } else {
        await c.env.DB.prepare(
          "UPDATE secret_word_attempts SET failed_attempts = ?, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(newFailedAttempts, attemptRecord.id).run();
        return c.json({ 
          error: "Palavra secreta incorreta", 
          attempts_remaining: 3 - newFailedAttempts 
        }, 400);
      }
    }
  }

  // Secret word is correct - confirm the delivery
  // Clear attempt record if exists
  if (attemptRecord) {
    await c.env.DB.prepare(
      "DELETE FROM secret_word_attempts WHERE id = ?"
    ).bind(attemptRecord.id).run();
  }

  // Complete the delivery (same logic as scan-delivery without secret word)
  
  // Fetch service price and commission percentages
  const receiverPoint = await c.env.DB.prepare(
    "SELECT service_price FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(receiver_key).first() as { service_price: number } | null;
  
  const driverUser = await c.env.DB.prepare(
    "SELECT driver_commission_percent FROM users WHERE id = ?"
  ).bind(driver_user_id).first() as { driver_commission_percent: number } | null;
  
  const receiverUser = await c.env.DB.prepare(
    "SELECT receiver_commission_percent FROM users WHERE id = ?"
  ).bind(receiver_id).first() as { receiver_commission_percent: number } | null;
  
  const servicePrice = receiverPoint?.service_price ?? 10.00;
  const driverCommissionPercent = driverUser?.driver_commission_percent ?? 20;
  const receiverCommissionPercent = receiverUser?.receiver_commission_percent ?? 60;
  
  const driverCommissionAmount = servicePrice * driverCommissionPercent / 100;
  const receiverCommissionAmount = servicePrice * receiverCommissionPercent / 100;

  const existingDriverDelivery = await c.env.DB.prepare(
    `SELECT id FROM driver_deliveries WHERE droptag_id = ? AND driver_user_id = ?`
  ).bind(droptag_id, driver_user_id).first();

  if (!existingDriverDelivery) {
    await c.env.DB.prepare(
      `INSERT INTO driver_deliveries (driver_user_id, droptag_id, status, sub_status, delivered_at, service_price, commission_percent, commission_amount)
       VALUES (?, ?, 'delivered', 'awaiting_commission', CURRENT_TIMESTAMP, ?, ?, ?)`
    ).bind(driver_user_id, droptag_id, servicePrice, driverCommissionPercent, driverCommissionAmount).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE driver_deliveries 
       SET status = 'delivered', sub_status = 'awaiting_commission', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
           service_price = ?, commission_percent = ?, commission_amount = ?
       WHERE droptag_id = ? AND driver_user_id = ?`
    ).bind(servicePrice, driverCommissionPercent, driverCommissionAmount, droptag_id, driver_user_id).run();
  }

  await c.env.DB.prepare(
    `UPDATE droptags 
     SET status = 'awaiting_pickup', receiver_user_id = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(receiver_id, droptag_id).run();

  // Check if receiver_deliveries already exists
  const existingReceiverDelivery = await c.env.DB.prepare(
    `SELECT id FROM receiver_deliveries WHERE droptag_id = ? AND receiver_user_id = ?`
  ).bind(droptag_id, receiver_id).first();

  if (!existingReceiverDelivery) {
    await c.env.DB.prepare(
      `INSERT INTO receiver_deliveries (receiver_user_id, droptag_id, driver_user_id, status, sub_status, service_price, commission_percent, commission_amount)
       VALUES (?, ?, ?, 'awaiting_pickup', 'awaiting_commission', ?, ?, ?)`
    ).bind(receiver_id, droptag_id, driver_user_id, servicePrice, receiverCommissionPercent, receiverCommissionAmount).run();
    console.log(`[VALIDATE_SECRET_WORD] Created receiver_deliveries for user_id: ${receiver_id}`);
  } else {
    await c.env.DB.prepare(
      `UPDATE receiver_deliveries 
       SET status = 'awaiting_pickup', sub_status = 'awaiting_commission', updated_at = CURRENT_TIMESTAMP,
           service_price = ?, commission_percent = ?, commission_amount = ?
       WHERE droptag_id = ? AND receiver_user_id = ?`
    ).bind(servicePrice, receiverCommissionPercent, receiverCommissionAmount, droptag_id, receiver_id).run();
    console.log(`[VALIDATE_SECRET_WORD] Updated existing receiver_deliveries for user_id: ${receiver_id}`);
  }

  // Register pending commissions for driver and receiver
  // Check if transactions already exist for this droptag
  const existingDriverTx = await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(driver_user_id, droptag_id).first();

  const existingReceiverTx = await c.env.DB.prepare(
    `SELECT id FROM user_transactions WHERE user_id = ? AND related_droptag_id = ? AND type = 'commission_received'`
  ).bind(receiver_id, droptag_id).first();

  // Create pending transaction for driver (balance updated only after payment confirmation)
  if (driver_user_id && driverCommissionAmount > 0 && !existingDriverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      driver_user_id,
      "commission_received",
      driverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();
    console.log(`[VALIDATE_SECRET_WORD] Driver ${driver_user_id} commission R$ ${driverCommissionAmount.toFixed(2)} registered as pending`);
  } else if (existingDriverTx) {
    console.log(`[VALIDATE_SECRET_WORD] Driver ${driver_user_id} already has transaction for droptag ${droptag_id}`);
  }

  // Create pending transaction for receiver (balance updated only after payment confirmation)
  if (receiver_id && receiverCommissionAmount > 0 && !existingReceiverTx) {
    await c.env.DB.prepare(
      `INSERT INTO user_transactions (
        user_id, type, amount, description, related_droptag_id, 
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      receiver_id,
      "commission_received",
      receiverCommissionAmount,
      `Comissão - Entrega #${droptag_id}`,
      droptag_id,
      "pending"
    ).run();
    console.log(`[VALIDATE_SECRET_WORD] Receiver ${receiver_id} commission R$ ${receiverCommissionAmount.toFixed(2)} registered as pending`);
  } else if (existingReceiverTx) {
    console.log(`[VALIDATE_SECRET_WORD] Receiver ${receiver_id} already has transaction for droptag ${droptag_id}`);
  }

  // Send email to Dropper One (consumer) notifying package is ready for pickup
  const consumerUser = await c.env.DB.prepare(
    `SELECT u.full_name, u.email 
     FROM users u
     INNER JOIN droptags d ON d.consumer_user_id = u.id
     WHERE d.id = ?`
  ).bind(droptag_id).first() as { full_name: string; email: string } | null;

  const receiverUserData = await c.env.DB.prepare(
    `SELECT u.full_name, a.nickname 
     FROM users u
     INNER JOIN addresses a ON u.id = a.user_id
     WHERE u.id = ? AND a.address_type = 'receiver'`
  ).bind(receiver_id).first() as { full_name: string; nickname: string } | null;

  if (consumerUser?.email && consumerUser?.full_name && receiverUserData && c.env.EMAILS) {
    try {
      const email = packageDeliveredToToodropperEmail(
        consumerUser.full_name,
        receiverUserData.full_name,
        receiverUserData.nickname
      );
      await c.env.EMAILS.send({
        to: consumerUser.email,
        subject: email.subject,
        html_body: email.html_body,
        text_body: email.text_body,
      });
      console.log(`[Package Delivered Email] Sent to ${consumerUser.email}`);
    } catch (error) {
      console.error("[Package Delivered Email] Error:", error);
    }
  }

  return c.json({ 
    success: true, 
    message: "Entrega registrada com sucesso" 
  });
});

// Get receiver deliveries
receiver.get("/my-deliveries", unifiedAuthMiddleware, async (c) => {
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

  // Optimized single query with JOINs instead of N+1 queries
  const { results: deliveries } = await c.env.DB.prepare(
    `SELECT 
       rd.id,
       rd.droptag_id,
       rd.received_at,
       rd.status,
       rd.sub_status,
       rd.picked_up_at,
       rd.service_price,
       rd.commission_percent,
       rd.commission_amount,
       rd.driver_user_id,
       d.uuid,
       d.title,
       d.tracking_code,
       d.secret_word,
       d.notes,
       consumer.full_name as consumer_name,
       consumer.phone as consumer_phone,
       addr.street as consumer_street,
       addr.number as consumer_number,
       addr.complement as consumer_complement,
       addr.neighborhood as consumer_neighborhood,
       addr.city as consumer_city,
       addr.state as consumer_state,
       addr.cep as consumer_cep,
       addr.latitude as consumer_lat,
       addr.longitude as consumer_lng,
       driver.full_name as driver_name
     FROM receiver_deliveries rd
     INNER JOIN droptags d ON rd.droptag_id = d.id
     LEFT JOIN users consumer ON d.consumer_user_id = consumer.id
     LEFT JOIN addresses addr ON d.address_id = addr.id
     LEFT JOIN users driver ON rd.driver_user_id = driver.id
     WHERE rd.receiver_user_id = ?
     ORDER BY rd.created_at DESC`
  ).bind(user.id).all();

  const now = new Date();
  const formattedDeliveries = deliveries.map((delivery: any) => {
    const receivedDate = new Date(String(delivery.received_at));
    const daysStored = Math.floor((now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24));

    // Format address for Maps
    let consumerAddressFormatted = null;
    if (delivery.consumer_street) {
      consumerAddressFormatted = `${delivery.consumer_street}, ${delivery.consumer_number}${delivery.consumer_complement ? ' - ' + delivery.consumer_complement : ''}, ${delivery.consumer_neighborhood}, ${delivery.consumer_city} - ${delivery.consumer_state}, ${delivery.consumer_cep}`;
    }

    return {
      id: delivery.id,
      tracking_code: delivery.tracking_code,
      consumer_name: delivery.consumer_name || 'Consumidor não encontrado',
      consumer_phone: delivery.consumer_phone || null,
      consumer_address: consumerAddressFormatted,
      consumer_lat: delivery.consumer_lat || null,
      consumer_lng: delivery.consumer_lng || null,
      received_at: delivery.received_at,
      status: delivery.status,
      sub_status: delivery.sub_status || null,
      title: delivery.title,
      days_stored: daysStored,
      delivered_at: delivery.picked_up_at,
      secret_word: delivery.secret_word || null,
      service_price: delivery.service_price,
      commission_percent: delivery.commission_percent,
      commission_amount: delivery.commission_amount,
      notes: delivery.notes || null,
      driver_name: delivery.driver_name || null,
    };
  });

  return c.json(formattedDeliveries);
});

// Webhook endpoint for n8n to send document validation results
// Supports both GET (with query params) and POST (with JSON body or query params)
receiver.all("/documents/webhook/validate", async (c) => {
  try {
    // Try to get params from query string first, then from body
    const query = c.req.query();
    let user_id = query.user_id;
    let doc_type = query.doc_type;
    let status = query.status;
    let rejection_reason = query.rejection_reason;
    let api_key = query.api_key;
    
    // If not in query, try JSON body (for POST requests)
    if (!user_id && c.req.method === "POST") {
      try {
        const body = await c.req.json();
        user_id = body.user_id;
        doc_type = body.doc_type;
        status = body.status;
        rejection_reason = body.rejection_reason;
        api_key = body.api_key;
      } catch {
        // Body might be empty or not JSON
      }
    }
    
    console.log(`[Webhook Validate] Received: user_id=${user_id}, doc_type=${doc_type}, status=${status}`);

    // Simple API key validation
    if (api_key !== "toodrop_n8n_webhook_key_2024") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!user_id || !doc_type || !status) {
      return c.json({ error: "Dados inválidos - user_id, doc_type e status são obrigatórios" }, 400);
    }

    const validDocTypes = ["id_document", "id_document_back", "selfie", "address_proof"];
    if (!validDocTypes.includes(doc_type)) {
      return c.json({ error: `doc_type inválido. Use: ${validDocTypes.join(", ")}` }, 400);
    }

    const validStatuses = ["approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return c.json({ error: `status inválido. Use: ${validStatuses.join(", ")}` }, 400);
    }

    // Update validation status
    await c.env.DB.prepare(
      `UPDATE receiver_doc_validations 
       SET status = ?, rejection_reason = ?, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND doc_type = ?`
    ).bind(status, rejection_reason || null, user_id, doc_type).run();

    // Check if all documents are now approved (id_document_back is optional)
    const { results: validations } = await c.env.DB.prepare(
      "SELECT * FROM receiver_doc_validations WHERE user_id = ?"
    ).bind(user_id).all();

    const requiredDocs = validations.filter((v: any) => ["id_document", "selfie", "address_proof"].includes(v.doc_type));
    const allApproved = requiredDocs.length === 3 && requiredDocs.every((v: any) => v.status === "approved");
    const hasRejections = validations.some((v: any) => v.status === "rejected");

    // When all documents are approved, clear review_notes so UI shows "Aguardando aprovação"
    if (allApproved) {
      await c.env.DB.prepare(
        "UPDATE receiver_docs SET review_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).bind(user_id).run();
    }

    // Status remains 'pending' - admin must approve the registration manually
    // Individual document validations are tracked in receiver_doc_validations table

    return c.json({ 
      success: true, 
      message: `Documento ${doc_type} atualizado para ${status}`,
      all_approved: allApproved,
      has_rejections: hasRejections
    });
  } catch (error) {
    console.error("[Webhook Validate] Error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// GET endpoint for approve/reject links (n8n can click these URLs)
receiver.get("/documents/webhook/validate", async (c) => {
  try {
    const user_id = c.req.query("user_id");
    const doc_type = c.req.query("doc_type");
    const status = c.req.query("status");
    const api_key = c.req.query("api_key");
    const rejection_reason = c.req.query("rejection_reason");

    console.log("[Webhook GET] Received:", { user_id, doc_type, status, api_key });

    // Simple API key validation
    if (api_key !== "toodrop_n8n_webhook_key_2024") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!user_id || !doc_type || !status) {
      return c.json({ error: "Dados inválidos - user_id, doc_type e status são obrigatórios" }, 400);
    }

    const validDocTypes = ["id_document", "id_document_back", "selfie", "address_proof"];
    if (!validDocTypes.includes(doc_type)) {
      return c.json({ error: `doc_type inválido. Use: ${validDocTypes.join(", ")}` }, 400);
    }

    const validStatuses = ["approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return c.json({ error: `status inválido. Use: ${validStatuses.join(", ")}` }, 400);
    }

    // Update validation status
    await c.env.DB.prepare(
      `UPDATE receiver_doc_validations 
       SET status = ?, rejection_reason = ?, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND doc_type = ?`
    ).bind(status, rejection_reason || null, user_id, doc_type).run();

    // Check if all documents are now approved (id_document_back is optional)
    const { results: validations } = await c.env.DB.prepare(
      "SELECT * FROM receiver_doc_validations WHERE user_id = ?"
    ).bind(user_id).all();

    const requiredDocs = validations.filter((v: any) => ["id_document", "selfie", "address_proof"].includes(v.doc_type));
    const allApproved = requiredDocs.length === 3 && requiredDocs.every((v: any) => v.status === "approved");

    // When all documents are approved, clear review_notes so UI shows "Aguardando aprovação"
    if (allApproved) {
      await c.env.DB.prepare(
        "UPDATE receiver_docs SET review_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).bind(user_id).run();
    }

    // Status remains 'pending' - admin must approve the registration manually
    // Individual document validations are tracked in receiver_doc_validations table

    // Return HTML page showing success
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Validação de Documento</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
          h1 { color: ${status === 'approved' ? '#16a34a' : '#dc2626'}; margin-bottom: 16px; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${status === 'approved' ? '✅ Documento Aprovado' : '❌ Documento Rejeitado'}</h1>
          <p>Documento: <strong>${doc_type.replace('_', ' ')}</strong></p>
          <p>User ID: <strong>${user_id}</strong></p>
          ${allApproved ? '<p style="color: #16a34a; font-weight: bold;">Todos os documentos foram aprovados!</p>' : ''}
        </div>
      </body>
      </html>
    `;

    return c.html(html);
  } catch (error) {
    console.error("[Webhook GET] Error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// Get document validation status
receiver.get("/documents/validation-status", unifiedAuthMiddleware, async (c) => {
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

  const { results: validations } = await c.env.DB.prepare(
    "SELECT * FROM receiver_doc_validations WHERE user_id = ? ORDER BY doc_type"
  ).bind(user.id).all();

  const docs = await c.env.DB.prepare(
    "SELECT status FROM receiver_docs WHERE user_id = ?"
  ).bind(user.id).first();

  // Check for required docs: id_document, selfie, address_proof (id_document_back is optional)
  const requiredDocs = ['id_document', 'selfie', 'address_proof'];
  const hasAllRequiredDocs = requiredDocs.every(docType => 
    validations.some((v: any) => v.doc_type === docType)
  );
  
  const allApproved = hasAllRequiredDocs && validations.every((v: any) => v.status === "approved");
  const allValidated = hasAllRequiredDocs && validations.every((v: any) => v.status !== "pending");

  return c.json({
    validations,
    overall_status: docs?.status || "pending",
    all_approved: allApproved,
    all_validated: allValidated
  });
});

// Get delivery preview for confirmation screen (before confirming receipt)
receiver.get("/delivery-preview/:droptagId", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const droptagId = c.req.param("droptagId");
  
  // Get droptag with driver info and consumer info
  const droptag = await c.env.DB.prepare(
    `SELECT d.id, d.title, d.tracking_code, d.secret_word, d.consumer_user_id, d.status,
            dd.driver_user_id, u.full_name as driver_name,
            consumer.full_name as consumer_name
     FROM droptags d
     LEFT JOIN driver_deliveries dd ON d.id = dd.droptag_id AND dd.status = 'in_transit'
     LEFT JOIN users u ON dd.driver_user_id = u.id
     LEFT JOIN users consumer ON d.consumer_user_id = consumer.id
     WHERE d.id = ?`
  ).bind(droptagId).first();

  if (!droptag) {
    return c.json({ error: "Pacote não encontrado" }, 404);
  }

  // Validate droptag status - must be 'created' to be scanned
  if (droptag.status !== 'created') {
    return c.json({ error: "QR Code está inválido" }, 400);
  }

  // Get receiver's commission info
  const user = await c.env.DB.prepare(
    `SELECT u.id, u.receiver_commission_percent, a.receiver_key
     FROM users u
     INNER JOIN addresses a ON u.id = a.user_id
     WHERE u.${userQuery.field} = ? AND a.address_type = 'receiver'`
  ).bind(userQuery.value).first() as { id: number; receiver_commission_percent: number; receiver_key: string } | null;

  if (!user) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Get service price from receiver point status
  const receiverPoint = await c.env.DB.prepare(
    "SELECT service_price FROM receiver_point_status WHERE receiver_key = ?"
  ).bind(user.receiver_key).first() as { service_price: number } | null;

  const servicePrice = receiverPoint?.service_price ?? 10.00;
  const commissionPercent = user.receiver_commission_percent ?? 60;
  const commissionAmount = servicePrice * commissionPercent / 100;

  return c.json({
    id: droptag.id,
    title: droptag.title,
    tracking_code: droptag.tracking_code,
    has_secret_word: !!droptag.secret_word,
    driver_name: droptag.driver_name || 'Entregador',
    consumer_name: droptag.consumer_name || 'Dropper One',
    commission_amount: commissionAmount,
  });
});

// Get incoming deliveries for receiver (driver has generated QR code for their point)
receiver.get("/incoming-deliveries", unifiedAuthMiddleware, async (c) => {
  const userQuery = getUserQuery(c);
  if (!userQuery) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id FROM users WHERE ${userQuery.field} = ?`
  ).bind(userQuery.value).first() as any;

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get receiver's addresses with receiver_key
  const { results: receiverAddresses } = await c.env.DB.prepare(
    "SELECT receiver_key FROM addresses WHERE user_id = ? AND receiver_key IS NOT NULL"
  ).bind(user.id).all();

  if (!receiverAddresses || receiverAddresses.length === 0) {
    return c.json({ deliveries: [] });
  }

  const receiverKeys = receiverAddresses.map((a: any) => a.receiver_key);
  const placeholders = receiverKeys.map(() => '?').join(',');

  // Find driver_deliveries where selected_receiver_key matches one of receiver's keys
  const { results: incomingDeliveries } = await c.env.DB.prepare(
    `SELECT dd.*, d.id as droptag_id, d.title, d.tracking_code, d.secret_word, 
            u.full_name as driver_name, u.phone as driver_phone
     FROM driver_deliveries dd
     INNER JOIN droptags d ON dd.droptag_id = d.id
     INNER JOIN users u ON dd.driver_user_id = u.id
     WHERE dd.selected_receiver_key IN (${placeholders})
       AND dd.status = 'in_transit'
       AND dd.sub_status IN ('qr_generated', 'awaiting_secret_word')
     ORDER BY dd.updated_at DESC`
  ).bind(...receiverKeys).all();

  const deliveries = incomingDeliveries.map((delivery: any) => ({
    id: delivery.id,
    droptag_id: delivery.droptag_id,
    title: delivery.title || delivery.tracking_code,
    tracking_code: delivery.tracking_code,
    driver_name: delivery.driver_name,
    driver_phone: delivery.driver_phone,
    secret_word: delivery.secret_word, // Only show if package has secret word
    sub_status: delivery.sub_status,
    updated_at: delivery.updated_at,
  }));

  return c.json({ deliveries });
});

export default receiver;
