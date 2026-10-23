import { beforeEach, describe, expect, it } from "vitest";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { submitInput } from "@/server/services/inputs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import type { SpecWriter, WriterOutput, WriterRequest } from "@/server/ai/spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

const spec = () => getSpec(w.viewer, w.board.id, w.feature.id);
const slice = (content: string, q: { start: number; end: number } | null) => (q ? content.slice(q.start, q.end) : null);

/** 지정한 출력을 그대로 돌려주는 테스트용 writer */
class ScriptedWriter implements SpecWriter {
  readonly modelName = "scripted";
  constructor(private readonly build: (req: WriterRequest) => WriterOutput) {}
  async write(req: WriterRequest) {
    return this.build(req);
  }
}

describe("인용 발췌 저장과 노출 (시나리오 6~9)", () => {
  it("원문에 있는 발췌는 구간으로 저장되어 출처에 quote로 나온다", async () => {
    const content = "쿠폰은 한 장만 적용한다. 나머지 세부는 아직 미정이다.";
    await approvedInput(w, content);
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const source = (await spec()).version!.items[0].sources[0];
    expect(slice(source.content, source.quote)).toBe("쿠폰은 한 장만 적용한다.");
    const row = await testDb.specItemSource.findFirstOrThrow();
    expect([row.quoteStart, row.quoteEnd]).toEqual([0, "쿠폰은 한 장만 적용한다.".length]);
  });

  it("원문에 없는 발췌는 버려지고 항목·출처 연결은 정상 저장된다 (작업은 성공)", async () => {
    await approvedInput(w, "쿠폰은 한 장만 적용한다.");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter({ badQuotes: true }));
    const view = await spec();
    expect(view.version!.items).toHaveLength(1);
    expect(view.version!.items[0].sources[0].quote).toBeNull();
    expect((await testDb.specJob.findFirstOrThrow()).status).toBe("DONE");
  });

  it("공백·줄바꿈만 다른 발췌는 일치로 인정하고 원문 표기대로 강조한다", async () => {
    const content = "머리말\n쿠폰은  한 장만\n적용한다.\n꼬리말";
    const input = await approvedInput(w, content);
    const writer = new ScriptedWriter((req) => ({
      items: [{ key: null, kind: "REQUIREMENT", text: "쿠폰은 한 장만", sourceInputIds: [input.id], quotes: [{ inputId: input.id, quote: "쿠폰은 한 장만 적용한다." }] }],
      questions: [],
      ...(req ? {} : {}),
    }));
    await drainSpecJobs(w.feature.id, writer);
    const source = (await spec()).version!.items[0].sources[0];
    expect(slice(source.content, source.quote)).toBe("쿠폰은  한 장만\n적용한다.");
  });

  it("같은 출처를 다시 인용하지 않은 기존 항목의 발췌는 유지된다", async () => {
    await approvedInput(w, "첫 문장이다. 둘째 문장이다.");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    await approvedInput(w, "다른 입력이다.");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const { version } = await spec();
    expect(version!.number).toBe(2);
    const first = version!.items[0].sources[0];
    expect(slice(first.content, first.quote)).toBe("첫 문장이다.");
  });

  it("한 항목의 출처마다 각자의 발췌를 가진다", async () => {
    const a = await approvedInput(w, "A 입력의 핵심 문장. 부가 설명.");
    const b = await approvedInput(w, "B 입력의 핵심 문장. 부가 설명.");
    const writer = new ScriptedWriter(() => ({
      items: [
        {
          key: null,
          kind: "DECISION",
          text: "두 입력을 합친 결정",
          sourceInputIds: [a.id, b.id],
          quotes: [
            { inputId: a.id, quote: "A 입력의 핵심 문장." },
            { inputId: b.id, quote: "B 입력의 핵심 문장." },
          ],
        },
      ],
      questions: [],
    }));
    await drainSpecJobs(w.feature.id, writer);
    const sources = (await spec()).version!.items[0].sources;
    expect(sources.map((s) => slice(s.content, s.quote)).sort()).toEqual(["A 입력의 핵심 문장.", "B 입력의 핵심 문장."]);
  });

  it("항목이 인용했다고 선언하지 않은 입력의 발췌는 무시한다 (오류 없음)", async () => {
    const a = await approvedInput(w, "A 입력이다.");
    const b = await approvedInput(w, "B 입력이다.");
    const writer = new ScriptedWriter(() => ({
      items: [{ key: null, kind: "REQUIREMENT", text: "A만 근거", sourceInputIds: [a.id], quotes: [{ inputId: b.id, quote: "B 입력이다." }] }],
      questions: [],
    }));
    await drainSpecJobs(w.feature.id, writer);
    const { version } = await spec();
    expect(version!.items[0].sources.map((s) => s.inputId)).toEqual([a.id]);
    expect(await testDb.specItemSource.count({ where: { quoteStart: { not: null } } })).toBe(0);
  });

  it("질문의 출처에도 발췌가 붙는다", async () => {
    await approvedInput(w, "알림은 언제 보내야 하나?");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    const q = (await spec()).version!.questions[0];
    expect(slice(q.sources[0].content, q.sources[0].quote)).toBe("알림은 언제 보내야 하나?");
  });

  it("002 이전처럼 발췌 컬럼이 비어 있는 출처는 quote null로 오류 없이 나온다", async () => {
    const input = await approvedInput(w, "예전 입력");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    await testDb.specItemSource.updateMany({ data: { quoteStart: null, quoteEnd: null } });
    const source = (await spec()).version!.items[0].sources[0];
    expect(source).toMatchObject({ inputId: input.id, quote: null });
  });

  it("잘못된 입력(제출만 한 입력)에는 영향이 없다", async () => {
    await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "대기 입력." });
    expect((await spec()).version).toBeNull();
  });
});
