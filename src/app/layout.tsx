import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";

// 시안의 글꼴. 내려받지 못하면(오프라인) 토큰의 시스템 글꼴 대체 스택으로 표시된다.
const plexSans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans-kr",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: { default: "Specboard", template: "%s · Specboard" },
  description: "회의에서 정한 것을, 근거와 함께 남깁니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
