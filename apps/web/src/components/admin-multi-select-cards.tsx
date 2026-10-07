"use client";

import { useState } from "react";

export type AdminMultiSelectOption = {
  id: string;
  label: string;
  meta?: string;
};

export function AdminMultiSelectCards({
  name,
  options,
  defaultValues = [],
}: {
  name: string;
  options: AdminMultiSelectOption[];
  defaultValues?: string[];
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(defaultValues);
  const needle = query.trim().toLowerCase();

  const visible = options.filter((option) =>
    !needle
      ? true
      : [option.label, option.meta ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle),
  );

  return (
    <div className="admin-multi-select">
      <label className="admin-field">
        <span className="admin-field__label">Search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search options…"
        />
      </label>

      <div className="admin-multi-select__grid">
        {visible.map((option) => (
          <label className="admin-multi-select__item" key={option.id}>
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selected.has(option.id)}
            />
            <span className="admin-checkbox__control" aria-hidden="true" />
            <span>
              <strong>{option.label}</strong>
              {option.meta ? <small>{option.meta}</small> : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
