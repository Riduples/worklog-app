export type QuickLogImage = { base64: string; mediaType: string };

// The inline actions Quick Log can save on its own, plus "handoff" — the marker
// for anything that needs a full Worklog tool (invoice, payroll, tax, …) instead.
export type QuickLogAction =
  | "income"
  | "expense"
  | "booking"
  | "stock"
  | "mileage"
  | "time"
  | "contact"
  | "handoff";

// One flat shape covers every action; the fields that don't apply to a given
// action come back as "" or null (the model is told to fill every field).
export type QuickLogDraft = {
  action: QuickLogAction;
  confidence: "high" | "low";
  amount: number | null;
  whatFor: string;
  person: string;
  method: string;
  date: string; // YYYY-MM-DD (booking / mileage / time), else ""
  time: string; // HH:MM (booking), else ""
  quantity: number | null; // stock
  km: number | null; // mileage
  hours: number | null; // time
  contactType: string; // "client" | "supplier" | ""
  phone: string; // contact
  suggestedTool: string; // handoff target, else ""
};

export async function parseQuickLog(input: { text?: string; image?: QuickLogImage }): Promise<QuickLogDraft> {
  const res = await fetch("/api/quick-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Couldn't read that — please try again or type it manually.");
  }
  return data.draft as QuickLogDraft;
}

export function fileToBase64(file: File): Promise<QuickLogImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
