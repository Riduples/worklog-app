// The Diary tab of Scheduling Reports, rolled up.
//
// Everything here comes off the booking row itself — nothing needs to be joined
// or inferred — but nothing had ever added it up, so the one number a
// diary-driven business feels every week (how often people don't show) was
// invisible. Pure, so the screen and the printed copy read the same figures.

import type { Booking } from "@/lib/supabase/hooks/useBookings";

// The statuses BookingsView filters by, in its order.
export const BOOKING_STATUS_ORDER = ["confirmed", "pending", "complete", "no_show", "cancelled"] as const;

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  complete: "Complete",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export type DiaryStatusRow = { status: string; label: string; count: number; value: number; hours: number };

export type DiaryReportTotals = {
  appointments: number;
  /** Everything booked, whatever became of it. */
  booked: number;
  /** Only the appointments actually completed — the money the diary really made. */
  completed: number;
  /** Booked but lost to a no-show or a cancellation. */
  lost: number;
  deposits: number;
  outstanding: number;
  hours: number;
  onsite: number;
  inHouse: number;
  noShowRate: number;
  cancelRate: number;
};

export type DiaryClientRow = { name: string; appointments: number; value: number; noShows: number };

const num = (v: unknown) => Number(v || 0);
const hoursOf = (b: Booking) => num(b.duration_min) / 60;

export function aggregateDiary(bookings: Booking[]): {
  byStatus: DiaryStatusRow[];
  clients: DiaryClientRow[];
  totals: DiaryReportTotals;
} {
  const statuses = [
    ...BOOKING_STATUS_ORDER.filter((s) => bookings.some((b) => b.status === s)),
    // A status outside the known list still gets a row rather than vanishing
    // from a total that claims to cover everything.
    ...[...new Set(bookings.map((b) => b.status))].filter((s) => !BOOKING_STATUS_ORDER.includes(s as (typeof BOOKING_STATUS_ORDER)[number])),
  ];

  const byStatus: DiaryStatusRow[] = statuses.map((status) => {
    const rows = bookings.filter((b) => b.status === status);
    return {
      status,
      label: BOOKING_STATUS_LABEL[status] ?? status,
      count: rows.length,
      value: rows.reduce((s, b) => s + num(b.total_price), 0),
      hours: rows.reduce((s, b) => s + hoursOf(b), 0),
    };
  });

  const byClient = new Map<string, DiaryClientRow>();
  for (const b of bookings) {
    const name = (b.client_name || "—").trim();
    const row = byClient.get(name) ?? { name, appointments: 0, value: 0, noShows: 0 };
    row.appointments += 1;
    row.value += num(b.total_price);
    if (b.status === "no_show") row.noShows += 1;
    byClient.set(name, row);
  }
  const clients = [...byClient.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const valueOf = (status: string) => byStatus.find((s) => s.status === status)?.value ?? 0;
  const countOf = (status: string) => byStatus.find((s) => s.status === status)?.count ?? 0;

  const booked = bookings.reduce((s, b) => s + num(b.total_price), 0);
  const noShows = countOf("no_show");
  const cancelled = countOf("cancelled");

  return {
    byStatus,
    clients,
    totals: {
      appointments: bookings.length,
      booked,
      completed: valueOf("complete"),
      lost: valueOf("no_show") + valueOf("cancelled"),
      deposits: bookings.reduce((s, b) => s + num(b.deposit_paid), 0),
      // What's still to collect, counted only where the appointment happened —
      // a cancelled booking's balance was never owed.
      outstanding: bookings.filter((b) => b.status === "complete").reduce((s, b) => s + num(b.balance_due), 0),
      hours: bookings.reduce((s, b) => s + hoursOf(b), 0),
      onsite: bookings.filter((b) => b.is_onsite).length,
      inHouse: bookings.filter((b) => !b.is_onsite).length,
      // Rates are of everything booked: a no-show rate that excluded cancellations
      // from the denominator would flatter a diary full of them.
      noShowRate: bookings.length ? (noShows / bookings.length) * 100 : 0,
      cancelRate: bookings.length ? (cancelled / bookings.length) * 100 : 0,
    },
  };
}
