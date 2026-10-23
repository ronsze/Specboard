export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8h6M8 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18.5" cy="18.5" r="3" fill="var(--src)" />
    </svg>
  );
}
