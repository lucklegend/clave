import type { ComponentPropsWithoutRef } from "react";

// The M3 `label-m` microlabel — KPI keys, dashboard <dt> terms, table sub-lines. A component
// rather than a CSS class, per CLAUDE.md. Every use of it is a <span>, so it stays one;
// callers add layout with `className` (never another type role — see SectionHeading, which
// carries its own `label-l` eyebrow for exactly that reason).
const labelClasses = "label-m text-on-surface-variant";

export function Label({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={className ? `${labelClasses} ${className}` : labelClasses} {...props} />;
}
