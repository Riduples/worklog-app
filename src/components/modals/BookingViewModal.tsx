"use client";

import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useQuotes } from "@/lib/supabase/hooks/useQuotes";
import { RECURRENCE_LABEL, type Recurrence } from "@/lib/recurrence";
import { todayStr } from "@/lib/format";
import type { Booking } from "@/lib/supabase/hooks/useBookings";

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

// Read-only look at an appointment for teammates who can view the diary but not
// edit it. Same details the editor holds, minus every write control — the only
// action offered is the (non-destructive) WhatsApp reminder link.
export function BookingViewModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data: contacts } = useContacts();
  const { data: quotes } = useQuotes();

  const linkedQuote = booking.linked_quote_id ? (quotes ?? []).find((q) => q.id === booking.linked_quote_id) ?? null : null;
  const color = STATUS_COLORS[booking.status] ?? STATUS_COLORS.confirmed;
  const duration = fmtDuration(booking.duration_min);

  const isPast = booking.booking_date < todayStr();
  const isUpcoming = !isPast && (booking.status === "confirmed" || booking.status === "pending");

  // The customer's number lives on their contact record, not the booking. Only
  // build a reminder link if we can resolve one.
  const contact = booking.client_contact_id ? (contacts ?? []).find((c) => c.id === booking.client_contact_id) : null;
  const waNum = waNumber(contact?.phone);
  const firstName = booking.client_name.split(" ")[0] || booking.client_name;
  const whenText = `${booking.booking_date}${booking.booking_time ? ` at ${booking.booking_time}` : ""}`;
  const reminderMsg = `Hi ${firstName}, a friendly reminder about your ${booking.service ? booking.service + " " : ""}appointment on ${whenText}. Please let me know if anything changes. Thank you!`;
  const reminderLink = isUpcoming && waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(reminderMsg)}` : null;

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
      {booking.recurrence && booking.recurrence !== "none" ? <Row label="Repeats" value={RECURRENCE_LABEL[booking.recurrence as Recurrence]} /> : null}
      {booking.location ? <Row label="Location" value={booking.location} /> : null}
      {booking.is_onsite && booking.distance_km ? <Row label="Distance (each way)" value={`${booking.distance_km} km`} /> : null}
      {booking.notes ? <Row label="Notes" value={booking.notes} /> : null}
      {linkedQuote ? <Row label="Linked quote" value={linkedQuote.doc_number} /> : null}

      {reminderLink && (
        <a
          href={reminderLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", width: "100%", background: "#25D366", color: "#fff", border: "none", borderRadius: 14, padding: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, textDecoration: "none", boxSizing: "border-box" }}
        >
          📲 Send WhatsApp reminder
        </a>
      )}

      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16, textAlign: "center" }}>
        View only — you don&apos;t have permission to change appointments.
      </p>
    </Modal>
  );
}
