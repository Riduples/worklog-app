"use client";

import { useState } from "react";
import Link from "next/link";
import { useBookings, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";
import { BookingModal } from "@/components/modals/BookingModal";
import { Modal } from "@/components/ui/Modal";
import { Row } from "@/components/ui/Row";
import { fmt } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/ui/ReadOnlyNotice";
import { useToolAccess } from "@/lib/supabase/hooks/useToolAccess";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: "#F0F9FF", fg: "#0369A1" },
  pending: { bg: "#fff7ed", fg: "#b45309" },
  complete: { bg: "#e0f2fe", fg: "#0369a1" },
  cancelled: { bg: "#f1f5f9", fg: "#64748b" },
  no_show: { bg: "#fee2e2", fg: "#991b1b" },
};

function BookingActionsModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const updateBooking = useUpdateBooking();
  const color = STATUS_COLORS[booking.status] ?? STATUS_COLORS.confirmed;
  const setStatus = (status: string) => updateBooking.mutate({ id: booking.id, changes: { status } }, { onSuccess: onClose });

  return (
    <Modal title={booking.client_name} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: color.bg, color: color.fg, textTransform: "uppercase" }}>
          {booking.status.replace("_", " ")}
        </span>
      </div>
      <Row label="Service" value={booking.service ?? "—"} />
      <Row label="Date" value={`${booking.booking_date}${booking.booking_time ? ` · ${booking.booking_time}` : ""}`} />
      <Row label="Total" value={fmt(booking.total_price)} />
      {booking.deposit_paid ? <Row label="Deposit paid" value={fmt(booking.deposit_paid)} /> : null}
      <Row label="Balance due" value={fmt(booking.balance_due)} bold />

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

  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 12, color: "#64748b" }}>
            ← Dashboard
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", margin: "4px 0 0" }}>Bookings</h1>
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
      {selected && <BookingActionsModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
