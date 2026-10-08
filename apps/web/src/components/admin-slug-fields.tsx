"use client";

import { useState } from "react";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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
  slugMaxLength = 180,
  sourceDefaultValue = "",
  slugDefaultValue = "",
  pathPrefix = "",
}: {
  sourceLabel: string;
  sourceName: string;
  sourcePlaceholder?: string;
  slugName?: string;
  slugPlaceholder?: string;
  sourceMaxLength?: number;
  slugMaxLength?: number;
  sourceDefaultValue?: string;
  slugDefaultValue?: string;
  pathPrefix?: string;
}) {
  const [source, setSource] = useState(sourceDefaultValue);
  const [slug, setSlug] = useState(slugDefaultValue);
  const sourceId = `admin-${sourceName}`;
  const slugId = `admin-${slugName}`;
  const [slugTouched, setSlugTouched] = useState(Boolean(slugDefaultValue));

  function updateSource(value: string) {
    setSource(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function regenerateSlug() {
    setSlug(slugify(source));
    setSlugTouched(false);
  }

  return (
    <>
      <label className="admin-field" htmlFor={sourceId}>
        <span className="admin-field__label">
          {sourceLabel}
          <b aria-hidden="true">*</b>
        </span>
        <input
          id={sourceId}
          name={sourceName}
          value={source}
          onChange={(event) => updateSource(event.target.value)}
          required
          minLength={2}
          maxLength={sourceMaxLength}
          placeholder={sourcePlaceholder}
        />
        <span className="admin-field__footer">
          <small className="admin-field__hint">
            Used as the primary public/editor title.
          </small>
          <small
            className={
              source.length >= sourceMaxLength
                ? "admin-field__count admin-field__count--limit"
                : "admin-field__count"
            }
          >
            {source.length}/{sourceMaxLength}
          </small>
        </span>
      </label>

      <label className="admin-field" htmlFor={slugId}>
        <span className="admin-field__label">
          Slug
          <b aria-hidden="true">*</b>
        </span>
        <input
          id={slugId}
          name={slugName}
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
          required
          maxLength={slugMaxLength}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder={slugPlaceholder}
        />
        <span className="admin-field__footer">
          <small className="admin-field__hint">
            {slug ? (
              <>
                Public path:{" "}
                <code>
                  {`${pathPrefix}/${slug}`.replace(/\/+/g, "/")}
                </code>
              </>
            ) : (
              `Auto-generated from ${sourceLabel.toLowerCase()}.`
            )}
          </small>
          <small
            className={
              slug.length >= slugMaxLength
                ? "admin-field__count admin-field__count--limit"
                : "admin-field__count"
            }
          >
            {slug.length}/{slugMaxLength}
          </small>
        </span>

        {slugTouched ? (
          <button
            className="admin-field__link-button"
            type="button"
            onClick={regenerateSlug}
          >
            Regenerate from {sourceLabel.toLowerCase()}
          </button>
        ) : null}
      </label>
    </>
  );
}
