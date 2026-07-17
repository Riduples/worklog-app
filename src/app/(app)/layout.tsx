import { QueryProvider } from "@/components/providers/QueryProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div
        style={{
          minHeight: "100vh",
          background: "#F0F9FF",
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </QueryProvider>
  );
}
