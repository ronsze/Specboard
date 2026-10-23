/** 팀의 기준 시간대(한국)로 고정해 서버·브라우저 렌더링 결과가 같게 한다. */
const TZ = "Asia/Seoul";

const parts = (iso: string) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value])) as Record<string, string>;
};

/** 10-14 15:00 */
export function formatShort(iso: string): string {
  const p = parts(iso);
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** 2026-10-22 16:40 */
export function formatFull(iso: string): string {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** 10-22 */
export function formatDay(iso: string): string {
  const p = parts(iso);
  return `${p.month}-${p.day}`;
}
