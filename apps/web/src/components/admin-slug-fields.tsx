"use client";

import { useState } from "react";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function AdminSlugFields({
  sourceLabel,
  sourceName,
  sourcePlaceholder,
  slugName = "slug",
  slugPlaceholder,
  sourceMaxLength = 180,
  sourceDefaultValue = "",
  slugDefaultValue = "",
}: {
  sourceLabel: string;
  sourceName: string;
  sourcePlaceholder?: string;
  slugName?: string;
  slugPlaceholder?: string;
  sourceMaxLength?: number;
  sourceDefaultValue?: string;
  slugDefaultValue?: string;
}) {
  const [source, setSource] = useState(sourceDefaultValue);
  const [slug, setSlug] = useState(slugDefaultValue);
  const [slugTouched, setSlugTouched] = useState(Boolean(slugDefaultValue));

  function updateSource(value: string) {
    setSource(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <>
      <label className="admin-field">
        <span className="admin-field__label">
          {sourceLabel}
          <b aria-hidden="true">*</b>
        </span>
        <input
          name={sourceName}
          value={source}
          onChange={(event) => updateSource(event.target.value)}
          required
          minLength={2}
          maxLength={sourceMaxLength}
          placeholder={sourcePlaceholder}
        />
      </label>

      <label className="admin-field">
        <span className="admin-field__label">
          Slug
          <b aria-hidden="true">*</b>
        </span>
        <input
          name={slugName}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder={slugPlaceholder}
        />
        <small className="admin-field__hint">
          Auto-generated from {sourceLabel.toLowerCase()}; edit if needed.
        </small>
      </label>
    </>
  );
}
