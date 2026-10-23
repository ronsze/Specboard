import type { SVGProps } from "react";

const PATHS = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  "check-double": "m2.5 12.5 4.5 4.5L15 8.5M10 16l1 1 9-9",
  x: "M6 6l12 12M18 6 6 18",
  warn: "M12 9v4m0 3.5h.01M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z",
  doc: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm6 0v5h5M9 13h6M9 17h6",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5.5h.01M9.8 9.5a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.8-2.2 3.1",
  compare: "M8 4v14m0 0-3-3m3 3 3-3M16 20V6m0 0-3 3m3-3 3 3",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  chevron: "m6 9 6 6 6-6",
  chevronUp: "m6 15 6-6 6 6",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  eye: "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  chat: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z",
  diamond: "M12 3l7 9-7 9-7-9 7-9Z",
  square: "M5 5h14v14H5z",
  lines: "M4 7h16M4 12h10M4 17h16",
  circle: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  dot: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
} as const;

export type IconName = keyof typeof PATHS;

type Props = Omit<SVGProps<SVGSVGElement>, "name"> & { name: IconName; size?: number; title?: string };

/** 인라인 SVG 아이콘. 의미는 항상 함께 쓰는 글자가 전달하므로 장식(aria-hidden)이 기본이다. */
export function Icon({ name, size = 16, title, ...rest }: Props) {
  const filled = name === "dot";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
