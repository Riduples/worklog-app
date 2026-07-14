export type QuickLogImage = { base64: string; mediaType: string };

export type QuickLogDraft = {
  type: "income" | "expense";
  amount: number | null;
  whatFor: string;
  person: string;
  method: string;
  confidence: "high" | "low";
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
