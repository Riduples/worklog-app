"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBookings, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";
import { BookingModal } from "@/components/modals/BookingModal";
import { BookingViewModal } from "@/components/modals/BookingViewModal";
import { todayStr, addDays } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";
import { BackLink } from "@/components/ui/BackLink";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: "#F0F9FF", fg: "#0369A1" },
  pending: { bg: "#fff7ed", fg: "#b45309" },
  complete: { bg: "#e0f2fe", fg: "#0369a1" },
  cancelled: { bg: "#f1f5f9", fg: "#64748b" },
  no_show: { bg: "#fee2e2", fg: "#991b1b" },
};

// Status filter pills follow this order; only statuses actually in use get a
// pill, so a diary with nothing cancelled never shows a Cancelled pill.
const STATUS_ORDER = ["confirmed", "pending", "complete", "no_show", "cancelled"];
const statusLabel = (s: string) => (s === "all" ? "All" : s.replace("_", "-"));

export function BookingsView() {
  const access = useToolAccess("booking");
  const { data: bookings, isLoading } = useBookings();
  const updateBooking = useUpdateBooking();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [viewing, setViewing] = useState<Booking | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Deep link from the dashboard's "Needs you today" card: /diary?open=<id> opens
  // that appointment straight away — in the editor for editors, the read-only
  // sheet otherwise. Sync during render once the bookings and the access verdict
  // have loaded (matching the dashboard's ?upgrade= handling), firing once via
  // the consumed guard; a tiny effect then strips the param so a closed sheet
  // never re-opens and the diary keeps a clean URL.
  const searchParams = useSearchParams();
  const router = useRouter();
  const openId = searchParams.get("open");
  const [consumedOpenId, setConsumedOpenId] = useState<string | null>(null);
  if (openId && openId !== consumedOpenId && !isLoading && !access.loading) {
    const match = (bookings ?? []).find((b) => b.id === openId);
    if (match) (access.canEdit ? setEditing : setViewing)(match);
    setConsumedOpenId(openId);
  }
  useEffect(() => {
    if (openId && openId === consumedOpenId) router.replace("/diary");
  }, [openId, consumedOpenId, router]);

  // Delete is a soft delete: stamp deleted_at so the row drops out of every diary
  // query (they all filter deleted_at IS NULL) while the record survives for
  // history. Unlike Cancel — which keeps the appointment visible as a cancelled
  // entry — deleting removes it from the diary entirely.
  const handleDelete = (b: Booking) => {
    if (!confirm("Remove this appointment?")) return;
    updateBooking.mutate({ id: b.id, changes: { deleted_at: new Date().toISOString() } });
  };

  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const all = bookings ?? [];
  const presentStatuses = STATUS_ORDER.filter((s) => all.some((b) => b.status === s));

  // Search and the status pills narrow the whole diary, past appointments
  // included, so an old record is always findable by name, service or purpose.
  const filtered = all.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${b.client_name} ${b.service ?? ""} ${b.purpose ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  // Agenda read: upcoming soonest-first (today at the top), then past most-
  // recent-first. Within a day the time decides, so 09:00 sits above 14:00.
  const key = (b: Booking) => `${b.booking_date}T${b.booking_time ?? "00:00"}`;
  const upcoming = filtered
    .filter((b) => b.booking_date >= today)
    .sort((a, b) => key(a).localeCompare(key(b)));
  const past = filtered
    .filter((b) => b.booking_date < today)
    .sort((a, b) => key(b).localeCompare(key(a)));

  // Group the upcoming run into day sections (Today, Tomorrow, then dated) for
  // a diary-style read. Past stays one section, each row showing its own date.
  const upcomingGroups: { date: string; items: Booking[] }[] = [];
  for (const b of upcoming) {
    const last = upcomingGroups[upcomingGroups.length - 1];
    if (last && last.date === b.booking_date) last.items.push(b);
    else upcomingGroups.push({ date: b.booking_date, items: [b] });
  }

  const dateHeader = (dateStr: string) => {
    if (dateStr === today) return "Today";
    if (dateStr === tomorrow) return "Tomorrow";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  };
  const shortDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  };

  const sectionHeaderStyle = (accent: boolean): React.CSSProperties => ({
    fontSize: 11,
    fontWeight: 700,
    color: accent ? "#0C4A6E" : "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    margin: "16px 2px 8px",
  });

  // Editors open the appointment straight in its editor; view-only teammates get
  // the read-only detail sheet instead of an editable form they can't save.
  const openRow = (b: Booking) => (access.canEdit ? setEditing(b) : setViewing(b));

  // One appointment row. `showDate` puts the date in the subtitle for past rows,
  // which have no per-day header above them. Tapping the row opens the appointment;
  // the ✕ soft-deletes it after a confirm — mirroring the Items list, so the two
  // dashboards behave the same way.
  const appointmentRow = (b: Booking, showDate: boolean) => {
    const color = STATUS_COLORS[b.status] ?? STATUS_COLORS.confirmed;
    const sub = [showDate ? shortDate(b.booking_date) : null, b.booking_time, b.purpose || b.service]
      .filter(Boolean)
      .join(" · ");
    return (
      <div
        key={b.id}
        style={{
          background: "#fff",
          borderRadius: 13,
          padding: "12px 14px",
          marginBottom: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        <button
          onClick={() => openRow(b)}
          style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", flex: 1, padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{b.client_name}</div>
            {sub && <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {b.status.replace("_", " ")}
          </span>
        </button>
        {access.canDelete && (
          <button
            onClick={() => handleDelete(b)}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: 4, marginLeft: 6 }}
            aria-label="Remove appointment"
          >
            ✕
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <BackLink />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Diary</h1>
        </div>
        {access.canEdit && (
          <button
            onClick={() => setShowNew(true)}
            style={{ background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + New
          </button>
        )}
      </div>

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="appointments" />}

      {!isLoading && all.length > 0 && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search appointments..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
              boxSizing: "border-box",
              marginBottom: 12,
              background: "#fff",
            }}
          />

          {presentStatuses.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {["all", ...presentStatuses].map((s) => {
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: `1.5px solid ${active ? "#0C4A6E" : "#e2e8f0"}`,
                      background: active ? "#0C4A6E" : "#fff",
                      color: active ? "#fff" : "#374151",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && all.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>
          No appointments yet.{access.canEdit ? " Tap “+ New” to make your first appointment." : ""}
        </p>
      )}
      {!isLoading && all.length > 0 && filtered.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No appointments match your search.</p>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ margin: "0 0 4px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {filtered.length}
            {filtered.length !== all.length ? ` of ${all.length}` : ""} appointment{all.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {upcomingGroups.map((g) => (
        <div key={g.date}>
          <div style={sectionHeaderStyle(true)}>{dateHeader(g.date)}</div>
          {g.items.map((b) => appointmentRow(b, false))}
        </div>
      ))}

      {past.length > 0 && (
        <div>
          <div style={sectionHeaderStyle(false)}>Past</div>
          {past.map((b) => appointmentRow(b, true))}
        </div>
      )}

      {showNew && <BookingModal onClose={() => setShowNew(false)} />}
      {editing && <BookingModal booking={editing} onClose={() => setEditing(null)} />}
      {viewing && <BookingViewModal booking={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
