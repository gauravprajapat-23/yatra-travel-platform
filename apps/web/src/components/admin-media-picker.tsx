"use client";

import { useState } from "react";

export type AdminMediaPickerOption = {
  id: string;
  publicUrl: string | null;
  label: string;
  altText?: string | null;
};

export function AdminMediaPicker({
  name,
  options,
  defaultValue = "",
  allowNone = true,
}: {
  name: string;
  options: AdminMediaPickerOption[];
  defaultValue?: string;
  allowNone?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <div className="admin-media-picker" role="group" aria-label="Media choices">
      <input type="hidden" name={name} value={selected} />

      {allowNone ? (
        <button
          className={
            selected === ""
              ? "admin-media-picker__item admin-media-picker__item--selected"
              : "admin-media-picker__item"
          }
          type="button"
          aria-pressed={selected === ""}
          onClick={() => setSelected("")}
        >
          <span className="admin-media-picker__empty">No image</span>
          <strong>None</strong>
          <small>Remove the current hero image</small>
        </button>
      ) : null}

      {options.map((option) => (
        <button
          key={option.id}
          className={
            selected === option.id
              ? "admin-media-picker__item admin-media-picker__item--selected"
              : "admin-media-picker__item"
          }
          type="button"
          aria-pressed={selected === option.id}
          onClick={() => setSelected(option.id)}
        >
          {option.publicUrl ? (
            <img
              src={option.publicUrl}
              alt={option.altText ?? option.label}
              loading="lazy"
            />
          ) : (
            <span className="admin-media-picker__empty">Image</span>
          )}
          <strong>{option.label}</strong>
          <small>{option.altText || "No alt text"}</small>
        </button>
      ))}
    </div>
  );
}
