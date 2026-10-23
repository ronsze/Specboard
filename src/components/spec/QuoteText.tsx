const CONTEXT = 70;

/**
 * 원문 중 근거가 된 문장을 강조해 인용 형태로 보여준다.
 * 강조는 배경색뿐 아니라 밑줄과 따옴표로도 구분된다. 발췌가 없으면 원문 앞부분만 보여준다.
 */
export function QuoteText({
  content,
  quote,
}: {
  content: string;
  quote: { start: number; end: number } | null;
}) {
  if (!quote) {
    const head = content.length > 220 ? `${content.slice(0, 220).trimEnd()}…` : content;
    return <pre className="quote">{head}</pre>;
  }
  const before = content.slice(Math.max(0, quote.start - CONTEXT), quote.start);
  const after = content.slice(quote.end, quote.end + CONTEXT);
  return (
    <p className="quote">
      <span aria-hidden="true">“</span>
      {quote.start > CONTEXT && "…"}
      {before}
      <mark>{content.slice(quote.start, quote.end)}</mark>
      {after}
      {quote.end + CONTEXT < content.length && "…"}
      <span aria-hidden="true">”</span>
    </p>
  );
}
