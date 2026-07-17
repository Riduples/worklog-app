export function SaveBtn({
  label = "Save",
  icon = "✅",
  onClick,
  type = "button",
  disabled,
}: {
  label?: string;
  icon?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#94a3b8" : "#0C4A6E",
        color: "#fff",
        border: "none",
        borderRadius: 14,
        padding: "16px",
        fontSize: 16,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 8,
        boxShadow: disabled ? "none" : "0 4px 12px rgba(27,67,50,0.25)",
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
