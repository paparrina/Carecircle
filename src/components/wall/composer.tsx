"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AtSign, ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/lib/wall/actions";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import type { CircleMember } from "@/lib/circle/queries";

type Att = { file: File; preview: string };

export function Composer({
  circleId,
  recipientFirstName,
  members
}: {
  circleId: string;
  recipientFirstName: string;
  members: CircleMember[];
}) {
  const t = useTranslations("wall");
  const tc = useTranslations("auth");
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...atts];
    for (const f of Array.from(files)) {
      if (next.length >= 4) break;
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 10 * 1024 * 1024) continue;
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setAtts(next);
  }

  function addMention(m: CircleMember) {
    if (!mentions.includes(m.id)) setMentions((xs) => [...xs, m.id]);
    const tag = `@${m.name.split(" ")[0]} `;
    if (!body.includes(tag.trim())) setBody((b) => (b ? `${b} ${tag}` : tag));
    setMentionOpen(false);
  }

  async function publish() {
    if (busy || (body.trim() === "" && atts.length === 0)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const uploaded = [];
      for (const a of atts) {
        const safe = a.file.name.replace(/[^\w.\-() ]+/g, "_").slice(-80);
        const path = `circles/${circleId}/wall/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, a.file, { contentType: a.file.type });
        if (upErr) throw upErr;
        uploaded.push({
          storage_path: path,
          mime_type: a.file.type,
          name: a.file.name
        });
      }
      const res = await createPost({
        circleId,
        body: body.trim(),
        mentions,
        attachments: uploaded
      });
      if (res.error) throw new Error(res.error);
      setBody("");
      setAtts([]);
      setMentions([]);
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("composerPh", { name: recipientFirstName })}
        rows={2}
        className="w-full resize-none border-0 bg-transparent text-lg text-ink placeholder:text-ink-secondary/60 focus:outline-none"
      />
      {atts.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {atts.map((a, i) => (
            <span key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.preview}
                alt=""
                className="h-20 w-20 rounded-md object-cover"
              />
              <button
                onClick={() => setAtts((xs) => xs.filter((_, j) => j !== i))}
                aria-label="X"
                className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white"
              >
                <X size={15} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 border-t border-line pt-2.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex min-h-touch items-center gap-1.5 rounded-md px-3 text-[15px] font-semibold text-primary hover:bg-primary-soft"
        >
          <ImagePlus size={20} /> {t("attachPhoto")}
        </button>
        <button
          onClick={() => setMentionOpen(true)}
          className="flex min-h-touch items-center gap-1.5 rounded-md px-3 text-[15px] font-semibold text-primary hover:bg-primary-soft"
        >
          <AtSign size={19} /> {t("mention")}
        </button>
        <Button
          className="ml-auto w-auto px-5"
          disabled={busy || (body.trim() === "" && atts.length === 0)}
          onClick={publish}
        >
          {busy ? t("publishing") : t("publish")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[15px] font-medium text-danger">
          {error}
        </p>
      )}

      <BottomSheet
        open={mentionOpen}
        onClose={() => setMentionOpen(false)}
        title={t("mention")}
      >
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => addMention(m)}
                className="flex min-h-cta w-full items-center gap-3 rounded-md border border-line px-4 text-left hover:bg-primary-soft"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                  {m.name.charAt(0)}
                </span>
                <span className="text-[17px] font-medium text-ink">
                  {m.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </Card>
  );
}
