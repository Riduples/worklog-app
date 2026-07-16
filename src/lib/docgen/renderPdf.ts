// Server-rendered PDF. The client sends structured data (never HTML) and gets
// back PDF bytes — see /api/render-pdf for why.
//
// window.print() stays as the fallback: it has always produced correct,
// SARS-convention documents, so a cold Chromium, a timeout, or a missing local
// browser should degrade to it rather than leave the user unable to get a copy.
export type RenderPdfBody = Record<string, unknown> & { kind: string };

export async function renderPdf(body: RenderPdfBody): Promise<Blob> {
  const res = await fetch("/api/render-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Couldn't render the PDF." }));
    throw new Error(data.message ?? "Couldn't render the PDF.");
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
