import Link from "next/link";

const tileStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "#fff",
  border: "none",
  borderRadius: 13,
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 700,
  color: "#0C4A6E",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  cursor: "pointer",
};

export function ToolTile({
  href,
  onClick,
  icon,
  label,
  locked,
  onLockedClick,
}: {
  href?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  if (locked) {
    return (
      <button onClick={onLockedClick} style={{ ...tileStyle, color: "#94a3b8" }}>
        🔒 {label}
      </button>
    );
  }
  // An action tile (e.g. Log income / Log expense opens a modal) has no route.
  if (onClick) {
    return (
      <button onClick={onClick} style={tileStyle}>
        {icon} {label}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} style={tileStyle}>
      {icon} {label}
    </Link>
  );
}
