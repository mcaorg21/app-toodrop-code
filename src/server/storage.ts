import { Storage } from "@google-cloud/storage";

export function createStorageService() {
  const bucketName = process.env.GCS_BUCKET_NAME || "toodrop-assets";

  let storage: Storage;
  try {
    const keyJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
    if (keyJson && keyJson.trim()) {
      let parsed: object;
      if (keyJson.trim().startsWith("{")) {
        parsed = JSON.parse(keyJson);
      } else {
        parsed = JSON.parse(Buffer.from(keyJson.trim(), "base64").toString("utf-8"));
      }
      storage = new Storage({ credentials: parsed });
    } else {
      // Application Default Credentials (local dev)
      storage = new Storage();
    }
  } catch {
    console.warn("[Storage] GCS credentials not configured — storage calls will fail");
    storage = new Storage();
  }

  const bucket = storage.bucket(bucketName);

  return {
    async put(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void> {
      const file = bucket.file(key);
      await file.save(body, { contentType });
    },

    async get(key: string): Promise<Buffer | null> {
      try {
        const file = bucket.file(key);
        const [contents] = await file.download();
        return contents;
      } catch {
        return null;
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await bucket.file(key).delete();
      } catch {
        // ignore if not found
      }
    },

    getPublicUrl(key: string): string {
      return `https://storage.googleapis.com/${bucketName}/${key}`;
    },

    // R2-compatible interface used by existing routes
    async fetch(url: string): Promise<Response> {
      // Support for old R2 URL pattern — extract key and serve via GCS
      const key = url.replace(/^.*\//, "");
      const data = await this.get(key);
      if (!data) return new Response(null, { status: 404 });
      return new Response(data);
    },
  };
}

export type StorageService = ReturnType<typeof createStorageService>;
