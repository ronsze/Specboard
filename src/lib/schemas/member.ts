import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "MEMBER", "VIEWER"]);
export const memberAddSchema = z.object({ email: z.string().email("올바른 이메일을 입력해 주세요."), role: roleSchema });
export const roleChangeSchema = z.object({ role: roleSchema });
