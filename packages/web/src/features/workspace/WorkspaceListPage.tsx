import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  Code2,
  FileText,
  Folder,
  Image,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { mockWorkspaces } from "../../storage/seeds/mockData";
import type { WorkspaceType } from "../../domain/workspace/types";

const workspaceIcons: Record<WorkspaceType, typeof Code2> = {
  code: Code2,
  image: Image,
  writing: FileText,
  general: Folder,
};

const workspaceTypeKeys: Record<WorkspaceType, string> = {
  code: "workspace.list.types.code",
  image: "workspace.list.types.image",
  writing: "workspace.list.types.writing",
  general: "workspace.list.types.general",
};

const statusKeys = {
  active: "workspace.list.status.active",
  pending: "workspace.list.status.pending",
  archived: "workspace.list.status.archived",
} as const;

export function WorkspaceListPage() {
  const { t } = useTranslation();

  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div className="workspace-page__title-block">
          <p className="workspace-page__eyebrow">{t("nav.workspace")}</p>
          <h1 className="workspace-page__title">{t("workspace.list.title")}</h1>
          <p className="workspace-page__subtitle">{t("workspace.list.subtitle")}</p>
        </div>

        <button type="button" className="workspace-page__primary-btn">
          <Plus size={16} />
          {t("workspace.list.newWorkspace")}
        </button>
      </header>

      <section className="workspace-page__grid">
        {mockWorkspaces.map((workspace) => {
          const Icon = workspaceIcons[workspace.type];

          return (
            <Link
              key={workspace.id}
              to={`/workspace/${workspace.id}`}
              className="workspace-panel"
              style={
                {
                  "--workspace-accent": workspace.color,
                } as CSSProperties
              }
            >
              <div className="workspace-panel__top">
                <div className="workspace-panel__icon-tile">
                  <Icon size={22} />
                </div>
              </div>

              <div className="workspace-panel__body">
                <div>
                  <h2 className="workspace-panel__title">{workspace.name}</h2>
                  <p className="workspace-panel__description">{workspace.description}</p>
                </div>

                <div className="workspace-panel__tags">
                  <span className="workspace-panel__type-badge">
                    {t(workspaceTypeKeys[workspace.type])}
                  </span>
                  <span className={`workspace-status workspace-status--${workspace.status}`}>
                    {t(statusKeys[workspace.status])}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
