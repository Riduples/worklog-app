import { PERIOD_LABELS, type Period } from "@/lib/period";

export function PeriodSelector({ selected, onSelect }: { selected: Period; onSelect: (p: Period) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 20,
            border: `1.5px solid ${selected === p ? "#0C4A6E" : "#e2e8f0"}`,
            background: selected === p ? "#0C4A6E" : "#fff",
            color: selected === p ? "#fff" : "#374151",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
