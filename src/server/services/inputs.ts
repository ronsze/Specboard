import type { Input, InputStatus } from "@prisma/client";
import type { ZodType } from "zod";
import { db } from "@/server/db/client";
import { ALL_ROLES, requireRole } from "@/server/authz/authorize";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { inputCreateSchema, inputStatusSchema, type InputCreate } from "@/lib/schemas/input";

type Actor = { id: string; displayName: string };

export type InputDto = {
  id: string;
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
};

export function toDto(i: Input): InputDto {
  return {
    id: i.id,
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
  };
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? "잘못된 요청입니다.");
  return result.data;
}

async function assertFeatureInBoard(boardId: string, featureId: string) {
  const feature = await db.feature.findFirst({
    where: { id: featureId, project: { boardId } },
    select: { id: true },
  });
  if (!feature) throw new NotFoundError("feature를 찾을 수 없습니다.");
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
  const input = await db.input.create({
    data: {
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
  return toDto(input);
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
  return inputs.map(toDto);
}
