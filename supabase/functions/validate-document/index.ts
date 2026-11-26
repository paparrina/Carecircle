import { createClient } from "npm:@supabase/supabase-js@2";
import { matchesDocumentContent } from "./formats.ts";

const MAX_BYTES = 20 * 1024 * 1024;
const PATH = /^circles\/[0-9a-f-]{36}\/[a-zA-Z0-9_.() -]+$/;

Deno.serve(async (req) => {
  const authorization = req.headers.get("authorization");
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!authorization?.startsWith("Bearer ")) return new Response(null, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(authorization.slice(7));
  if (authError || !user) return new Response(null, { status: 401 });

  const input: unknown = await req.json().catch(() => null);
  const path = input && typeof input === "object" && "path" in input ? input.path : null;
  if (typeof path !== "string" || path.length > 400 || !PATH.test(path)) {
    return new Response(null, { status: 400 });
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: upload, error: inspectError } = await admin.rpc("inspect_document_upload", {
    p_path: path, p_user: user.id
  }).maybeSingle<{ object_id: string; object_version: string; mime_type: string; size_bytes: number }>();
  if (inspectError) return new Response(null, { status: 500 });
  if (!upload) return new Response(null, { status: 404 });
  if (upload.size_bytes < 1 || upload.size_bytes > MAX_BYTES) {
    return Response.json({ valid: false });
  }

  const { data: file, error: readError } = await userClient.storage.from("documents").download(path);
  if (readError || !file) return new Response(null, { status: 409 });

  const valid = file.size === upload.size_bytes &&
    await matchesDocumentContent(new Uint8Array(await file.arrayBuffer()), upload.mime_type);
  if (!valid) return Response.json({ valid: false });

  const { data: confirmed, error: confirmError } = await admin.rpc("confirm_document_content_validation", {
    p_path: path, p_user: user.id, p_object_id: upload.object_id, p_object_version: upload.object_version
  });
  if (confirmError) return new Response(null, { status: 500 });
  if (!confirmed) return new Response(null, { status: 409 });
  return Response.json({ valid: true });
});
