"use client";

import Link from "next/link";
import { useWriteAccess } from "@/lib/writeAccess";

export function SaveBtn({
  label = "Save",
  icon = "✅",
  onClick,
  type = "button",
  disabled,
  allowInReadOnly = false,
}: {
  label?: string;
  icon?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /**
   * Keep this save usable in a read-only business. For the handful of writes the
   * server still permits when read-only — editing business/tax details or team
   * permissions, which a lapsed owner may need to prepare to reactivate. Data
   * records (income, invoices, staff, …) leave this false and get gated.
   */
  allowInReadOnly?: boolean;
}) {
  const { isReadOnly } = useWriteAccess();

  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "16px",
    fontSize: 16,
    fontWeight: 700,
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    color: "#fff",
    textDecoration: "none",
  };

  // Read-only: a nudge to reactivate rather than a doomed write the database
  // would reject anyway. Matches the read-only banner's "Choose a plan" CTA.
  if (isReadOnly && !allowInReadOnly) {
    return (
      <Link href="/billing/checkout" style={{ ...base, background: "#E8A33D" }}>
        <span>🔒</span> Choose a plan to save changes
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        background: disabled ? "#94a3b8" : "#0C4A6E",
        cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 4px 12px rgba(12,74,110,0.25)",
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
