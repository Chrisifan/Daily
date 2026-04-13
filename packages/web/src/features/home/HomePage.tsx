import { MainCard } from "./MainCard";
import { SummaryCards } from "./SummaryCards";
import { TodayTasks } from "./TodayTasks";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { mockWorkspaces, mockSchedules, mockInboxItems } from "../../storage/seeds/mockData";
import type { ScheduleItem } from "../../domain/schedule/types";
import { useWeather } from "../../shared/hooks/useWeather";
import { useAppContext } from "../../shared/hooks/useAppContext";
import { useScheduleStore } from "../../shared/hooks/useScheduleStore";

export function HomePage() {
  const { weather, status, refresh } = useWeather();
  const { openSettings } = useAppContext();
  const navigate = useNavigate();
  const { schedules, loading } = useScheduleStore(mockSchedules);

  const handleCreateSchedule = useCallback(() => {
    navigate("/schedule?create=1");
  }, [navigate]);

  const handleOpenSchedule = useCallback(
    (schedule?: ScheduleItem) => {
      navigate(schedule ? `/schedule?scheduleId=${encodeURIComponent(schedule.id)}` : "/schedule");
    },
    [navigate]
  );

  return (
    <div className="page-home">
      <div className="page-home__inner">
        <main className="home-grid">
          {/* Hero 卡: col 1, row 1-2 */}
          <div className="home-grid__hero">
            <MainCard weather={weather} weatherStatus={status} onRefresh={refresh} onOpenSettings={openSettings} />
          </div>

          {/* 4 张 mini-card: col 2-3, row 1-2 */}
          <SummaryCards
            schedules={schedules}
            workspaces={mockWorkspaces}
            inboxItems={mockInboxItems}
          />

          {/* 底部左: 待办 */}
          <div className="home-grid__tasks">
            <TodayTasks
              schedules={schedules}
              loading={loading}
              onCreateSchedule={handleCreateSchedule}
              onOpenSchedule={handleOpenSchedule}
            />
          </div>

          {/* 底部右: 总览 */}
          <div className="home-grid__ws">
            <WorkspaceOverview />
          </div>
        </main>
      </div>
    </div>
  );
}
