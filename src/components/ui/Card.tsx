import type { HTMLAttributes } from "react";

export function Card({
  variant,
  className = "",
  ...rest
}: HTMLAttributes<HTMLElement> & { variant?: "dashed" | "q" | "no" | "selected" }) {
  return <section className={`card ${variant ? `card--${variant}` : ""} ${className}`.trim()} {...rest} />;
}
