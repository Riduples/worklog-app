import type { SarsCategory } from "@/lib/sarsCategories";

export function SarsSuggestionDropdown({
  suggestions,
  onPick,
}: {
  suggestions: SarsCategory[];
  onPick: (s: SarsCategory) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 60,
        background: "#fff",
        border: "1.5px solid #d1fae5",
        borderRadius: 12,
        marginTop: 4,
        boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "7px 12px",
          fontSize: 10,
          fontWeight: 700,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          background: "#f0fdf4",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        SARS category suggestions — tap to select
      </div>
      {suggestions.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s)}
          style={{
            width: "100%",
            padding: "11px 14px",
            border: "none",
            borderBottom: "1px solid #f8fafc",
            background: "#fff",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{s.label}</span>
            <span
              style={{
                fontSize: 10,
                color: "#64748b",
                background: "#f1f5f9",
                borderRadius: 6,
                padding: "2px 6px",
                marginLeft: 8,
                whiteSpace: "nowrap",
              }}
            >
              {s.group}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>SARS: {s.sars}</span>
        </button>
      ))}
    </div>
  );
}
