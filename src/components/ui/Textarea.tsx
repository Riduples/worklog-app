export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "13px 14px",
        borderRadius: 12,
        border: "1.5px solid #e2e8f0",
        fontSize: 15,
        fontFamily: "inherit",
        lineHeight: 1.5,
        boxSizing: "border-box",
        color: "#111",
        background: "#f8fafc",
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}
