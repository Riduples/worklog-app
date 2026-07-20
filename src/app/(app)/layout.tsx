import { QueryProvider } from "@/components/providers/QueryProvider";
import { Sidebar } from "@/components/shell/Sidebar";
import { SyncStatus } from "@/components/shell/SyncStatus";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {/* The shape of this lives in globals.css, because a style attribute
          can't hold a media query. On a phone it stays what it always was: one
          480px column, no sidebar. The typeface is set once on body, for the
          same reason it isn't repeated here. */}
      <div className="app-shell">
        <Sidebar />
        <div className="app-content">{children}</div>
      </div>
      {/* Fixed to the viewport and self-hiding — shows only when entries are
          waiting to sync, on whichever screen the owner happens to be on. */}
      <SyncStatus />
    </QueryProvider>
  );
}
