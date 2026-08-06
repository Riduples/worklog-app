"use client";

import { useState } from "react";
import { useBookings, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { BookingModal } from "@/components/modals/BookingModal";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { fmt, todayStr } from "@/lib/format";
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
      <Row label="Service" value={booking.service ?? "—"} />
      {booking.purpose ? <Row label="Purpose" value={booking.purpose} /> : null}
      <Row label="Date" value={`${booking.booking_date}${booking.booking_time ? ` · ${booking.booking_time}` : ""}`} />
      {duration ? <Row label="Duration" value={duration} /> : null}
      {booking.location ? <Row label="Location" value={booking.location} /> : null}
      {booking.is_onsite && booking.distance_km ? <Row label="Distance (each way)" value={`${booking.distance_km} km`} /> : null}
      <Row label="Total" value={fmt(booking.total_price)} />
      {booking.deposit_paid ? <Row label="Deposit paid" value={fmt(booking.deposit_paid)} /> : null}
      <Row label="Balance due" value={fmt(booking.balance_due)} bold />
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

      {!access.loading && !access.canEdit && <ReadOnlyNotice level={access.level} what="bookings" />}

      {isLoading && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading...</p>}
      {!isLoading && (bookings ?? []).length === 0 && (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", marginTop: 40 }}>No bookings yet.</p>
      )}

      {(bookings ?? []).map((b) => {
        const color = STATUS_COLORS[b.status] ?? STATUS_COLORS.confirmed;
        return (
          <button
            key={b.id}
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
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0C4A6E" }}>{fmt(b.total_price)}</div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
                {b.status.replace("_", " ")}
              </span>
            </div>
          </button>
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
