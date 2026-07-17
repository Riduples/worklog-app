import { QueryProvider } from "@/components/providers/QueryProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {/* The typeface is set once on body in globals.css. Repeating it here was
          how the app came to ask for Inter in three files and ship it in none. */}
      <div
        style={{
          minHeight: "100vh",
          background: "#F0F9FF",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </QueryProvider>
  );
}
