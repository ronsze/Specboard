import { beforeEach, describe, expect, it } from "vitest";
import { approveInput, rejectInput, submitInput } from "@/server/services/inputs";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
import { resetDb, seedWorld, testDb, type World } from "./helpers/db";
import { approvedInput, versionsOf } from "./helpers/spec";

let w: World;
beforeEach(async () => {
  await resetDb();
  w = await seedWorld();
});

describe("승인된 입력으로 spec 버전 생성 (시나리오 1~3)", () => {
  it("입력을 승인하면 첫 버전이 만들어지고 내용이 반영된다", async () => {
    const input = await approvedInput(w, "알림은 이메일로 보낸다");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());

    const versions = await versionsOf(w.feature.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ number: 1, kind: "AI_UPDATE", model: "fake" });
    expect(versions[0].items.map((i) => i.text)).toEqual(["알림은 이메일로 보낸다"]);
    expect(versions[0].items[0].sources.map((s) => s.inputId)).toEqual([input.id]);
    expect(versions[0].inputs.map((i) => i.inputId)).toEqual([input.id]);

    const stored = await testDb.input.findUniqueOrThrow({ where: { id: input.id } });
    expect(stored.consumedAt).not.toBeNull();
    expect(stored.consumedVersionId).toBe(versions[0].id);
  });

  it("두 번째 승인은 기존 버전을 보존하고 새 버전을 추가한다", async () => {
    await approvedInput(w, "첫 번째");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    await approvedInput(w, "두 번째");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());

    const versions = await versionsOf(w.feature.id);
    expect(versions.map((v) => v.number)).toEqual([1, 2]);
    expect(versions[0].items.map((i) => i.text)).toEqual(["첫 번째"]);
    expect(versions[1].items.map((i) => i.text)).toEqual(["첫 번째", "두 번째"]);
    expect(versions[1].items[0].key).toBe(versions[0].items[0].key);
  });

  it("대기·반려 입력의 내용은 어느 버전에도 반영되지 않는다", async () => {
    await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "대기 중" });
    const rejected = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "반려됨" });
    await rejectInput(w.admin, w.board.id, rejected.id, { reason: "범위 밖" });
    await approvedInput(w, "승인됨");
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());

    const texts = (await versionsOf(w.feature.id)).flatMap((v) => v.items.map((i) => i.text));
    expect(texts).toEqual(["승인됨"]);
  });

  it("승인된 입력이 없으면 작업도 버전도 생기지 않는다", async () => {
    await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content: "대기 중" });
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect(await versionsOf(w.feature.id)).toHaveLength(0);
    expect(await testDb.specJob.count()).toBe(0);
  });

  it("관리자 제출(자동 승인)도 새 버전을 만든다", async () => {
    await submitInput(w.admin, w.board.id, w.feature.id, { kind: "MEETING_NOTE", content: "회의 결과" });
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect((await versionsOf(w.feature.id))[0].items.map((i) => i.text)).toEqual(["회의 결과"]);
  });

  it("같은 입력을 두 번 승인 요청해도 한 번만 반영된다", async () => {
    const input = await approvedInput(w, "한 번만");
    await expect(approveInput(w.admin, w.board.id, input.id)).rejects.toThrow();
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
    expect(await versionsOf(w.feature.id)).toHaveLength(1);
  });
});
