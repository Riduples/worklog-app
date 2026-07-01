export function Chips({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onSelect(o === selected ? "" : o)}
          style={{
            padding: "9px 14px",
            borderRadius: 20,
            border: `1.5px solid ${selected === o ? "#1B4332" : "#e2e8f0"}`,
            background: selected === o ? "#1B4332" : "#fff",
            color: selected === o ? "#fff" : "#374151",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
