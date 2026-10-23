"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 갱신 중일 때 일정 간격으로 서버 데이터를 다시 불러온다. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
