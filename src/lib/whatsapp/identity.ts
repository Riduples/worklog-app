import crypto from "crypto";

// The opt-in code the owner sends to the bot to prove the number is theirs.
// Eight digits, generated server-side with a CSPRNG, short-lived (the connect
// route sets the expiry). Eight rather than six raises the guess space to 10^8,
// which — with the short TTL and the tiny number of codes pending at once —
// makes blind redemption impractical (a per-number attempt throttle on the
// webhook is the belt-and-braces control, tracked for Phase 1). Padded so
// "00012345" is a valid code, not "12345".
export function generateLinkCode(): string {
  return crypto.randomInt(0, 100_000_000).toString().padStart(8, "0");
}

// Meta reports the sender as a wa_id: digits, country code, no '+'. Normalise
// anything we store or compare to that shape — strip '+', spaces, punctuation —
// so a number is matched consistently however it arrives.
export function normalizeWaId(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Pull the 8-digit code out of an inbound message body — users may send just
// "12345678" or "my code is 12345678". Matches an exactly-8-digit run not
// touching another digit, so a shorter number (a 6-digit amount) or a longer
// one (a 10-digit phone/reference) isn't mistaken for a code. A non-digit
// delimiter (e.g. "INV-12345678") can still bracket a run; a wrong guess simply
// fails to link, so that edge is harmless.
export function extractLinkCode(text: string): string | null {
  return text.match(/(?<!\d)(\d{8})(?!\d)/)?.[1] ?? null;
}
