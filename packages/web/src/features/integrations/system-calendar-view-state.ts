import type { SystemCalendarStatus } from "../../shared/services/systemCalendarService";

export interface SystemCalendarViewState {
  badgeTone: "success" | "warning" | "error" | "neutral";
  statusLabelKey: string;
  helperTextKey: string;
  connectEnabled: boolean;
  syncEnabled: boolean;
  actionKey: string;
  showErrorText: boolean;
}

export function getSystemCalendarViewState(
  status: SystemCalendarStatus,
): SystemCalendarViewState {
  if (!status.available) {
    return {
      badgeTone: "neutral",
      statusLabelKey: "integrations.systemCalendar.unavailableStatus",
      helperTextKey: "integrations.systemCalendar.unavailableDescription",
      connectEnabled: false,
      syncEnabled: false,
      actionKey: "integrations.systemCalendar.unavailableAction",
      showErrorText: false,
    };
  }

  if (status.syncStatus === "syncing") {
    return {
      badgeTone: "warning",
      statusLabelKey: "integrations.systemCalendar.syncingStatus",
      helperTextKey: "integrations.systemCalendar.availableDescription",
      connectEnabled: false,
      syncEnabled: false,
      actionKey: "integrations.systemCalendar.syncAction",
      showErrorText: false,
    };
  }

  if (status.authStatus === "error" || status.syncStatus === "error") {
    return {
      badgeTone: "error",
      statusLabelKey: "integrations.systemCalendar.errorStatus",
      helperTextKey: "integrations.systemCalendar.errorDescription",
      connectEnabled: true,
      syncEnabled: status.authStatus === "connected",
      actionKey:
        status.authStatus === "connected"
          ? "integrations.systemCalendar.syncAction"
          : "integrations.systemCalendar.connectAction",
      showErrorText: true,
    };
  }

  if (status.authStatus === "connected") {
    return {
      badgeTone: "success",
      statusLabelKey: "integrations.systemCalendar.connectedStatus",
      helperTextKey: "integrations.systemCalendar.availableDescription",
      connectEnabled: false,
      syncEnabled: true,
      actionKey: "integrations.systemCalendar.syncAction",
      showErrorText: false,
    };
  }

  return {
    badgeTone: "warning",
    statusLabelKey: "integrations.systemCalendar.disconnectedStatus",
    helperTextKey: "integrations.systemCalendar.availableDescription",
    connectEnabled: true,
    syncEnabled: false,
    actionKey: "integrations.systemCalendar.connectAction",
    showErrorText: false,
  };
}
