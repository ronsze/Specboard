import Link from "next/link";
import type { InputFilter, InputView } from "@/server/services/inputs";

const FILTERS: { key: InputFilter; label: string; count: (c: InputView["counts"]) => number }[] = [
  { key: "all", label: "전체", count: (c) => c.all },
  { key: "mine-pending", label: "내 대기", count: (c) => c.minePending },
  { key: "reflect-pending", label: "반영 대기", count: (c) => c.reflectPending },
  { key: "rejected", label: "반려", count: (c) => c.rejected },
];

/** 링크 기반 필터 칩: 선택은 주소(?filter=)에 반영되어 새로고침해도 유지된다. */
export function InputFilters({
  base,
  current,
  counts,
}: {
  base: string;
  current: InputFilter;
  counts: InputView["counts"];
}) {
  return (
    <nav className="filters" aria-label="입력 필터">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === "all" ? base : `${base}?filter=${f.key}`}
          className="filter"
          aria-current={current === f.key ? "true" : undefined}
        >
          {f.label} <span className="mono">{f.count(counts)}</span>
        </Link>
      ))}
    </nav>
  );
}
