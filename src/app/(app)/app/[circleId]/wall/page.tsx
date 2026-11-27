import { getTranslations } from "next-intl/server";
import { FileText, MapPin, MessagesSquare, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMembers } from "@/lib/circle/queries";
import { Composer } from "@/components/wall/composer";
import { PostCard, type WallPost } from "@/components/wall/post-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

type FeedItem =
  | { kind: "post"; at: string; post: WallPost }
  | { kind: "sys"; at: string; icon: "doc" | "join" | "pin"; text: string };

const SYS_ICON = { doc: FileText, join: UserPlus, pin: MapPin };

export default async function WallPage({
  params
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const t = await getTranslations("wall");
  const tPlaces = await getTranslations("places");
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [
    { data: posts },
    { data: recipient },
    members,
    { data: docs },
    { data: joins },
    { data: checkins }
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, author_id, body, attachments, mentions, created_at, author:author_id(full_name), post_comments(id, author_id, body, created_at, cauthor:author_id(full_name))"
      )
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("care_recipients")
      .select("full_name")
      .eq("circle_id", circleId)
      .limit(1)
      .maybeSingle(),
    getMembers(circleId),
    supabase
      .from("documents")
      .select("name, created_at, by:uploaded_by(full_name)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("circle_members")
      .select("joined_at, profiles:user_id(full_name)")
      .eq("circle_id", circleId)
      .order("joined_at", { ascending: false })
      .limit(15),
    supabase
      .from("location_checkins")
      .select("place, place_label, created_at, by:checked_by(full_name)")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(15)
  ]);

  const myRole = members.find((m) => m.id === user?.id)?.role;
  const canPost = myRole === "coordinator" || myRole === "member";
  const nameById = new Map(members.map((m) => [m.id, m.name.split(" ")[0]]));

  // URLs firmadas para las imágenes de los posts
  const allPaths = (posts ?? []).flatMap((p) =>
    ((p.attachments ?? []) as { storage_path: string; mime_type: string }[])
      .filter((a) => a.mime_type?.startsWith("image/"))
      .map((a) => a.storage_path)
  );
  const urlByPath = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrls(allPaths, 600);
    for (const s of signed ?? [])
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  }

  const one = <T,>(x: T | T[] | null) => (Array.isArray(x) ? x[0] : x);
  const first = (n?: string | null) => n?.split(" ")[0] ?? "";

  const items: FeedItem[] = [];

  for (const p of posts ?? []) {
    const atts = (p.attachments ?? []) as {
      storage_path: string;
      mime_type: string;
      name: string;
    }[];
    items.push({
      kind: "post",
      at: p.created_at,
      post: {
        id: p.id,
        authorId: p.author_id,
        authorName: first(one(p.author)?.full_name),
        body: p.body,
        createdAt: p.created_at,
        images: atts
          .filter((a) => urlByPath.has(a.storage_path))
          .map((a) => ({ url: urlByPath.get(a.storage_path)!, name: a.name })),
        mentionNames: ((p.mentions ?? []) as string[])
          .map((id) => nameById.get(id))
          .filter((x): x is string => !!x),
        comments: (p.post_comments ?? [])
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((c) => ({
            id: c.id,
            authorId: c.author_id,
            authorName: first(one(c.cauthor)?.full_name),
            body: c.body,
            createdAt: c.created_at
          }))
      }
    });
  }

  for (const d of docs ?? [])
    items.push({
      kind: "sys",
      at: d.created_at,
      icon: "doc",
      text: t("sys.docUploaded", {
        name: first(one(d.by)?.full_name),
        doc: d.name
      })
    });

  for (const j of joins ?? [])
    items.push({
      kind: "sys",
      at: j.joined_at,
      icon: "join",
      text: t("sys.memberJoined", { name: first(one(j.profiles)?.full_name) })
    });

  for (const c of checkins ?? [])
    items.push({
      kind: "sys",
      at: c.created_at,
      icon: "pin",
      text: t("sys.checkin", {
        name: first(one(c.by)?.full_name),
        place:
          c.place === "other"
            ? (c.place_label ?? "")
            : tPlaces(c.place as "home")
      })
    });

  items.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
      {canPost && (
        <Composer
          circleId={circleId}
          recipientFirstName={recipient?.full_name?.split(" ")[0] ?? ""}
          members={members.filter((m) => m.id !== user?.id)}
        />
      )}
      {!canPost && (
        <p className="text-center text-[14px] text-ink-secondary">
          {t("viewerNote")}
        </p>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={MessagesSquare} text={t("empty")} />
          <p className="-mt-2 pb-2 text-center text-[15px] text-ink-secondary">
            {t("emptyHint")}
          </p>
        </Card>
      ) : (
        items.map((item, i) =>
          item.kind === "post" ? (
            <PostCard
              key={`p-${item.post.id}`}
              circleId={circleId}
              post={item.post}
              meId={user?.id ?? ""}
              canComment={canPost}
              isCoordinator={myRole === "coordinator"}
            />
          ) : (
            <div
              key={`s-${i}`}
              className="flex items-center gap-2.5 px-2 text-[14.5px] text-ink-secondary"
            >
              {(() => {
                const Icon = SYS_ICON[item.icon];
                return <Icon size={17} className="shrink-0 text-primary/70" />;
              })()}
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
            </div>
          )
        )
      )}
    </div>
  );
}
