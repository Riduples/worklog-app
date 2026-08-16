import { describe, expect, it } from "vitest";
import { aggregateDiary } from "./diaryReport";
import type { Booking } from "@/lib/supabase/hooks/useBookings";

const booking = (b: Partial<Booking>): Booking =>
  ({
    id: "b1",
    client_name: "Thabo",
    status: "complete",
    total_price: 0,
    deposit_paid: 0,
    balance_due: 0,
    duration_min: 60,
    is_onsite: false,
    booking_date: "2026-05-01",
    ...b,
  }) as Booking;

describe("aggregateDiary", () => {
  it("splits value and hours by status", () => {
    const { byStatus } = aggregateDiary([
      booking({ id: "1", status: "complete", total_price: 300, duration_min: 90 }),
      booking({ id: "2", status: "complete", total_price: 200, duration_min: 30 }),
      booking({ id: "3", status: "no_show", total_price: 150, duration_min: 60 }),
    ]);
    const complete = byStatus.find((s) => s.status === "complete")!;
    expect(complete).toMatchObject({ count: 2, value: 500, hours: 2 });
    expect(byStatus.find((s) => s.status === "no_show")).toMatchObject({ count: 1, value: 150 });
  });

  it("separates what was booked from what was completed and what was lost", () => {
    const { totals } = aggregateDiary([
      booking({ id: "1", status: "complete", total_price: 500 }),
      booking({ id: "2", status: "no_show", total_price: 150 }),
      booking({ id: "3", status: "cancelled", total_price: 250 }),
      booking({ id: "4", status: "confirmed", total_price: 100 }),
    ]);
    expect(totals.booked).toBe(1000);
    expect(totals.completed).toBe(500);
    expect(totals.lost).toBe(400);
  });

  it("rates no-shows and cancellations against everything booked", () => {
    const { totals } = aggregateDiary([
      booking({ id: "1", status: "complete" }),
      booking({ id: "2", status: "no_show" }),
      booking({ id: "3", status: "cancelled" }),
      booking({ id: "4", status: "confirmed" }),
    ]);
    expect(totals.noShowRate).toBe(25);
    expect(totals.cancelRate).toBe(25);
  });

  it("counts a balance still owed only where the appointment happened", () => {
    const { totals } = aggregateDiary([
      booking({ id: "1", status: "complete", balance_due: 200 }),
      booking({ id: "2", status: "cancelled", balance_due: 900 }),
    ]);
    expect(totals.outstanding).toBe(200);
  });

  it("splits on-site from in-house and totals deposits and hours", () => {
    const { totals } = aggregateDiary([
      booking({ id: "1", is_onsite: true, deposit_paid: 100, duration_min: 120 }),
      booking({ id: "2", is_onsite: false, deposit_paid: 50, duration_min: 60 }),
    ]);
    expect(totals).toMatchObject({ onsite: 1, inHouse: 1, deposits: 150, hours: 3 });
  });

  it("ranks clients by value and counts their no-shows", () => {
    const { clients } = aggregateDiary([
      booking({ id: "1", client_name: "Small", total_price: 100 }),
      booking({ id: "2", client_name: "Big", total_price: 900 }),
      booking({ id: "3", client_name: "Big", status: "no_show", total_price: 50 }),
    ]);
    expect(clients[0]).toMatchObject({ name: "Big", appointments: 2, value: 950, noShows: 1 });
    expect(clients[1].name).toBe("Small");
  });

  it("gives an unknown status its own row rather than dropping it from the totals", () => {
    const { byStatus, totals } = aggregateDiary([booking({ id: "1", status: "rescheduled", total_price: 400 })]);
    expect(byStatus.map((s) => s.status)).toContain("rescheduled");
    expect(totals.booked).toBe(400);
  });

  it("has no rates to report on an empty diary", () => {
    const { totals } = aggregateDiary([]);
    expect(totals).toMatchObject({ appointments: 0, noShowRate: 0, cancelRate: 0, booked: 0 });
  });
});
