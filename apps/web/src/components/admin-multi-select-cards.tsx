"use client";

import { useId, useState } from "react";

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
  const searchId = useId();
  const [query, setQuery] = useState("");
  const selected = new Set(defaultValues);
  const needle = query.trim().toLowerCase();

  const matches = (option: AdminMultiSelectOption) =>
    !needle ||
    [option.label, option.meta ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);

  return (
    <div className="admin-multi-select">
      <label className="admin-field" htmlFor={searchId}>
        <span className="admin-field__label">Search</span>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search options…"
        />
      </label>

      <div
        className="admin-multi-select__grid"
        role="group"
        aria-label="Selectable options"
      >
        {options.map((option) => (
          <label
            className="admin-multi-select__item"
            key={option.id}
            hidden={!matches(option)}
          >
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
