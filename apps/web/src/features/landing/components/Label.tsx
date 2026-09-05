import type { ComponentPropsWithoutRef } from "react";

// The mono microlabel the artifact calls `.lbl` — section eyebrows, masthead pills, KPI keys,
// spec terms, table sub-lines. A component rather than a CSS class, per CLAUDE.md. Every use in
// the artifact is a <span>, so it stays one; callers add layout with `className`.
const labelClasses = "font-mono text-[10.5px] font-medium tracking-[.13em] uppercase text-muted";

export function Label({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={className ? `${labelClasses} ${className}` : labelClasses} {...props} />;
}
