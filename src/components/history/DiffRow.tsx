import { ItemKindBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { wordDiff, type Segment } from "@/lib/word-diff";
import type { Change, Unchanged } from "@/server/services/spec-diff";

const MARK = {
  ADDED: { cls: "added", symbol: "+", label: "추가" },
  REMOVED: { cls: "removed", symbol: "−", label: "삭제" },
  CHANGED: { cls: "changed", symbol: "~", label: "변경" },
} as const;

function Words({ segments, kind }: { segments: Segment[]; kind: "del" | "ins" }) {
  return (
    <>
      {segments.map((s, i) =>
        s.changed ? (
          <span key={i} className={kind === "del" ? "diff-del" : "diff-ins"}>{s.text}</span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** 추가 · 삭제 · 변경 한 건. 기호(+ − ~)와 글자, 색, 취소선/밑줄로 구분하므로 색을 못 봐도 알 수 있다. */
export function DiffRow({ change }: { change: Change }) {
  const m = MARK[change.change];
  const textChanged = change.before !== change.after;
  const words = change.change === "CHANGED" && textChanged ? wordDiff(change.before ?? "", change.after ?? "") : null;
  return (
    <div className={`diff-row diff-row--${m.cls}`} data-change={change.change} data-key={change.key}>
      <div className="diff-row__mark">
        <span aria-hidden="true">{m.symbol}</span>
        <div>{m.label}</div>
      </div>
      <div className="diff-row__body">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="row">
            {change.scope === "ITEM" && change.kind ? (
              <ItemKindBadge kind={change.kind} />
            ) : (
              <span className="badge badge--q"><Icon name="question" size={12} /> 미결 질문</span>
            )}
            <span className="id">{change.label}</span>
          </span>
          {change.addedSources.length > 0 && (
            <span className="small" style={{ color: "var(--src)", fontWeight: 600 }}>
              {change.change === "ADDED" ? "출처" : "새 출처"} {change.addedSources.map((s) => s.label).join(" · ")}
            </span>
          )}
        </div>
        {change.change === "ADDED" && <p>{change.after}</p>}
        {change.change === "REMOVED" && <p className="diff-del">{change.before}</p>}
        {change.change === "CHANGED" && words && (
          <>
            <p>
              <span className="meta" style={{ marginRight: 12 }}>이전</span>
              <Words segments={words.before} kind="del" />
            </p>
            <p>
              <span className="meta" style={{ marginRight: 12 }}>이후</span>
              <Words segments={words.after} kind="ins" />
            </p>
          </>
        )}
        {change.change === "CHANGED" && !words && (
          <p>
            {change.after} <span className="meta">· 문구는 같고 출처가 늘었습니다</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function UnchangedRow({ row }: { row: Unchanged }) {
  return (
    <div className="diff-row" data-change="NONE">
      <div className="diff-row__mark" style={{ color: "var(--ink-3)" }}>
        <span aria-hidden="true">=</span>
        <div>동일</div>
      </div>
      <div className="diff-row__body">
        <span className="id">{row.label}</span>
        <p>{row.text}</p>
      </div>
    </div>
  );
}
