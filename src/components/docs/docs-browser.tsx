"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  FileImage,
  FileText,
  File,
  FolderPlus,
  Lock,
  Search,
  Trash2,
  Upload
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createDocumentRecord,
  createFolder,
  deleteDocument,
  getDocumentUrl
} from "@/lib/docs/actions";
import { BottomSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Folder = { id: string; name: string };
export type DocItem = {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string | null;
  sensitive: boolean;
  uploadedBy: string;
  createdAt: string;
};

const MAX_BYTES = 20 * 1024 * 1024;

function DocIcon({ mime }: { mime: string | null }) {
  if (mime?.startsWith("image/")) return <FileImage size={24} strokeWidth={1.75} />;
  if (mime === "application/pdf") return <FileText size={24} strokeWidth={1.75} />;
  return <File size={24} strokeWidth={1.75} />;
}

export function DocsBrowser({
  circleId,
  folders,
  docs,
  canEdit
}: {
  circleId: string;
  folders: Folder[];
  docs: DocItem[];
  canEdit: boolean;
}) {
  const t = useTranslations("docs");
  const tc = useTranslations("auth");
  const locale = useLocale();
  const [folderId, setFolderId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // --- estado de subida ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upFolder, setUpFolder] = useState(folders[0]?.id ?? "");
  const [sensitive, setSensitive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(
      (d) =>
        (folderId === "all" || d.folderId === folderId) &&
        (q === "" || d.name.toLowerCase().includes(q))
    );
  }, [docs, folderId, search]);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Madrid"
    }).format(new Date(iso));

  async function doUpload() {
    if (!file || !upFolder) return;
    if (file.size > MAX_BYTES) return setMsg(t("tooBig"));
    setUploading(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-() ]+/g, "_").slice(-100);
      const path = `circles/${circleId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      const res = await createDocumentRecord({
        circleId,
        folderId: upFolder,
        name: file.name,
        storagePath: path,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sensitive
      });
      if (res.error) {
        await supabase.storage.from("documents").remove([path]);
        throw new Error(res.error);
      }
      setUploadOpen(false);
      setFile(null);
      setSensitive(false);
      setMsg(t("uploaded"));
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg(tc("errorGeneric"));
    } finally {
      setUploading(false);
    }
  }

  function openDoc(id: string) {
    start(async () => {
      const res = await getDocumentUrl(circleId, id);
      if (res.url) window.open(res.url, "_blank", "noopener");
      else setMsg(tc("errorGeneric"));
    });
  }

  function removeDoc(d: DocItem) {
    if (!confirm(t("confirmDelete", { name: d.name }))) return;
    start(async () => {
      const result = await deleteDocument(circleId, d.id);
      if (result.error) setMsg(tc("errorGeneric"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-[13.5px] text-ink-secondary">{t("trustShort")}</p>
      <div className="relative">
        <Search
          size={20}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-secondary"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPh")}
          className="pl-11"
          aria-label={t("searchPh")}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        <button
          role="tab"
          aria-selected={folderId === "all"}
          onClick={() => setFolderId("all")}
          className={cn(
            "min-h-touch shrink-0 rounded-full border px-4 text-[15px] font-semibold",
            folderId === "all"
              ? "border-primary bg-primary text-white"
              : "border-line bg-surface text-ink-secondary"
          )}
        >
          {t("allFolders")}
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={folderId === f.id}
            onClick={() => setFolderId(f.id)}
            className={cn(
              "min-h-touch shrink-0 rounded-full border px-4 text-[15px] font-semibold",
              folderId === f.id
                ? "border-primary bg-primary text-white"
                : "border-line bg-surface text-ink-secondary"
            )}
          >
            {f.name}
          </button>
        ))}
        {canEdit && (
          <button
            onClick={() => setFolderOpen(true)}
            aria-label={t("newFolder")}
            className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[15px] font-semibold text-primary"
          >
            <FolderPlus size={18} /> {t("newFolder")}
          </button>
        )}
      </div>

      <Card>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-[16px] text-ink-secondary">
            {docs.length === 0 ? t("emptyAll") : t("empty")}
          </p>
        ) : (
          <ul>
            {visible.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 border-b border-line py-3 last:border-0"
              >
                <button
                  onClick={() => openDoc(d.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-dark">
                    <DocIcon mime={d.mimeType} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[16px] font-medium text-ink">
                      <span className="truncate">{d.name}</span>
                      {d.sensitive && (
                        <Lock size={15} className="shrink-0 text-warning" />
                      )}
                    </span>
                    <span className="block text-[13.5px] text-ink-secondary">
                      {t("uploadedBy", {
                        name: d.uploadedBy,
                        date: fmtDate(d.createdAt)
                      })}
                    </span>
                  </span>
                </button>
                {canEdit && (
                  <button
                    onClick={() => removeDoc(d)}
                    disabled={pending}
                    aria-label={t("delete")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={19} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!canEdit && (
        <p className="text-center text-[14px] text-ink-secondary">
          {t("viewerNote")}
        </p>
      )}

      {msg && (
        <p
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-md bg-ink px-4 py-3 text-center text-[15px] text-white shadow-lg"
        >
          {msg}
        </p>
      )}

      {canEdit && (
        <button
          onClick={() => setUploadOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex min-h-cta items-center gap-2 rounded-full bg-primary px-5 text-[17px] font-semibold text-white shadow-lg hover:bg-primary-dark"
        >
          <Upload size={22} /> {t("upload")}
        </button>
      )}

      {/* Hoja de subida */}
      <BottomSheet
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        title={t("uploadTitle")}
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-primary-soft px-3.5 py-2.5 text-[14px] leading-snug text-primary-dark">
            {t("trustNote")}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={22} />
            <span className="truncate">{file ? file.name : t("chooseFile")}</span>
          </Button>

          <div>
            <Label htmlFor="up-folder">{t("folder")}</Label>
            <select
              id="up-folder"
              value={upFolder}
              onChange={(e) => setUpFolder(e.target.value)}
              className="min-h-touch w-full rounded-md border border-line bg-surface px-3 text-[17px] text-ink"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3.5">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-[16px] font-medium text-ink">
                {t("sensitive")}
              </span>
              <span className="block text-[14px] text-ink-secondary">
                {t("sensitiveHint")}
              </span>
            </span>
          </label>

          <Button size="lg" disabled={!file || uploading} onClick={doUpload}>
            {uploading ? t("uploading") : t("uploadBtn")}
          </Button>
        </div>
      </BottomSheet>

      {/* Hoja de nueva carpeta */}
      <BottomSheet
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        title={t("newFolder")}
      >
        <div className="flex flex-col gap-3">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t("newFolderPh")}
            maxLength={60}
            autoFocus
          />
          <Button
            size="lg"
            disabled={pending || newFolderName.trim().length === 0}
            onClick={() =>
              start(async () => {
                const res = await createFolder(circleId, newFolderName);
                if (!res.error) {
                  setNewFolderName("");
                  setFolderOpen(false);
                }
              })
            }
          >
            {t("create")}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
