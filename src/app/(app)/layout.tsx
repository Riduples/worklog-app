import { QueryProvider } from "@/components/providers/QueryProvider";
import { Sidebar } from "@/components/shell/Sidebar";
import { SyncStatus } from "@/components/shell/SyncStatus";
import { WriteAccessProvider } from "@/lib/writeAccess";
import { LogModalProvider } from "@/components/providers/LogModalProvider";
import { ReadOnlyToast } from "@/components/billing/ReadOnlyToast";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { AnnouncementBanner } from "@/components/announcements/AnnouncementBanner";
import { LoggyProvider } from "@/components/shell/LoggyAssistant";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <WriteAccessProvider>
        {/* Hosts the Income/Expense modals above the shell so the sidebar and the
            mobile "More" sheet can open them over any page — see LogModalProvider. */}
        <LogModalProvider>
          {/* LoggyProvider hosts the floating help bot (launcher + chat) above the
              whole shell, and lets any screen open it via useLoggy() — the
              dashboard's "Help" button does. It renders its own UI after the
              children, so Loggy floats over every page. */}
          <LoggyProvider>
            {/* The shape of this lives in globals.css, because a style attribute
                can't hold a media query. On a phone it stays what it always was: one
                480px column, no sidebar. The typeface is set once on body, for the
                same reason it isn't repeated here. */}
            <div className="app-shell">
              <Sidebar />
              <div className="app-content">
                <AnnouncementBanner />
                {children}
              </div>
            </div>
            {/* Fixed to the viewport and self-hiding — shows only when entries are
                waiting to sync, on whichever screen the owner happens to be on. */}
            <SyncStatus />
            <ReadOnlyToast />
            <MobileTabBar />
          </LoggyProvider>
        </LogModalProvider>
      </WriteAccessProvider>
    </QueryProvider>
  );
}
