import { notFound } from "next/navigation";
import { FeatureTabs } from "@/components/layout/FeatureTabs";
import { pageContext } from "@/server/auth/page-context";
import { db } from "@/server/db/client";

export default async function FeatureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  await pageContext(boardId);
  const feature = await db.feature.findFirst({
    where: { id: featureId, project: { boardId } },
    select: { name: true, project: { select: { name: true } } },
  });
  if (!feature) notFound();

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Feature · {feature.project.name}</div>
          <h1>{feature.name}</h1>
        </div>
        <FeatureTabs base={`/boards/${boardId}/features/${featureId}`} />
      </div>
      {children}
    </div>
  );
}
