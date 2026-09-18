"use client";

import { useState } from "react";
import type { NotificationPreferences as Preferences } from "@/modules/notifications/preferences";

const options: Array<{ key: keyof Preferences; label: string }> = [
  { key: "mentionInApp", label: "Mentions" },
  { key: "invitationInApp", label: "Workspace invitations" },
  { key: "assignmentInApp", label: "Task assignments" },
  { key: "statusChangeInApp", label: "Task status changes" },
  { key: "reminderInApp", label: "Due-date reminders" },
  { key: "mentionEmail", label: "Mention emails" },
];

export function NotificationPreferences({
  initialPreferences,
}: {
  initialPreferences: Preferences;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [status, setStatus] = useState("");

  async function toggle(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setStatus("Saving…");
    const response = await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!response.ok) {
      setPreferences(preferences);
      setStatus("Could not save preferences.");
      return;
    }
    setStatus("Saved");
  }

  return (
    <section
      className="notification-preferences"
      aria-labelledby="notification-preferences-title"
    >
      <div>
        <p className="eyebrow accent">Your signal</p>
        <h2 id="notification-preferences-title">Preferences</h2>
      </div>
      <div className="notification-preference-grid">
        {options.map((option) => (
          <label key={option.key}>
            <span>{option.label}</span>
            <input
              type="checkbox"
              checked={preferences[option.key]}
              onChange={() => void toggle(option.key)}
            />
          </label>
        ))}
      </div>
      <p className="notification-preference-status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
