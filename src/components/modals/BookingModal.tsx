"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SaveBtn } from "@/components/ui/SaveBtn";
import { ContactPicker } from "@/components/ui/ContactPicker";
import { fmt, todayStr } from "@/lib/format";
import { useContacts } from "@/lib/supabase/hooks/useContacts";
import { useCreateBooking } from "@/lib/supabase/hooks/useBookings";

export function BookingModal({ onClose }: { onClose: () => void }) {
  const [client, setClient] = useState("");
  const [clientContactId, setClientContactId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [bookingDate, setBookingDate] = useState(todayStr());
  const [bookingTime, setBookingTime] = useState("09:00");
  const [totalPrice, setTotalPrice] = useState("0");
  const [depositPaid, setDepositPaid] = useState("0");
  const [error, setError] = useState("");

  const { data: contacts } = useContacts();
  const createBooking = useCreateBooking();

  const totalNum = parseFloat(totalPrice) || 0;
  const depositNum = parseFloat(depositPaid) || 0;
  const balanceDue = totalNum - depositNum;

  const handleSave = () => {
    if (!client.trim()) {
      setError("Client is required.");
      return;
    }
    setError("");

    createBooking.mutate(
      {
        client_name: client.trim(),
        client_contact_id: clientContactId,
        service: service.trim() || null,
        booking_date: bookingDate,
        booking_time: bookingTime || null,
        total_price: totalNum,
        deposit_paid: depositNum,
        balance_due: balanceDue,
        status: "confirmed",
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal title="New booking" onClose={onClose}>
      <ContactPicker
        label="Client"
        value={client}
        onChange={(v, id) => {
          setClient(v);
          setClientContactId(id);
        }}
        contacts={contacts ?? []}
        placeholder="Client name"
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
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
          Balance due on the day: <strong>{fmt(balanceDue)}</strong>
        </div>
      )}

      {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <SaveBtn label={createBooking.isPending ? "Saving..." : "Save booking"} onClick={handleSave} disabled={createBooking.isPending} />
    </Modal>
  );
}
