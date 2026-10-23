import type { Input, InputStatus, Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import { db } from "@/server/db/client";
import { ALL_ROLES, requireRole } from "@/server/authz/authorize";
import { allocateInputNumber } from "@/server/services/numbering";
import { assertFeatureInBoard } from "@/server/services/feature-access";
import { scheduleSpecUpdate } from "@/server/services/spec-jobs";
import { scheduleConflictCheck } from "@/server/services/conflict-checks";
import { loadConflictViews, type ConflictView } from "@/server/services/conflict-view";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { inputCreateSchema, inputRejectSchema, inputStatusSchema, type InputCreate } from "@/lib/schemas/input";

type Actor = { id: string; displayName: string };

export type InputDto = {
  id: string;
  number: number;
  featureId: string;
  kind: Input["kind"];
  content: string;
  status: InputStatus;
  submitterName: string;
  submittedAt: string;
  autoApproved: boolean;
  decidedByName: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  /** 승인된 입력이 spec 버전에 반영되었는지 (승인 전·반려는 false) */
  reflectedInSpec: boolean;
  /** 반영된 spec 버전 번호 (아직 반영 전이면 null) */
  reflectedVersion: number | null;
  /** 로그인한 사용자가 제출한 입력인가 */
  isMine: boolean;
};

export type DtoContext = { userId?: string; versionNumbers?: Map<string, number> };

export function toDto(i: Input, ctx: DtoContext = {}): InputDto {
  return {
    id: i.id,
    number: i.number,
    featureId: i.featureId,
    kind: i.kind,
    content: i.content,
    status: i.status,
    submitterName: i.submitterName,
    submittedAt: i.submittedAt.toISOString(),
    autoApproved: i.autoApproved,
    decidedByName: i.decidedByName,
    decidedAt: i.decidedAt?.toISOString() ?? null,
    rejectionReason: i.rejectionReason,
    reflectedInSpec: i.consumedAt !== null,
    reflectedVersion: i.consumedVersionId ? (ctx.versionNumbers?.get(i.consumedVersionId) ?? null) : null,
    isMine: ctx.userId !== undefined && i.submittedBy === ctx.userId,
  };
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "잘못된 요청입니다.");
  return result.data;
}

/** 멤버는 PENDING으로, 관리자는 자동 승인(APPROVED)으로 저장한다. */
export async function submitInput(
  user: Actor,
  boardId: string,
  featureId: string,
  payload: InputCreate,
): Promise<InputDto> {
  const role = await requireRole(user.id, boardId, ["ADMIN", "MEMBER"]);
  const data = parse(inputCreateSchema, payload);
  await assertFeatureInBoard(boardId, featureId);

  const now = new Date();
  const autoApprove = role === "ADMIN";
  const input = await db.$transaction(async (tx) => {
    const number = await allocateInputNumber(tx, boardId);
    return tx.input.create({
      data: {
        boardId,
        number,
        featureId,
        kind: data.kind,
        content: data.content,
        submittedBy: user.id,
        submitterName: user.displayName,
        submittedAt: now,
        ...(autoApprove && {
          status: "APPROVED",
          autoApproved: true,
          decidedBy: user.id,
          decidedByName: user.displayName,
          decidedAt: now,
        }),
      },
    });
  });
  if (autoApprove) await scheduleSpecUpdate(featureId);
  else await scheduleConflictCheck(input.id);
  return toDto(input);
}

async function dtoContext(userId: string, inputs: Input[]): Promise<DtoContext> {
  const ids = [...new Set(inputs.map((i) => i.consumedVersionId).filter((v): v is string => v !== null))];
  const versions = ids.length
    ? await db.specVersion.findMany({ where: { id: { in: ids } }, select: { id: true, number: true } })
    : [];
  return { userId, versionNumbers: new Map(versions.map((v) => [v.id, v.number])) };
}

/**
 * ADMIN은 전체, 그 외는 승인·반려 입력과 본인이 제출한 대기 입력만 본다 (FR-021).
 * 비관리자가 status=PENDING을 지정하면 거부한다.
 */
export async function listInputs(
  user: Actor,
  boardId: string,
  featureId: string,
  status?: string,
): Promise<InputDto[]> {
  const role = await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  const statusFilter = status ? parse(inputStatusSchema, status) : undefined;

  if (role !== "ADMIN" && statusFilter === "PENDING") throw new ForbiddenError();

  const visibility =
    role === "ADMIN"
      ? {}
      : { OR: [{ status: { not: "PENDING" as const } }, { submittedBy: user.id }] };
  const inputs = await db.input.findMany({
    where: { featureId, ...(statusFilter && { status: statusFilter }), ...visibility },
    orderBy: { submittedAt: "desc" },
  });
  const ctx = await dtoContext(user.id, inputs);
  return inputs.map((i) => toDto(i, ctx));
}

