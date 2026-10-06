"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MediaItem = {
  id: string;
  objectKey: string;
  publicUrl: string | null;
  mimeType: string;
  byteSize: string | null;
  altText: string | null;
  caption: string | null;
  createdAt: string;
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
            <label>
              File
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                required
              />
            </label>
            <label>
              Alt text
              <input name="altText" maxLength={300} placeholder="Describe the asset for accessibility"/>
            </label>
            <label>
              Caption
              <textarea name="caption" maxLength={500} placeholder="Optional internal/public caption"/>
            </label>
            <button className="admin-primary-button" type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload File"}
            </button>
          </form>
          <p>Accepted: JPEG, PNG, WebP, GIF and PDF. Maximum 10 MB.</p>
        </section>
      ) : null}

      {message ? <p className="admin-notice">{message}</p> : null}

      <section className="admin-panel">
        {media.length === 0 ? (
          <div className="admin-card-body">
            <p>No media assets have been uploaded yet.</p>
          </div>
        ) : (
          <div className="admin-media-grid">
            {media.map((asset) => (
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
                <small>{new Date(asset.createdAt).toLocaleDateString("en-IN")}</small>
                {canWrite ? (
                  <button
                    className="admin-danger-button"
                    type="button"
                    onClick={() => remove(asset)}
                    disabled={busyId === asset.id}
                  >
                    {busyId === asset.id ? "Deleting…" : "Delete"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
