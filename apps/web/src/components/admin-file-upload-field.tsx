"use client";

import { useEffect, useRef, useState } from "react";

function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminFileUploadField({
  name = "file",
  id = "admin-file-upload",
  label = "File",
  accept,
  maxBytes,
  required = false,
  hint,
}: {
  name?: string;
  id?: string;
  label?: string;
  accept: string;
  maxBytes: number;
  required?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function acceptedTypes(): string[] {
    return accept
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function validate(next: File): string {
    const accepted = acceptedTypes();
    const typeAllowed =
      accepted.length === 0 ||
      accepted.includes(next.type) ||
      accepted.some(
        (rule) =>
          rule.endsWith("/*") &&
          next.type.startsWith(rule.slice(0, -1)),
      );

    if (!typeAllowed) {
      return "This file type is not allowed.";
    }

    if (next.size > maxBytes) {
      return `File exceeds the ${humanBytes(maxBytes)} limit.`;
    }

    return "";
  }

  function applyFile(next: File | null) {
    setError("");

    if (!next) {
      setFile(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const validation = validate(next);
    if (validation) {
      setError(validation);
      setFile(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.setCustomValidity(validation);
      }
      return;
    }

    setFile(next);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return next.type.startsWith("image/")
        ? URL.createObjectURL(next)
        : null;
    });
    if (inputRef.current) inputRef.current.setCustomValidity("");
  }

  return (
    <div className="admin-field admin-field--wide">
      <span className="admin-field__label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>

      <label
        className={
          dragging
            ? "admin-file-upload admin-file-upload--dragging"
            : error
              ? "admin-file-upload admin-file-upload--error"
              : "admin-file-upload"
        }
        htmlFor={id}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const next = event.dataTransfer.files?.[0] ?? null;

          if (next && inputRef.current) {
            const transfer = new DataTransfer();
            transfer.items.add(next);
            inputRef.current.files = transfer.files;
          }

          applyFile(next);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          name={name}
          accept={accept}
          required={required}
          onChange={(event) =>
            applyFile(event.currentTarget.files?.[0] ?? null)
          }
        />

        {previewUrl ? (
          <img
            className="admin-file-upload__preview"
            src={previewUrl}
            alt=""
          />
        ) : (
          <span className="admin-file-upload__icon" aria-hidden="true">
            ↑
          </span>
        )}

        <span className="admin-file-upload__copy">
          <strong>
            {file ? file.name : "Drop a file here or click to browse"}
          </strong>
          <small>
            {file
              ? `${humanBytes(file.size)} · ${file.type || "unknown type"}`
              : hint ?? `Maximum ${humanBytes(maxBytes)}`}
          </small>
        </span>
      </label>

      {error ? (
        <small className="admin-field__error" role="alert">
          {error}
        </small>
      ) : hint && file ? (
        <small className="admin-field__hint">{hint}</small>
      ) : null}
    </div>
  );
}
