export type WorkspaceType = "code" | "image" | "writing" | "general";

export type WorkspaceStatus = "active" | "pending" | "archived";

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description: string;
  color: string;
  status: WorkspaceStatus;
  focusLevel: number;
  linkedMailAccountIds: string[];
  linkedCalendarIds: string[];
  linkedFolderPaths: string[];
  goals: string[];
  smartSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceTypeConfig {
  id: string;
  code: WorkspaceType;
  name: string;
  defaultModules: string[];
  routingRules: RoutingRule[];
  icon: string;
}

export interface RoutingRule {
  id: string;
  keywords: string[];
  workspaceType: WorkspaceType;
  priority: number;
}

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  type: "task" | "email" | "schedule" | "file";
  title: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
