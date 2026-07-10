import { createClient } from "@/lib/supabase/client";
import type { DocKind } from "@/lib/docgen/buildDocumentHTML";

// window.open()/print() is the ideal path but is unreliable in sandboxed
// contexts where pop-ups are silently blocked; the guaranteed fallback is a
// direct .html download the user can print-to-PDF from their browser.
export function openDocumentForPrinting(html: string, filename: string) {
  let popupWorked = false;
  try {
    const win = window.open("", "_blank");
    if (win && !win.closed) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        try {
          win.print();
        } catch {}
      }, 400);
      popupWorked = true;
    }
  } catch {
    popupWorked = false;
  }

  if (!popupWorked) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    alert("Document downloaded. Open it and use your browser's Print → Save as PDF.");
  }
}

export async function shareDocumentText(title: string, text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard! Paste into WhatsApp, SMS or email.");
  } catch {
    alert("Sharing isn't available in this browser.");
  }
}

// Record-keeping per the schema's generated_documents audit-trail design:
// upload the rendered HTML to Storage and log a row pointing at it.
export async function archiveGeneratedDocument(html: string, kind: DocKind, sourceId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const filePath = `${user.id}/${kind}/${sourceId}.html`;
  const blob = new Blob([html], { type: "text/html" });

  const { error: uploadError } = await supabase.storage
    .from("generated-documents")
    .upload(filePath, blob, { upsert: true, contentType: "text/html" });
  if (uploadError) throw uploadError;

  const { data: signed } = await supabase.storage.from("generated-documents").createSignedUrl(filePath, 60 * 60 * 24 * 7);

  const { error: insertError } = await supabase.from("generated_documents").insert({
    user_id: user.id,
    document_type: kind,
    source_id: sourceId,
    file_path: filePath,
    file_url: signed?.signedUrl ?? null,
  });
  if (insertError) throw insertError;
}
