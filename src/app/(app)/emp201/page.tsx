import { redirect } from "next/navigation";
import { requirePlanAccess } from "@/lib/auth";

// EMP201 lives inside the Payroll Compliance hub now. The Structured gate is kept
// here (requirePlanAccess), then we forward to the hub's EMP201 tab so old links,
// bookmarks and the assistant all land in the one home.
export default async function Emp201Page() {
  await requirePlanAccess("emp201");
  redirect("/payroll-compliance?tab=emp201");
}
