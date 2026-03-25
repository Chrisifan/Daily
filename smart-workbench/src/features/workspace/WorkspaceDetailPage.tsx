import { useParams } from "react-router-dom";
import { ParticleBackground } from "../../shared/ui/ParticleBackground";
import { GlassCard } from "../../shared/ui/GlassCard";
import { mockWeather, mockWorkspaces, mockTasks, mockSchedules } from "../../storage/seeds/mockData";
import { Code2, Image, FileText, Folder, ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceType } from "../../domain/workspace/types";
import { formatTime, formatDate } from "../../shared/utils/date";

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

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const workspace = mockWorkspaces.find(w => w.id === id) || mockWorkspaces[0];
  const Icon = workspaceIcons[workspace.type];

  // 过滤出该工作区的任务和日程
  const workspaceTasks = mockTasks.filter(t => t.workspaceId === workspace.id);
  const workspaceSchedules = mockSchedules.filter(s => s.workspaceId === workspace.id);

  return (
    <div className="min-h-screen relative">
      <ParticleBackground condition={mockWeather.condition} />
      
      <div className="relative z-10 p-6">
        {/* 返回按钮 */}
        <Link 
          to="/workspaces"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回工作区列表
        </Link>

        {/* 工作区头部 */}
        <GlassCard className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <div 
              className="p-4 rounded-2xl"
              style={{ backgroundColor: `${workspace.color}20` }}
            >
              <Icon className="w-8 h-8" style={{ color: workspace.color }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-medium text-white/90">{workspace.name}</h1>
                <span 
                  className="px-3 py-1 rounded-full text-xs"
                  style={{ 
                    backgroundColor: `${workspace.color}20`,
                    color: workspace.color 
                  }}
                >
                  {workspaceLabels[workspace.type]}
                </span>
              </div>
              <p className="text-white/50 mt-2">{workspace.description}</p>
              
              {workspace.smartSummary && (
                <div className="mt-4 p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-white/70">{workspace.smartSummary}</p>
                </div>
              )}
            </div>
          </div>

          {/* 目标列表 */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-sm font-medium text-white/70 mb-3">当前目标</h3>
            <div className="flex flex-wrap gap-2">
              {workspace.goals.map((goal, index) => (
                <span 
                  key={index}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-white/60"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 任务列表 */}
          <GlassCard className="p-5">
            <h3 className="text-lg font-medium text-white/90 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white/50" />
              任务 ({workspaceTasks.length})
            </h3>
            <div className="space-y-2">
              {workspaceTasks.map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                >
                  <div className={`
                    w-2 h-2 rounded-full
                    ${task.priority === "high" ? "bg-red-400" : ""}
                    ${task.priority === "medium" ? "bg-yellow-400" : ""}
                    ${task.priority === "low" ? "bg-green-400" : ""}
                  `} />
                  <span className="flex-1 text-sm text-white/80">{task.title}</span>
                  <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${task.status === "done" ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/50"}
                  `}>
                    {task.status === "done" ? "已完成" : task.status === "doing" ? "进行中" : "待办"}
                  </span>
                </div>
              ))}
              {workspaceTasks.length === 0 && (
                <p className="text-center text-white/40 py-4">暂无任务</p>
              )}
            </div>
          </GlassCard>

          {/* 日程列表 */}
          <GlassCard className="p-5">
            <h3 className="text-lg font-medium text-white/90 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-white/50" />
              日程 ({workspaceSchedules.length})
            </h3>
            <div className="space-y-2">
              {workspaceSchedules.map((schedule) => (
                <div 
                  key={schedule.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                >
                  <div className="text-sm text-white/50 min-w-[50px]">
                    {formatTime(schedule.startAt)}
                  </div>
                  <span className="flex-1 text-sm text-white/80 truncate">{schedule.title}</span>
                  <span className="text-xs text-white/40">{formatDate(schedule.startAt)}</span>
                </div>
              ))}
              {workspaceSchedules.length === 0 && (
                <p className="text-center text-white/40 py-4">暂无日程</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
