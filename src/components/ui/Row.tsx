// A label/value line. `tone="dark"` is for the rows that sit INSIDE a dark card
// (the payslip preview and the saved-payslip modal are both #0C4A6E): the default
// palette paints the label #374151 and the value #0C4A6E, which on that card is
// navy on navy — the whole payslip read as an empty blue box with only the net
// pay, which is styled separately, visible on it.
export function Row({ label, value, bold, tone = "light" }: { label: string; value: string | number; bold?: boolean; tone?: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
      <span style={{ fontSize: 13, color: isDark ? "#BAE6FD" : "#374151" }}>{label}</span>
      <span style={{ fontSize: bold ? 17 : 14, fontWeight: bold ? 800 : 600, color: isDark ? "#fff" : "#0C4A6E", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
