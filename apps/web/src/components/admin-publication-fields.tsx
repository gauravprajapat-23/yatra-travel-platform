"use client";

import { useState } from "react";

export type AdminPublicationStatusOption = {
  value: string;
  label: string;
};

export function AdminPublicationFields({
  statuses,
  defaultStatus,
  defaultScheduledFor = "",
  statusName = "status",
  scheduleName = "scheduledFor",
  statusId = "admin-publication-status",
  scheduleId = "admin-publication-schedule",
}: {
  statuses: AdminPublicationStatusOption[];
  defaultStatus: string;
  defaultScheduledFor?: string;
  statusName?: string;
  scheduleName?: string;
  statusId?: string;
  scheduleId?: string;
}) {
  const [status, setStatus] = useState(defaultStatus);
  const [scheduledFor, setScheduledFor] = useState(defaultScheduledFor);
  const scheduled = status === "SCHEDULED";

  return (
    <>
      <label className="admin-field" htmlFor={statusId}>
        <span className="admin-field__label">
          Status
          <b aria-hidden="true">*</b>
        </span>
        <select
          id={statusId}
          name={statusName}
          value={status}
          onChange={(event) => {
            const next = event.target.value;
            setStatus(next);
            if (next !== "SCHEDULED") setScheduledFor("");
          }}
          required
        >
          {statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="admin-field__hint">
          Use Scheduled only when a future publication date is intended.
        </small>
      </label>

      {scheduled ? (
        <label className="admin-field" htmlFor={scheduleId}>
          <span className="admin-field__label">
            Schedule date
            <b aria-hidden="true">*</b>
          </span>
          <input
            id={scheduleId}
            name={scheduleName}
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            required
          />
          <small className="admin-field__hint">
            The scheduled publisher must be healthy for this item to publish automatically.
          </small>
        </label>
      ) : (
        <input type="hidden" name={scheduleName} value="" />
      )}
    </>
  );
}
