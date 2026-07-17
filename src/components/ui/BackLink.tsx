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
