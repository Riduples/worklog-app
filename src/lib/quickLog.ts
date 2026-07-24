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

// The model caps a photo at ~1,576 input tokens once it's past ~1.4MP and resizes
// server-side anyway, so a 12MP camera shot costs the same tokens as a 1568px one —
// but uploading it costs the user 10-20x the mobile data and can blow past the API's
// 5MB-per-image limit. So we downscale to a 1568px long edge before upload: same
// token cost, full receipt legibility, a fraction of the bytes over the wire. Kept
// at 1568 (not lower) because receipts have small print and OCR needs the pixels.
const MAX_EDGE = 1568;

export function fileToBase64(file: File): Promise<QuickLogImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const raw = (): QuickLogImage => ({ base64: dataUrl.split(",")[1] ?? "", mediaType: file.type || "image/jpeg" });

      const img = new Image();
      img.onload = () => {
        const longEdge = Math.max(img.width, img.height);
        // Already within budget — don't re-encode (that would only add JPEG artefacts).
        if (longEdge <= MAX_EDGE || !img.width || !img.height) {
          resolve(raw());
          return;
        }
        const scale = MAX_EDGE / longEdge;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(raw());
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        // JPEG at 0.85 keeps a receipt sharp at a fraction of the original's size.
        const out = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: out.split(",")[1] ?? "", mediaType: "image/jpeg" });
      };
      // Undecodable (e.g. HEIC on a browser without support) — send the original and
      // let the API try, rather than failing the whole entry over a resize.
      img.onerror = () => resolve(raw());
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
