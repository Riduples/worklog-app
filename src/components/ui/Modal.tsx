export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "22px 22px 0 0",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "24px 20px 48px",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1B4332" }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 15,
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
