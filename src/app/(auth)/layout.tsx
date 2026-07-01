export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0fdf4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div
            style={{
              background: "#F59E0B",
              borderRadius: 9,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 17,
              color: "#1B4332",
              fontFamily: "monospace",
            }}
          >
            W
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#1B4332", letterSpacing: 1.5 }}>WORKLOG</div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: "28px 24px",
            boxShadow: "0 4px 16px rgba(27,67,50,0.1)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
