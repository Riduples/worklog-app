"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { fmt, todayStr } from "@/lib/format";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useCreateBooking, useUpdateBooking, type Booking } from "@/lib/supabase/hooks/useBookings";

export function BookingModal({ booking, onClose }: { booking?: Booking; onClose: () => void }) {
  const isEdit = !!booking;
  const [client, setClient] = useState(booking?.client_name ?? "");
  const [clientContactId, setClientContactId] = useState<string | null>(booking?.client_contact_id ?? null);
  const [service, setService] = useState(booking?.service ?? "");
  const [bookingDate, setBookingDate] = useState(booking?.booking_date ?? todayStr());
  const [bookingTime, setBookingTime] = useState(booking ? booking.booking_time ?? "" : "09:00");
  const [totalPrice, setTotalPrice] = useState(String(booking?.total_price ?? 0));
  const [depositPaid, setDepositPaid] = useState(String(booking?.deposit_paid ?? 0));
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const saving = createBooking.isPending || updateBooking.isPending;

  const totalNum = parseFloat(totalPrice) || 0;
  const depositNum = parseFloat(depositPaid) || 0;
  const balanceDue = totalNum - depositNum;

  const handleSave = () => {
    if (!client.trim()) {
      setError("Client is required.");
      return;
    }
    setError("");

    const changes = {
      client_name: client.trim(),
      client_contact_id: clientContactId,
      service: service.trim() || null,
      booking_date: bookingDate,
      booking_time: bookingTime || null,
      total_price: totalNum,
      deposit_paid: depositNum,
      balance_due: balanceDue,
    };

    // Editing updates ONLY this one booking and deliberately never calls
    // createBooking. That keeps the one-time side-effects of making a *fresh*
    // booking — spinning up its recurring series and logging the on-site
    // mileage/expense — from firing a second time and spawning duplicates. The
    // row's id and status are carried through untouched.
    if (isEdit) {
      updateBooking.mutate({ id: booking.id, changes: { ...changes, status: booking.status } }, { onSuccess: onClose });
    } else {
      createBooking.mutate({ ...changes, status: "confirmed" }, { onSuccess: onClose });
    }
  };

  return (
    <Modal title={isEdit ? "Edit booking" : "New booking"} onClose={onClose}>
      <ContactPicker
        label="Customer"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Customer name"
      />

      <Field label="Service / job">
        <Input value={service} onChange={setService} placeholder="e.g. Haircut, geyser install" />
      </Field>

      <Field label="Date">
        <Input value={bookingDate} onChange={setBookingDate} type="date" />
      </Field>

      <Field label="Time">
        <Input value={bookingTime} onChange={setBookingTime} type="time" />
      </Field>

      <Field label="Total price">
        <Input value={totalPrice} onChange={setTotalPrice} type="number" placeholder="0.00" />
      </Field>

      <Field label="Deposit paid">
        <Input value={depositPaid} onChange={setDepositPaid} type="number" placeholder="0.00" />
      </Field>

      {totalNum > 0 && (
        <div style={{ background: "#F0F9FF", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#0369A1" }}>
          Balance due on the day: <strong>{fmt(balanceDue)}</strong>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={saving ? "Saving..." : isEdit ? "Save changes" : "Save booking"} onClick={handleSave} disabled={saving} />
    </Modal>
  );
}
