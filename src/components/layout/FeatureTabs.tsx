"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";

export function FeatureTabs({
  base,
  inputCount,
}: {
  base: string;
  inputCount?: number | null;
}) {
  const pathname = usePathname();
  const onHistory = pathname.startsWith(`${base}/spec/history`);
  const onSpec = pathname === `${base}/spec`;
  const onInputs = pathname.startsWith(`${base}/inputs`);
  return (
    <Tabs
      items={[
        { href: `${base}/spec`, label: "Spec", active: onSpec },
        { href: `${base}/inputs`, label: "입력", count: inputCount, active: onInputs },
        { href: `${base}/spec/history`, label: "버전 이력", active: onHistory },
      ]}
    />
  );
}
