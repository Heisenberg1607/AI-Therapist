import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_REPORTS_BUCKET || "reports";

// Lazily build the client so the server still boots when storage isn't
// configured — we only throw when a report actually needs to be stored.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to store report files.",
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      // Node < 22 has no native WebSocket; required for @supabase/supabase-js on the server.
      realtime: { transport: ws as unknown as typeof WebSocket },
    });
  }
  return client;
}

// Upload a report file to the private `reports` bucket at the given path.
export async function uploadReportFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await getClient()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
}

// Mint a short-lived signed download URL for a private report file.
export async function signedReportUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await getClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
