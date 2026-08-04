import Link from "next/link";

// A tool tile shows what the tool IS, not just its name — a centred icon, the
// label, and a plain-language description underneath (the same one the Team
// permissions editor uses, so the two can't drift). The description lives here,
// on the tile you tap, and deliberately NOT again inside the tool once it opens.
const tileStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  textAlign: "center",
  width: "100%",
  height: "100%",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: "16px 12px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  cursor: "pointer",
  fontFamily: "inherit",
  gap: 5,
};

const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0C4A6E", lineHeight: 1.2 };
const descStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: "#94a3b8", lineHeight: 1.35 };

export function ToolTile({
  href,
  onClick,
  icon,
  label,
  desc,
  locked,
  onLockedClick,
}: {
  href?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  desc?: string;
  locked?: boolean;
  onLockedClick?: () => void;
}) {
  const body = (
    <>
      <span style={{ fontSize: 26, lineHeight: 1 }}>{locked ? "🔒" : icon}</span>
      <span style={{ ...labelStyle, color: locked ? "#94a3b8" : "#0C4A6E" }}>{label}</span>
      {desc && <span style={descStyle}>{desc}</span>}
    </>
  );

  if (locked) {
    return (
      <button onClick={onLockedClick} style={tileStyle}>
        {body}
      </button>
    );
  }
  // An action tile (e.g. Log income / Log expense opens a modal) has no route.
  if (onClick) {
    return (
      <button onClick={onClick} style={tileStyle}>
        {body}
      </button>
    );
  }
  return (
    <Link href={href ?? "#"} style={{ ...tileStyle, textDecoration: "none" }}>
      {body}
    </Link>
  );
}
