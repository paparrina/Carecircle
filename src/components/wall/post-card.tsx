"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send, Trash2 } from "lucide-react";
import { createComment, deleteComment, deletePost } from "@/lib/wall/actions";
import { Card } from "@/components/ui/card";
import { useRelative } from "./relative-time";
import { cn } from "@/lib/utils";

export type WallComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type WallPost = {
  id: string;
  authorId: string;
  authorName: string;
  body: string | null;
  createdAt: string;
  images: { url: string; name: string }[];
  mentionNames: string[];
  comments: WallComment[];
};

function renderBody(body: string, mentionNames: string[]) {
  if (mentionNames.length === 0) return body;
  const re = new RegExp(
    `@(${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  );
  const parts = body.split(re);
  return parts.map((p, i) =>
    mentionNames.includes(p) ? (
      <span key={i} className="font-semibold text-primary-dark">
        @{p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function PostCard({
  circleId,
  post,
  meId,
  canComment,
  isCoordinator
}: {
  circleId: string;
  post: WallPost;
  meId: string;
  canComment: boolean;
  isCoordinator: boolean;
}) {
  const t = useTranslations("wall");
  const rel = useRelative();
  const [open, setOpen] = useState(post.comments.length === 0);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  const canDeletePost = post.authorId === meId || isCoordinator;

  function send() {
    const body = comment.trim();
    if (!body) return;
    start(async () => {
      const res = await createComment({ circleId, postId: post.id, body });
      if (!res.error) setComment("");
    });
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
          {post.authorName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] text-ink">
            <span className="font-semibold">{post.authorName}</span>{" "}
            <span className="text-[14px] text-ink-secondary">
              · {rel(post.createdAt)}
            </span>
          </p>
          {post.body && (
            <p className="mt-1 whitespace-pre-wrap text-lg leading-relaxed text-ink">
              {renderBody(post.body, post.mentionNames)}
            </p>
          )}
        </div>
        {canDeletePost && (
          <button
            onClick={() => {
              if (confirm(t("confirmDeletePost")))
                start(() => deletePost(circleId, post.id).then(() => {}));
            }}
            disabled={pending}
            aria-label={t("deletePost")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {post.images.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-2",
            post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {post.images.map((img, i) => (
            <a key={i} href={img.url} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="max-h-80 w-full rounded-md object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-line pt-2.5">
        {!open && post.comments.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="min-h-touch text-[15px] font-semibold text-primary underline underline-offset-2"
          >
            {post.comments.length === 1
              ? t("oneComment")
              : t("comments", { n: post.comments.length })}
          </button>
        )}
        {open && post.comments.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {post.comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-bold text-primary-dark">
                  {c.authorName.charAt(0)}
                </span>
                <p className="min-w-0 flex-1 text-[15.5px] leading-snug text-ink">
                  <span className="font-semibold">{c.authorName}</span>{" "}
                  {c.body}
                  <span className="ml-1 text-[13px] text-ink-secondary">
                    {rel(c.createdAt)}
                  </span>
                </p>
                {(c.authorId === meId || isCoordinator) && (
                  <button
                    onClick={() =>
                      start(() => deleteComment(circleId, c.id))
                    }
                    disabled={pending}
                    aria-label={t("deleteComment")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canComment && (
          <div className="mt-2.5 flex items-center gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("commentPh")}
              className="min-h-touch flex-1 rounded-full border border-line bg-background px-4 text-[15.5px] text-ink placeholder:text-ink-secondary/60 focus:border-primary focus:outline-none"
            />
            <button
              onClick={send}
              disabled={pending || comment.trim() === ""}
              aria-label={t("send")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
            >
              <Send size={19} />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
