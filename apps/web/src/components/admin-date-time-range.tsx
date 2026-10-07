"use client";

import { useState } from "react";

export function AdminDateTimeRange({
  startName,
  endName,
  startLabel = "Starts",
  endLabel = "Ends",
  startId,
  endId,
  defaultStart = "",
  defaultEnd = "",
  startRequired = false,
  endRequired = false,
  startHint,
  endHint,
}: {
  startName: string;
  endName: string;
  startLabel?: string;
  endLabel?: string;
  startId?: string;
  endId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  startRequired?: boolean;
  endRequired?: boolean;
  startHint?: string;
  endHint?: string;
}) {
  const resolvedStartId = startId ?? `admin-${startName}`;
  const resolvedEndId = endId ?? `admin-${endName}`;
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  function updateStart(value: string) {
    setStart(value);
    if (end && value && end < value) setEnd("");
  }

  return (
    <>
      <label className="admin-field" htmlFor={resolvedStartId}>
        <span className="admin-field__label">
          {startLabel}
          {startRequired ? <b aria-hidden="true">*</b> : null}
        </span>
        <input
          id={resolvedStartId}
          type="datetime-local"
          name={startName}
          value={start}
          onChange={(event) => updateStart(event.target.value)}
          required={startRequired}
        />
        {startHint ? (
          <small className="admin-field__hint">{startHint}</small>
        ) : null}
      </label>

      <label className="admin-field" htmlFor={resolvedEndId}>
        <span className="admin-field__label">
          {endLabel}
          {endRequired ? <b aria-hidden="true">*</b> : null}
        </span>
        <input
          id={resolvedEndId}
          type="datetime-local"
          name={endName}
          value={end}
          min={start || undefined}
          onChange={(event) => setEnd(event.target.value)}
          required={endRequired}
        />
        {endHint ? (
          <small className="admin-field__hint">{endHint}</small>
        ) : null}
      </label>
    </>
  );
}
