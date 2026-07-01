import Link from "next/link";
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
      <div style={{ padding: 20 }}>
        <Link
          href="/contacts"
          style={{
            display: "block",
            background: "#fff",
            borderRadius: 13,
            padding: "14px 16px",
            fontSize: 14,
            fontWeight: 700,
            color: "#1B4332",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}
        >
          👥 Contacts
        </Link>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 16 }}>
          Income/expense stats, quick actions, and remaining tool categories land in Phase 5.
        </div>
      </div>
    </div>
  );
}
