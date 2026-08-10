import { describe, expect, it } from "vitest";
import { aggregateJobHours, type JobHours } from "./jobHours";
import type { TimeEntry } from "@/lib/supabase/hooks/useTimeEntries";
import type { Quote } from "@/lib/supabase/hooks/useQuotes";

// Minimal fixtures — the aggregation only reads a handful of fields, so we cast
// partial rows rather than build full DB objects.
const entry = (e: Partial<TimeEntry>): TimeEntry =>
  ({ hours_worked: 0, ot_hours: 0, bill_type: "Billable", quote_id: null, client_name: null, ...e }) as TimeEntry;
const quote = (q: Partial<Quote>): Quote => ({ id: "q1", doc_number: "Q-1", client_name: "Acme", estimated_hours: 10, ...q }) as Quote;

const byKey = (jobs: JobHours[], key: string) => {
  const j = jobs.find((x) => x.key === key);
  if (!j) throw new Error(`no job ${key}`);
  return j;
};

describe("aggregateJobHours", () => {
  it("counts overtime as hours and splits billable vs non-billable", () => {
    const q = quote({ id: "q1", estimated_hours: 10 });
    const jobs = aggregateJobHours(
      [
        entry({ quote_id: "q1", hours_worked: 6, ot_hours: 2, bill_type: "Billable" }), // 8h billable
        entry({ quote_id: "q1", hours_worked: 3, ot_hours: 0, bill_type: "Non-billable" }), // 3h non-billable
      ],
      [q]
    );
    const j = byKey(jobs, "q1");
    expect(j.billableHours).toBe(8);
    expect(j.nonBillableHours).toBe(3);
    expect(j.totalHours).toBe(11);
    expect(j.sessions).toBe(2);
  });

  it("flags a job over its quoted hours", () => {
    const jobs = aggregateJobHours([entry({ quote_id: "q1", hours_worked: 11 })], [quote({ estimated_hours: 10 })]);
    const j = byKey(jobs, "q1");
    expect(j.status).toBe("over");
    expect(j.overBy).toBe(1);
    expect(j.remaining).toBe(0);
  });

  it("marks near-limit and on-track jobs", () => {
    const near = aggregateJobHours([entry({ quote_id: "q1", hours_worked: 9 })], [quote({ estimated_hours: 10 })]);
    expect(byKey(near, "q1").status).toBe("near");
    expect(byKey(near, "q1").remaining).toBe(1);

    const ontrack = aggregateJobHours([entry({ quote_id: "q1", hours_worked: 4 })], [quote({ estimated_hours: 10 })]);
    expect(byKey(ontrack, "q1").status).toBe("ontrack");
  });

  it("treats entries with no quote estimate as no-estimate jobs, grouped by client", () => {
    const jobs = aggregateJobHours(
      [entry({ client_name: "Bob", hours_worked: 5 }), entry({ client_name: "Bob", hours_worked: 2 })],
      []
    );
    const j = byKey(jobs, "nq-Bob");
    expect(j.hasEstimate).toBe(false);
    expect(j.status).toBe("none");
    expect(j.totalHours).toBe(7);
  });

  it("sorts over-quote jobs first, then no-estimate last", () => {
    const jobs = aggregateJobHours(
      [
        entry({ client_name: "Nobody", hours_worked: 20 }), // no estimate
        entry({ quote_id: "q1", hours_worked: 4 }), // on track
        entry({ quote_id: "q2", hours_worked: 15 }), // over
      ],
      [quote({ id: "q1", estimated_hours: 10 }), quote({ id: "q2", estimated_hours: 10 })]
    );
    expect(jobs[0].key).toBe("q2");
    expect(jobs[jobs.length - 1].status).toBe("none");
  });
});
