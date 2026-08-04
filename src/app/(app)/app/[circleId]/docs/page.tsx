import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/circle/queries";
import { DocsBrowser } from "@/components/docs/docs-browser";

export default async function DocsPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("docs");
  const supabase = await createClient();

  const [{ data: folders }, { data: docs }, role] = await Promise.all([
    supabase
      .from("document_folders")
      .select("id, name")
      .eq("circle_id", circleId)
      .order("name"),
    supabase
      .from("documents")
      .select(
        "id, folder_id, name, mime_type, sensitive, created_at, by:uploaded_by(full_name)"
      )
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false }),
    getMyRole(circleId)
  ]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-ink">{t("title")}</h1>
      <DocsBrowser
        circleId={circleId}
        canEdit={role === "coordinator" || role === "member"}
        folders={folders ?? []}
        docs={(docs ?? []).map((d) => {
          const by = Array.isArray(d.by) ? d.by[0] : d.by;
          return {
            id: d.id as string,
            folderId: d.folder_id as string | null,
            name: d.name as string,
            mimeType: d.mime_type as string | null,
            sensitive: !!d.sensitive,
            uploadedBy: by?.full_name?.split(" ")[0] ?? "",
            createdAt: d.created_at as string
          };
        })}
      />
    </div>
  );
}
