import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "ok" | "text";

const cls = (variant: ButtonVariant, small?: boolean) =>
  `btn btn--${variant}${small ? " btn--small" : ""}`;

type CommonProps = { variant?: ButtonVariant; small?: boolean; children: ReactNode };

export function Button({
  variant = "secondary",
  small,
  children,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cls(variant, small)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  small,
  href,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={cls(variant, small)}>
      {children}
    </Link>
  );
}
