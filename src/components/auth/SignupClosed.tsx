import Link from "next/link";
import { whatsappUrl } from "@/lib/legal/company";

/** Shown in place of the signup form while registrations are paused
 *  (platform_settings.signups_enabled = false). Existing testers can still log in;
 *  the database also refuses any new account, so this is the friendly face of a
 *  real block, not the block itself. */
export function SignupClosed() {
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0C4A6E", marginBottom: 8 }}>Sign-ups open soon</h1>
      <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.6, marginBottom: 18 }}>
        We&apos;re putting the finishing touches on Worklog, so new sign-ups are paused for now. Leave us a message on
        WhatsApp and we&apos;ll let you know the moment it&apos;s open.
      </p>
      <a
        href={whatsappUrl("Hi Worklog, please let me know when I can sign up")}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", fontWeight: 800, fontSize: 14, padding: "13px", borderRadius: 12, textDecoration: "none" }}
      >
        📲 Message us on WhatsApp
      </a>
      <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#0C4A6E", fontWeight: 700 }}>
          Log in
        </Link>
      </p>
    </div>
  );
}