async function decide(
  user: Actor,
  boardId: string,
  inputId: string,
  outcome: { status: "APPROVED" } | { status: "REJECTED"; rejectionReason: string },
): Promise<InputDto> {
  await requireRole(user.id, boardId, ["ADMIN"]);
  // 조건부 갱신: 먼저 처리된 요청만 성공한다 (동시 승인·반려 보호)
  const { count } = await db.input.updateMany({
    where: { id: inputId, status: "PENDING", feature: { project: { boardId } } },
    data: { ...outcome, decidedBy: user.id, decidedByName: user.displayName, decidedAt: new Date() },
  });
  if (count === 0) {
    const exists = await db.input.findFirst({
      where: { id: inputId, feature: { project: { boardId } } },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError("입력을 찾을 수 없습니다.");
    throw new ConflictError("이미 승인 또는 반려된 입력입니다.");
  }
  return toDto(await db.input.findUniqueOrThrow({ where: { id: inputId } }));
}

export async function approveInput(user: Actor, boardId: string, inputId: string) {
  const approved = await decide(user, boardId, inputId, { status: "APPROVED" });
  await scheduleSpecUpdate(approved.featureId);
  return approved;
}

export async function rejectInput(user: Actor, boardId: string, inputId: string, payload: unknown) {
  await requireRole(user.id, boardId, ["ADMIN"]);
  const { reason } = parse(inputRejectSchema, payload);
  return decide(user, boardId, inputId, { status: "REJECTED", rejectionReason: reason.trim() });
}

export async function listPendingInputs(user: Actor, boardId: string, featureId: string) {
  await requireRole(user.id, boardId, ["ADMIN"]);
  await assertFeatureInBoard(boardId, featureId);
  const inputs = await db.input.findMany({
    where: { featureId, status: "PENDING" },
    orderBy: { submittedAt: "asc" },
  });
  return inputs.map((i) => toDto(i));
}

/** AI spec 작성에 사용 가능한 입력: 승인된 입력만 반환하는 단일 질의 (FR-010). */
export async function listApprovedInputs(user: Actor, boardId: string, featureId: string) {
  await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  const inputs = await db.input.findMany({
    where: { featureId, status: "APPROVED" },
    orderBy: { submittedAt: "asc" },
  });
  return inputs.map((i) => toDto(i));
}

export const INPUT_FILTERS = ["all", "mine-pending", "reflect-pending", "rejected"] as const;
export type InputFilter = (typeof INPUT_FILTERS)[number];

/** 관리자 응답 전용: 충돌 검사 정보가 붙는다. 다른 역할의 응답 객체에는 conflict 키 자체가 없다. */
export type AdminInputDto = InputDto & { conflict: ConflictView | null };

export type InputView = {
  inputs: (InputDto | AdminInputDto)[];
  counts: { all: number; minePending: number; reflectPending: number; rejected: number };
  nextCursor: string | null;
};

const MAX_VIEW_LIMIT = 100;

/**
 * 입력 목록 뷰: 필터, 개수, 페이지. 가시성 규칙(관리자 전체, 그 외 승인·반려 + 본인 대기, FR-021)을
 * 필터와 개수 모두에 적용한다.
 */
export async function listInputsView(
  user: Actor,
  boardId: string,
  featureId: string,
  opts: { filter?: string; limit?: number; cursor?: string } = {},
): Promise<InputView> {
  const role = await requireRole(user.id, boardId, ALL_ROLES);
  await assertFeatureInBoard(boardId, featureId);
  const filter = opts.filter ?? "all";
  if (!(INPUT_FILTERS as readonly string[]).includes(filter)) throw new ValidationError("filter 값이 올바르지 않습니다.");
  const limit = opts.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_VIEW_LIMIT) {
    throw new ValidationError(`limit은 1 이상 ${MAX_VIEW_LIMIT} 이하의 정수여야 합니다.`);
  }

  const visible: Prisma.InputWhereInput =
    role === "ADMIN" ? { featureId } : { featureId, OR: [{ status: { not: "PENDING" } }, { submittedBy: user.id }] };
  const byFilter: Record<InputFilter, Prisma.InputWhereInput> = {
    all: {},
    "mine-pending": { status: "PENDING", submittedBy: user.id },
    "reflect-pending": { status: "APPROVED", consumedAt: null },
    rejected: { status: "REJECTED" },
  };

  const [rows, all, minePending, reflectPending, rejected] = await Promise.all([
    db.input.findMany({
      where: { AND: [visible, byFilter[filter as InputFilter]] },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    }),
    db.input.count({ where: visible }),
    db.input.count({ where: { AND: [visible, byFilter["mine-pending"]] } }),
    db.input.count({ where: { AND: [visible, byFilter["reflect-pending"]] } }),
    db.input.count({ where: { AND: [visible, byFilter.rejected] } }),
  ]);

  const page = rows.slice(0, limit);
  const ctx = await dtoContext(user.id, page);
  const conflicts =
    role === "ADMIN"
      ? await loadConflictViews(page.map((i) => ({ id: i.id, featureId: i.featureId, status: i.status })))
      : null;
  return {
    inputs: page.map((i) => (conflicts ? { ...toDto(i, ctx), conflict: conflicts.get(i.id) ?? null } : toDto(i, ctx))),
    counts: { all, minePending, reflectPending, rejected },
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}
