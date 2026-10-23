"use server";

import { signOut } from "@/server/auth/session";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
