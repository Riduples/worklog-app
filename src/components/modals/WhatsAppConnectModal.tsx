"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { COMPANY, whatsappUrl } from "@/lib/legal/company";

// "Connect WhatsApp" — the owner links their WhatsApp number so they can log
// straight from a chat. The flow: generate an 8-digit code here, send it to the
// bot from the phone you want to link; Meta's webhook confirms it, and this
// modal — which polls while a code is pending — flips to "connected". All the
// real work is in /api/whatsapp/connect (session, owner-only); this is just its
// face.

type Status =
  | { status: "loading" }
  | { status: "none" }
  | { status: "pending"; code: string; expiresAt: string }
  | { status: "linked"; phone: string }
  | { status: "error"; message: string };

const NAVY = "#0C4A6E";
const MUTED = "#64748b";
const WA_GREEN = "#25D366";

// Format a wa_id (digits only) back to a readable "+27 73 005 5112".
function prettyPhone(waId: string): string {
  return waId.startsWith("27") && waId.length === 11
    ? `+27 ${waId.slice(2, 4)} ${waId.slice(4, 7)} ${waId.slice(7)}`
    : `+${waId}`;
}

export function WhatsAppConnectModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<Status>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "GET" });
      const data = (await res.json()) as Status & { error?: string };
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Couldn't load your WhatsApp status." });
        return;
      }
      setState(data);
    } catch {
      setState({ status: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() only setStates after an awaited fetch (asynchronous, not a synchronous cascading render); it's shared with the poll interval and the retry button
    load();
  }, [load]);

  // While a code is pending, poll so the modal flips to "connected" the moment
  // the webhook verifies the number — no manual refresh needed.
  useEffect(() => {
    if (state.status !== "pending") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [state.status, load]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = (await res.json()) as Status & { error?: string };
      setState(res.ok ? data : { status: "error", message: data.error ?? "Couldn't generate a code." });
    } catch {
      setState({ status: "error", message: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      setState(res.ok ? { status: "none" } : { status: "error", message: data.error ?? "Couldn't disconnect." });
    } catch {
      setState({ status: "error", message: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Connect WhatsApp" onClose={onClose}>
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#166534", lineHeight: 1.6 }}>
        Link your WhatsApp number to log income &amp; expenses by sending a message or a photo of a slip — no app needed.
        You link it once, from the phone you want to use.
      </div>

      {state.status === "loading" && <p style={{ fontSize: 13, color: MUTED }}>Loading…</p>}

      {state.status === "none" && (
        <>
          <ol style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
            <li>Tap the button below to get your connection code.</li>
            <li>Send it to Worklog on WhatsApp from the number you want to link.</li>
            <li>Done — this screen updates the moment it&apos;s connected.</li>
          </ol>
          <button type="button" onClick={generate} disabled={busy} style={primaryBtn(busy)}>
            {busy ? "Getting your code…" : "Get my connection code"}
          </button>
        </>
      )}

      {state.status === "pending" && (
        <>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Your code</div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: 6, color: NAVY, textAlign: "center", padding: "10px 0 4px", fontVariantNumeric: "tabular-nums" }}>
            {state.code}
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, textAlign: "center", marginBottom: 16 }}>
            Send this code to Worklog on WhatsApp ({COMPANY.supportPhone}) from the number you want to link. It expires in 15
            minutes.
          </div>
          <a href={whatsappUrl(state.code)} target="_blank" rel="noopener noreferrer" style={waBtn}>
            💬 Open WhatsApp to send it
          </a>
          <p style={{ fontSize: 11.5, color: MUTED, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            Waiting for your message… this updates automatically once it&apos;s connected.
          </p>
          <button type="button" onClick={generate} disabled={busy} style={{ ...linkBtn, marginTop: 4 }}>
            Get a fresh code
          </button>
        </>
      )}

      {state.status === "linked" && (
        <>
          <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "14px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>Connected</div>
            <div style={{ fontSize: 13, color: "#15803D", marginTop: 2 }}>{prettyPhone(state.phone)}</div>
          </div>
          <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginBottom: 16 }}>
            Logging straight from WhatsApp is coming soon — we&apos;ll let you know the moment it&apos;s live.
          </p>
          <button type="button" onClick={disconnect} disabled={busy} style={dangerBtn(busy)}>
            {busy ? "Disconnecting…" : "Disconnect this number"}
          </button>
        </>
      )}

      {state.status === "error" && (
        <>
          <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{state.message}</p>
          <button type="button" onClick={load} style={primaryBtn(false)}>
            Try again
          </button>
        </>
      )}
    </Modal>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: NAVY,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "13px",
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontFamily: "inherit",
  };
}

const waBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  background: WA_GREEN,
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "13px",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
  textDecoration: "none",
  boxSizing: "border-box",
};

const linkBtn: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  color: NAVY,
  border: "none",
  padding: "8px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
};

function dangerBtn(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: "#fff",
    color: "#b45309",
    border: "1.5px solid #fed7aa",
    borderRadius: 12,
    padding: "12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontFamily: "inherit",
  };
}
