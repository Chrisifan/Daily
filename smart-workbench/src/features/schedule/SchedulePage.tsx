import { ParticleBackground } from "../../shared/ui/ParticleBackground";
import { GlassCard } from "../../shared/ui/GlassCard";
import { mockWeather, mockSchedules } from "../../storage/seeds/mockData";
import { formatTime, formatDate } from "../../shared/utils/date";
import { Clock, MapPin } from "lucide-react";

export function SchedulePage() {
  return (
    <div className="min-h-screen relative">
      <ParticleBackground condition={mockWeather.condition} />
      
      <div className="relative z-10 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-medium text-white/90">日程总览</h1>
          <p className="text-white/50 mt-1">管理你的所有日程安排</p>
        </header>

        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex gap-2">
                {["日", "周", "月"].map((view) => (
                  <button
                    key={view}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {mockSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex flex-col items-center min-w-[60px]">
                    <span className="text-lg font-medium text-white/90">
                      {formatTime(schedule.startAt)}
                    </span>
                    <span className="text-xs text-white/40">
                      {formatTime(schedule.endAt)}
                    </span>
                  </div>

                  <div className="w-px h-12 bg-white/10" />

                  <div className="flex-1">
                    <h3 className="text-white/90 font-medium">{schedule.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-white/50">
                      {schedule.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {schedule.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(schedule.startAt)}
                      </span>
                    </div>
                  </div>

                  <div className={`
                    px-3 py-1 rounded-full text-xs
                    ${schedule.priority === "high" ? "bg-red-500/20 text-red-300" : ""}
                    ${schedule.priority === "medium" ? "bg-yellow-500/20 text-yellow-300" : ""}
                    ${schedule.priority === "low" ? "bg-green-500/20 text-green-300" : ""}
                  `}>
                    {schedule.priority === "high" ? "高优先级" : schedule.priority === "medium" ? "中优先级" : "低优先级"}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
