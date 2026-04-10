import { GlassCard } from "../../shared/ui/GlassCard";
import { mockWorkspaces } from "../../storage/seeds/mockData";
import { Code2, Image, FileText, Folder, Plus, MoreHorizontal } from "lucide-react";
import type { WorkspaceType } from "../../domain/workspace/types";

const workspaceIcons: Record<WorkspaceType, typeof Code2> = {
  code: Code2,
  image: Image,
  writing: FileText,
  general: Folder
};

const workspaceLabels: Record<WorkspaceType, string> = {
  code: "代码",
  image: "设计",
  writing: "写作",
  general: "通用"
};

const statusLabels = {
  active: "进行中",
  pending: "待开始",
  archived: "已归档"
};

export function WorkspaceListPage() {
  return (
    <div className="min-h-screen relative">
      
      <div className="relative z-10 p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-white/90">工作区</h1>
            <p className="text-white/50 mt-1">管理你的所有项目和工作区</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors">
            <Plus className="w-4 h-4" />
            新建工作区
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {mockWorkspaces.map((workspace) => {
            const Icon = workspaceIcons[workspace.type];
            
            return (
              <GlassCard 
                key={workspace.id} 
                className="p-5 hover:scale-[1.02] transition-transform cursor-pointer"
                hover
              >
                <div className="flex items-start justify-between">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: `${workspace.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: workspace.color }} />
                  </div>
                  <button className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-white/40" />
                  </button>
                </div>

                <h3 className="text-lg font-medium text-white/90 mt-4">{workspace.name}</h3>
                <p className="text-sm text-white/50 mt-1 line-clamp-2">{workspace.description}</p>

                <div className="flex items-center gap-3 mt-4">
                  <span 
                    className="px-2 py-1 rounded-full text-xs"
                    style={{ 
                      backgroundColor: `${workspace.color}20`,
                      color: workspace.color 
                    }}
                  >
                    {workspaceLabels[workspace.type]}
                  </span>
                  <span className={`
                    px-2 py-1 rounded-full text-xs
                    ${workspace.status === "active" ? "bg-green-500/20 text-green-300" : ""}
                    ${workspace.status === "pending" ? "bg-yellow-500/20 text-yellow-300" : ""}
                    ${workspace.status === "archived" ? "bg-gray-500/20 text-gray-300" : ""}
                  `}>
                    {statusLabels[workspace.status]}
                  </span>
                </div>

                {workspace.smartSummary && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/40 line-clamp-2">{workspace.smartSummary}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4 text-xs text-white/30">
                  <span>{workspace.focusLevel} 个焦点</span>
                  <span>{workspace.goals.length} 个目标</span>
                </div>
              </GlassCard>
            );
          })}

          {/* 新建工作区卡片 */}
          <GlassCard 
            className="p-5 flex flex-col items-center justify-center min-h-[200px] cursor-pointer border-dashed border-2"
            hover
          >
            <div className="p-4 rounded-full bg-white/5">
              <Plus className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/40 mt-4">新建工作区</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
