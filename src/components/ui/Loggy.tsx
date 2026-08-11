import type { CSSProperties } from "react";

/**
 * Loggy — Worklog's mascot, a friendly orange spiral notebook.
 *
 * A single <img> pointing at the SVGs in public/mascot/, matching how the rest
 * of the app serves its logo (plain <img>, no next/image). Loggy is decorative
 * reinforcement, never the only carrier of a message — so `alt` defaults to ""
 * and the image is hidden from assistive tech unless the caller passes real alt
 * text describing the *state* ("Till balanced successfully"), not the mascot.
 *
 * Animations are opt-in and all yield to prefers-reduced-motion (see globals.css):
 *   - "bob": gentle idle float, for loading/waiting states
 *   - "pop": one scale-in, for success moments (the cash-up "till balanced")
 */
export type LoggyPose = "happy" | "worried" | "wow" | "celebrate" | "thumbsup" | "sleepy";
type LoggyAnimate = "none" | "bob" | "pop";

export function Loggy({
  pose = "happy",
  size = 180,
  alt = "",
  animate = "none",
  className,
  style,
}: {
  pose?: LoggyPose;
  size?: number;
  alt?: string;
  animate?: LoggyAnimate;
  className?: string;
  style?: CSSProperties;
}) {
  const decorative = alt === "";
  const animClass = animate === "bob" ? "loggy-bob" : animate === "pop" ? "loggy-pop" : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/mascot/loggy-${pose}.svg`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={decorative ? "true" : undefined}
      className={["loggy", animClass, className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}
