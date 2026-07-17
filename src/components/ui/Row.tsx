export function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, fontWeight: bold ? 800 : 600, color: "#0C4A6E" }}>{value}</span>
    </div>
  );
}
