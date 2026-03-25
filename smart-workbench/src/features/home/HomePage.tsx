import { MainCard } from "./MainCard";
import { SummaryCards } from "./SummaryCards";
import { TodayTasks } from "./TodayTasks";
import { WorkspaceOverview } from "./WorkspaceOverview";
import { AppNav } from "../../app/layout/AppNav";
import { mockWorkspaces, mockSchedules, mockInboxItems } from "../../storage/seeds/mockData";
import { useWeather } from "../../shared/hooks/useWeather";

export function HomePage() {
  const { weather, status, refresh } = useWeather();
  return (
    <div className="page-home">
      <div className="page-home__inner">
        <AppNav />

        <main className="home-grid">
          {/* Hero 卡: col 1, row 1-2 */}
          <div className="home-grid__hero">
            <MainCard weather={weather} weatherStatus={status} onRefresh={refresh} />
          </div>

          {/* 4 张 mini-card: col 2-3, row 1-2 */}
          <SummaryCards
            schedules={mockSchedules}
            workspaces={mockWorkspaces}
            inboxItems={mockInboxItems}
          />

          {/* 底部左: 待办 */}
          <div className="home-grid__tasks">
            <TodayTasks />
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
