"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatIstDate } from "@/lib/admin/datetime";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { AdminFileUploadField } from "@/components/admin-file-upload-field";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { AdminTextInputField } from "@/components/admin-text-input-field";

type MediaItem = {
  id: string;
  objectKey: string;
  publicUrl: string | null;
  mimeType: string;
  byteSize: string | null;
  altText: string | null;
  caption: string | null;
  createdAt: string;
  referenceCount: number;
};

function humanBytes(value: string | null): string {
  if (!value) return "Unknown size";
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminMediaManager({
  media,
  canWrite,
}: {
  media: MediaItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "IMAGES" | "PDFS" | "REFERENCED" | "ORPHANED" | "MISSING_ALT"
  >("ALL");

  const filteredMedia = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return media.filter((asset) => {
      const matchesSearch =
        !needle ||
        [asset.objectKey, asset.altText ?? "", asset.caption ?? "", asset.mimeType]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      if (!matchesSearch) return false;
      if (filter === "IMAGES") return asset.mimeType.startsWith("image/");
      if (filter === "PDFS") return asset.mimeType === "application/pdf";
      if (filter === "REFERENCED") return asset.referenceCount > 0;
      if (filter === "ORPHANED") return asset.referenceCount === 0;
      if (filter === "MISSING_ALT") {
        return asset.mimeType.startsWith("image/") && !asset.altText;
      }

      return true;
    });
  }, [media, query, filter]);

  async function upload(formData: FormData) {
    setUploading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(result.error?.message ?? "Media upload failed.");
      }

      setMessage("Media uploaded successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function updateMetadata(item: MediaItem, formData: FormData) {
    setBusyId(item.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/media/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altText: String(formData.get("altText") ?? ""),
          caption: String(formData.get("caption") ?? ""),
        }),
      });
      const result = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(result.error?.message ?? "Media metadata update failed.");
      }

      setMessage("Media metadata updated.");
      setEditingId(null);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Media metadata update failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(`Delete ${item.objectKey.split("/").pop() ?? "this media file"}?`)) {
      return;
    }

    setBusyId(item.id);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/media/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as {
        storageDeleted?: boolean;
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(result.error?.message ?? "Media deletion failed.");
      }

      setMessage(
        result.storageDeleted === false
          ? "Media record deleted. Storage cleanup requires attention."
          : "Media deleted successfully.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media deletion failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {canWrite ? (
        <section className="admin-panel admin-card-body">
          <h2>Upload Media</h2>
          <form action={upload}>
            <AdminFormGrid columns={2}>
              <AdminFileUploadField
                id="mediaFile"
                name="file"
                label="File"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                maxBytes={10 * 1024 * 1024}
                required
                hint="JPEG, PNG, WebP, GIF or PDF. Maximum 10 MB."
              />

              <AdminTextInputField
                id="mediaAltText"
                name="altText"
                label="Alt text"
                maxLength={300}
                placeholder="Describe the asset for accessibility"
                hint="Required for meaningful public images whenever possible."
              />

              <AdminTextareaField
                id="mediaCaption"
                name="caption"
                label="Caption"
                maxLength={500}
                rows={4}
                placeholder="Optional caption"
                hint="Optional public/internal caption."
              />
            </AdminFormGrid>

            <button
              className="admin-primary-button"
              type="submit"
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload File"}
            </button>
          </form>
          <p>Accepted: JPEG, PNG, WebP, GIF and PDF. Maximum 10 MB.</p>
        </section>
      ) : null}

      {message ? <p className="admin-notice">{message}</p> : null}

      <section className="admin-panel">
        <div className="admin-media-toolbar">
          <AdminFormGrid columns={2}>
            <AdminField label="Search media" htmlFor="mediaSearch">
              <input
                id="mediaSearch"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filename, alt text, caption or MIME type"
              />
            </AdminField>

            <AdminField label="Filter" htmlFor="mediaFilter">
              <select
                id="mediaFilter"
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value as
                      | "ALL"
                      | "IMAGES"
                      | "PDFS"
                      | "REFERENCED"
                      | "ORPHANED"
                      | "MISSING_ALT",
                  )
                }
              >
                <option value="ALL">All assets</option>
                <option value="IMAGES">Images</option>
                <option value="PDFS">PDFs</option>
                <option value="REFERENCED">Referenced</option>
                <option value="ORPHANED">Orphaned / unused</option>
                <option value="MISSING_ALT">Images missing alt text</option>
              </select>
            </AdminField>
          </AdminFormGrid>

          <span className="admin-media-toolbar__count">
            {filteredMedia.length} of {media.length} assets
          </span>
        </div>

        {media.length === 0 ? (
          <div className="admin-card-body">
            <p>No media assets have been uploaded yet.</p>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="admin-card-body">
            <p>No media assets match the current search/filter.</p>
          </div>
        ) : (
          <div className="admin-media-grid">
            {filteredMedia.map((asset) => (
              <article className="admin-media-card" key={asset.id}>
                {asset.mimeType.startsWith("image/") && asset.publicUrl ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.altText ?? asset.caption ?? asset.objectKey}
                    loading="lazy"
                  />
                ) : (
                  <div className="admin-media-thumb"/>
                )}
                <strong>{asset.objectKey.split("/").pop() ?? asset.objectKey}</strong>
                <small>{humanBytes(asset.byteSize)} · {asset.mimeType}</small>
                <span>{asset.altText ?? asset.caption ?? "No alt text"}</span>
                <small>{formatIstDate(new Date(asset.createdAt))}</small>
                <small>
                  {asset.referenceCount > 0
                    ? `${asset.referenceCount} active reference${asset.referenceCount === 1 ? "" : "s"}`
                    : "Orphaned / unused"}
                </small>
                {canWrite && editingId === asset.id ? (
                  <form action={(formData) => updateMetadata(asset, formData)}>
                    <AdminFormGrid columns={1}>
                      <AdminTextInputField
                        id={`alt-${asset.id}`}
                        name="altText"
                        label="Alt text"
                        defaultValue={asset.altText ?? ""}
                        maxLength={300}
                        hint="Describe meaningful visual content for accessibility."
                      />

                      <AdminTextareaField
                        id={`caption-${asset.id}`}
                        name="caption"
                        label="Caption"
                        defaultValue={asset.caption ?? ""}
                        maxLength={500}
                        rows={4}
                        hint="Optional public/internal caption."
                      />
                    </AdminFormGrid>

                    <button
                      className="admin-primary-button"
                      type="submit"
                      disabled={busyId === asset.id}
                    >
                      Save Metadata
                    </button>
                    <button
                      className="admin-secondary-button"
                      type="button"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : null}
                {canWrite ? (
                  <>
                    <button
                      className="admin-secondary-button"
                      type="button"
                      onClick={() => setEditingId(asset.id)}
                    >
                      Edit Metadata
                    </button>
                    <button
                    className="admin-danger-button"
                    type="button"
                    onClick={() => remove(asset)}
                    disabled={busyId === asset.id}
                  >
                    {busyId === asset.id ? "Deleting…" : "Delete"}
                  </button>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
