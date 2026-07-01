import { requireBusinessProfile } from "@/lib/auth";
import { greeting } from "@/lib/format";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function DashboardPage() {
  const { profile } = await requireBusinessProfile();

  return (
    <div>
      <div style={{ background: "#1B4332", padding: "20px 20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 1.5 }}>WORKLOG</div>
            <div style={{ fontSize: 11, color: "#6EE7B7", letterSpacing: 0.3 }}>
              {greeting()}, {profile.name || "there"}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
      <div style={{ padding: 20, fontSize: 13, color: "#64748b" }}>
        Dashboard content (income/expense stats, quick actions, tool categories) lands in Phase 5.
      </div>
    </div>
  );
}
