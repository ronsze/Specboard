"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { NavTree } from "@/server/services/nav";

type MenuItem = { id: string; name: string; href: string };

function CrumbMenu({ label, current, items }: { label: string; current: string; items: MenuItem[] }) {
  return (
    <details className="crumb-menu" data-current="true">
      <summary aria-label={`${label} 전환: 현재 ${current}`}>
        {current}
        <Icon name="chevron" size={14} />
      </summary>
      <div className="crumb-menu__list" role="menu">
        {items.map((item) => (
          <Link key={item.id} href={item.href} role="menuitem" aria-current={item.name === current ? "true" : undefined}>
            {item.name}
          </Link>
        ))}
      </div>
    </details>
  );
}

/** 보드 › 프로젝트 › feature 경로. 각 단계는 키보드로 열 수 있는 전환 메뉴다. */
export function Breadcrumb({ tree }: { tree: NavTree }) {
  const { boardId, featureId } = useParams<{ boardId?: string; featureId?: string }>();
  const board = tree.find((b) => b.id === boardId);
  if (!board) return null;
  const project = board.projects.find((p) => p.features.some((f) => f.id === featureId));
  const feature = project?.features.find((f) => f.id === featureId);

  return (
    <nav className="crumbs" aria-label="현재 위치">
      <CrumbMenu
        label="보드"
        current={board.name}
        items={tree.map((b) => ({ id: b.id, name: b.name, href: `/#board-${b.id}` }))}
      />
      {project && (
        <>
          <span className="crumbs__sep" aria-hidden="true">/</span>
          <CrumbMenu
            label="프로젝트"
            current={project.name}
            items={board.projects.map((p) => ({ id: p.id, name: p.name, href: `/#project-${p.id}` }))}
          />
        </>
      )}
      {feature && project && (
        <>
          <span className="crumbs__sep" aria-hidden="true">/</span>
          <CrumbMenu
            label="feature"
            current={feature.name}
            items={project.features.map((f) => ({
              id: f.id,
              name: f.name,
              href: `/boards/${board.id}/features/${f.id}/spec`,
            }))}
          />
        </>
      )}
    </nav>
  );
}
