import Link from "next/link";

export function ToolTile({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 13,
        padding: "14px 16px",
        fontSize: 14,
        fontWeight: 700,
        color: "#1B4332",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {icon} {label}
    </Link>
  );
}
