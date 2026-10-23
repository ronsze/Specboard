import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** axe 접근성 점검 (color-contrast 포함). 위반이 있으면 규칙 id와 대상을 출력하며 실패한다. */
export async function expectNoA11yViolations(page: Page, label = page.url()) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label} 접근성 위반`).toEqual([]);
}

/** 라이트·다크 두 모드로 같은 점검을 반복한다. */
export async function forEachColorScheme(page: Page, fn: (scheme: "light" | "dark") => Promise<void>) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await fn(scheme);
  }
}
