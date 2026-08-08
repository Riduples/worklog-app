"use client";

import { useState } from "react";
import { useBookings, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { BookingModal } from "@/components/modals/BookingModal";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { todayStr } from "@/lib/format";
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

// Normalise a stored phone to the wa.me digits-only form. SA numbers are typed
// every which way ("073 005 5112", "+27 73…", "2773…"); wa.me wants pure digits
// with the country code, so strip separators and turn a local leading 0 into 27.
function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "27" + d.slice(1);
  else if (d.length === 9) d = "27" + d; // 0 dropped entirely
  return d;
}

function fmtDuration(min: number | null | undefined): string | null {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} hour${h > 1 ? "s" : ""}` : `${h} hours`;
}

function BookingActionsModal({
  booking,
  canEdit,
  onEdit,
  onClose,
}: {
  booking: Booking;
  canEdit: boolean;
  onEdit: (b: Booking) => void;
  onClose: () => void;
}) {
  const updateBooking = useUpdateBooking();
  const { data: contacts } = useContacts();
  const color = STATUS_COLORS[booking.status] ?? STATUS_COLORS.confirmed;
  const setStatus = (status: string) => updateBooking.mutate({ id: booking.id, changes: { status } }, { onSuccess: onClose });
  // A past appointment can only be marked complete/no-show, not rescheduled or
  // re-priced, so editing is offered on today's and future bookings only.
  const isPast = booking.booking_date < todayStr();
  const isUpcoming = !isPast && (booking.status === "confirmed" || booking.status === "pending");

  // The customer's number lives on their contact record, not the booking. Only
  // build a reminder link if we can resolve one.
  const contact = booking.client_contact_id ? (contacts ?? []).find((c) => c.id === booking.client_contact_id) : null;
  const waNum = waNumber(contact?.phone);
  const firstName = booking.client_name.split(" ")[0] || booking.client_name;
  const whenText = `${booking.booking_date}${booking.booking_time ? ` at ${booking.booking_time}` : ""}`;
  const reminderMsg = `Hi ${firstName}, a friendly reminder about your ${booking.service ? booking.service + " " : ""}appointment on ${whenText}. Please let me know if anything changes. Thank you!`;
  const reminderLink = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(reminderMsg)}` : null;
  const duration = fmtDuration(booking.duration_min);

  return (
    <Modal title={booking.client_name} onClose={onClose}>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
          {booking.status.replace("_", " ")}
        </span>
        {booking.appt_type === "supplier" && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>
            Supplier
          </span>
        )}
      </div>
      {booking.service ? <Row label="Service" value={booking.service} /> : null}
      {booking.purpose ? <Row label="Purpose" value={booking.purpose} /> : null}
      <Row label="Date" value={`${booking.booking_date}${booking.booking_time ? ` · ${booking.booking_time}` : ""}`} />
      {duration ? <Row label="Duration" value={duration} /> : null}
      {booking.location ? <Row label="Location" value={booking.location} /> : null}
      {booking.is_onsite && booking.distance_km ? <Row label="Distance (each way)" value={`${booking.distance_km} km`} /> : null}
      {booking.notes ? <Row label="Notes" value={booking.notes} /> : null}

      {isUpcoming && reminderLink && (
        <a
          href={reminderLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 14, padding: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, textDecoration: "none", boxSizing: "border-box" }}
        >
          📲 Send WhatsApp reminder
        </a>
      )}
      {isUpcoming && !reminderLink && booking.reminder && (
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 14, textAlign: "center" }}>
          Add this customer&apos;s phone number to their contact to send a reminder.
        </p>
      )}

      {canEdit && !isPast && (
        <button
          onClick={() => onEdit(booking)}
          style={{ width: "100%", background: "#F0F9FF", color: "#0369A1", border: "1.5px solid #BAE6FD", borderRadius: 14, padding: 15, fontWeight: 700, cursor: "pointer", marginTop: 16 }}
        >
          ✏️ Edit appointment
        </button>
      )}

      {(booking.status === "confirmed" || booking.status === "pending") && (
        <>
          <button
            onClick={() => setStatus("complete")}
            style={{ width: "100%", background: "#0C4A6E", color: "#fff", border: "none", borderRadius: 14, padding: 16, fontWeight: 700, cursor: "pointer", marginTop: 16 }}
          >
            ✅ Mark Complete
          </button>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={() => setStatus("no_show")}
              style={{ flex: 1, background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer" }}
            >
              No-show
            </button>
            <button
              onClick={() => setStatus("cancelled")}
              style={{ flex: 1, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function BookingsView() {
  const access = useToolAccess("booking");
  const { data: bookings, isLoading } = useBookings();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<"upcoming" | "date" | "recent">("upcoming");

  const today = todayStr();
  const all = bookings ?? [];
  const presentStatuses = STATUS_ORDER.filter((s) => all.some((b) => b.status === s));

  const filtered = all.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${b.client_name} ${b.service ?? ""} ${b.purpose ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  // Diary sort. "Upcoming" (the default) shows the soonest appointment first
  // with today at the top and past appointments below; "Jan–Dec" is straight
  // calendar order, earliest first; "Recent" puts the latest date first. Within
  // a day the time decides, so a 09:00 sits above a 14:00.
  const key = (b: Booking) => `${b.booking_date}T${b.booking_time ?? "00:00"}`;
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "recent") return key(b).localeCompare(key(a));
    if (sort === "date") return key(a).localeCompare(key(b));
    const aUpcoming = a.booking_date >= today;
    const bUpcoming = b.booking_date >= today;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a));
  });
  // The Past divider only makes sense in the upcoming view.
  const firstPastIdx = sort === "upcoming" ? sorted.findIndex((b) => b.booking_date < today) : -1;

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
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No appointments yet.</p>
      )}
      {!isLoading && all.length > 0 && sorted.length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No appointments match your search.</p>
      )}

      {!isLoading && sorted.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 10px 2px" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            {sorted.length}
            {sorted.length !== all.length ? ` of ${all.length}` : ""} appointment{all.length === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: 3 }}>
            {(["upcoming", "date", "recent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: sort === s ? "#fff" : "transparent",
                  color: sort === s ? "#0C4A6E" : "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: sort === s ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {s === "upcoming" ? "Upcoming" : s === "date" ? "Jan–Dec" : "Recent"}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.map((b, i) => {
        const color = STATUS_COLORS[b.status] ?? STATUS_COLORS.confirmed;
        // Label the boundary between upcoming and past, but only when there is
        // something upcoming above it.
        const showPastDivider = i === firstPastIdx && firstPastIdx > 0;
        return (
          <div key={b.id}>
            {showPastDivider && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 2px 8px" }}>
                Past
              </div>
            )}
            <button
              onClick={() => setSelected(b)}
              style={{
                width: "100%",
                background: "#fff",
                borderRadius: 13,
                padding: "12px 14px",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{b.client_name}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  {b.service ? `${b.service} · ` : ""}
                  {b.booking_date}
                  {b.booking_time ? ` · ${b.booking_time}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
            </button>
          </div>
        );
      })}

      {showNew && <BookingModal onClose={() => setShowNew(false)} />}
      {editing && <BookingModal booking={editing} onClose={() => setEditing(null)} />}
      {selected && (
        <BookingActionsModal
          booking={selected}
          canEdit={access.canEdit}
          onEdit={(b) => {
            setSelected(null);
            setEditing(b);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
