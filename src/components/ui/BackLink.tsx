import Link from "next/link";

/**
 * The way back.
 *
 * It was a 12px slate link — #64748b on the sky background is 4.46:1, which
 * fails AA for normal text, and the tappable area was about 90x15 against the
 * 44x44 guideline. On a desktop that's merely faint; on a phone there is no
 * sidebar, so this is the only way home and it was the least visible thing on
 * the screen.
 *
 * Now a proper control: navy on white at 9.46:1, and 44px tall so a thumb can
 * find it. Styled from globals.css rather than inline for the same reason the
 * rest of the shell is — the desktop, which has a sidebar and doesn't lean on
 * this, quietly tones it down.
 */
export function BackLink({
  href = "/dashboard",
  label = "Dashboard",
}: {
  href?: string;
  /** What you're going back TO, not the word "Back" — "← Dashboard" tells you where you land. */
  label?: string;
}) {
  return (
    <Link href={href} className="back-link">
      <span aria-hidden="true" className="back-link-arrow">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}

/**
 * The same control for going back a step rather than going somewhere.
 *
 * A wizard step and a modal don't have a URL to return to, so this is a button
 * and not a link — the element should say which of those it is, even though
 * both look identical and should. They shared the same fault too: the pay-run
 * wizard's was #64748b at 4.46:1 with no padding at all, and the permissions
 * editor's was #94a3b8 on white at 2.56:1, the worst contrast in the app.
 *
 * `block` is for a modal footer, where this sits under a full-width Save and
 * matching it is the point. Everywhere else it's the same pill as BackLink.
 */
export function BackButton({
  onClick,
  label = "Back",
  block = false,
}: {
  onClick: () => void;
  label?: string;
  block?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={block ? "back-link back-link--block" : "back-link"}>
      <span aria-hidden="true" className="back-link-arrow">
        ←
      </span>
      <span>{label}</span>
    </button>
  );
}
