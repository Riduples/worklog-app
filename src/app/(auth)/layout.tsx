export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F0F9FF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
          {/* The logotype as drawn, dark wordmark and all — this background is
              light (#F0F9FF), where it reads at 16.85:1. Only the navy header
              needs the light variant. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/worklog-logo.png" alt="Worklog" style={{ height: 38, width: "auto", display: "block" }} />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: "28px 24px",
            boxShadow: "0 4px 16px rgba(12,74,110,0.1)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
