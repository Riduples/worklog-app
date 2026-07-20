# Auth email templates

The source of truth for the auth emails Supabase sends. The live copy lives in
the Supabase dashboard (**Authentication → Email Templates**); these files exist
so the wording isn't only in a dashboard nobody can diff, and so it survives a
project migration.

When you change one, change it in both places.

## Where each goes

| File | Dashboard template | Subject line to set |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | `Confirm your email to start using Worklog` |
| `magic-link.html` | **Magic Link** | `Your Worklog sign-in link` |
| `reset-password.html` | **Reset Password** | `Reset your Worklog password` |

Paste the HTML into the template body; set the Subject in the field above it.

## What is NOT here, and why

- **Team invites** don't use a Supabase email at all. The app creates an invite
  token and the owner copies an `/accept-invite?token=…` link to share (e.g. over
  WhatsApp) — see `InviteModal.tsx`. So Supabase's "Invite user" template never
  fires and there's nothing to fill. If invites should one day email the person,
  that's an app change (send via the Resend API, or `inviteUserByEmail`), not a
  template.
- **Change Email Address** and **Reauthentication** are left on Supabase's
  defaults — rarely hit, and not worth the maintenance until they are. Add them
  here the day they matter.

## Notes for whoever edits these

- The only Supabase variable used is `{{ .ConfirmationURL }}` — the action link,
  correct for all three template types. It appears twice per file: once on the
  button, once as a paste-able fallback. Keep both.
- The brand is a **text** wordmark, not an image, on purpose: email clients
  block remote images by default, so an `<img>` logo would show as a broken box
  until the reader clicks "show images". If you ever want the real mark, host it
  at a stable public URL and swap the `<span>Worklog</span>` for an `<img>` with
  the wordmark as its `alt`.
- Layout is table-based with inline styles because email clients are not
  browsers — do not refactor this to the app's CSS classes; `globals.css` does
  not reach here.
- Colours match the app: navy `#0C4A6E`, sky `#F0F9FF`, and the muted greys.

## Before relying on any of this

Custom SMTP (Resend) has to be configured in **Authentication → SMTP Settings**
first, or these still send from the throttled built-in mailer. And check
**Authentication → URL Configuration** — the Site URL and redirect allow-list
must point at the live domain, or `{{ .ConfirmationURL }}` sends a real user to
`localhost`.
