import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "../../shared/ui/GlassCard";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { useToast } from "../../shared/ui/ToastProvider";
import type { ExternalScheduleCandidate } from "../../domain/intake/types";
import {
  processPersistedExternalScheduleCandidates,
} from "../../shared/services/externalScheduleIntakeService";
import {
  getSystemCalendarStatus,
  requestSystemCalendarAccess,
  syncSystemCalendar,
  type SystemCalendarStatus,
} from "../../shared/services/systemCalendarService";
import { getSystemCalendarViewState } from "./system-calendar-view-state";
import { MAIL_WATCH_STATUS_CHANGED_EVENT } from "../../shared/hooks/useMailWatchSync";
import { formatDateTime } from "../../shared/utils/date";
import { emitScheduleReminderRefresh } from "../../shared/services/scheduleReminderService";
import { shouldShowBlockingAccountsLoading } from "./integrations-view-state";

// ==================== 类型定义 ====================

interface Account {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  secure: boolean;
  displayName?: string;
  authStatus: "connected" | "disconnected" | "error";
  syncStatus: "syncing" | "idle" | "error";
  lastSyncedAt?: string;
  lastSyncError?: string;
  createdAt: string;
  connected: boolean;
}

interface TestResult {
  success: boolean;
  connected: boolean;
  error?: string;
  folders?: Array<{ name: string; path: string }>;
}

interface SyncResult {
  accountId: string;
  totalEmails: number;
  messages: Array<{
    uid: number;
    subject?: string;
    from?: { name?: string; address: string };
    date: string;
    seen: boolean;
    hasAttachments: boolean;
    snippet: string;
  }>;
  candidates: ExternalScheduleCandidate[];
  lastSyncedAt: string;
}

// ==================== API helpers ====================

const API_BASE = "http://localhost:3001/api/email";

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch accounts");
  return data.data;
}

async function addAccount(fields: {
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  password: string;
  secure: boolean;
  displayName?: string;
}): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.success) throw new Error(data.error || "Failed to add account");
  return data.data;
}

async function deleteAccount(id: string): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.success) throw new Error(data.error || "Failed to delete account");
  return data.data;
}

async function testConnection(fields: {
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  password: string;
  secure: boolean;
}): Promise<TestResult> {
  const res = await fetch(`${API_BASE}/accounts/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  return {
    success: Boolean(data.success),
    connected: Boolean(data.data?.connected),
    error: data.data?.error,
    folders: data.data?.folders,
  };
}

async function syncAccount(accountId: string): Promise<SyncResult> {
  const res = await fetch(`${API_BASE}/accounts/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.success) throw new Error(data.error || "Sync failed");
  return data.data as SyncResult;
}

// ==================== 表单默认值 ====================

const DEFAULT_FORM = {
  email: "",
  imapHost: "",
  imapPort: "993",
  username: "",
  password: "",
  secure: true,
  displayName: "",
};

function getAccountAlias(account: Pick<Account, "displayName" | "email">): string | undefined {
  const alias = account.displayName?.trim();
  if (!alias) {
    return undefined;
  }

  return alias.toLowerCase() === account.email.trim().toLowerCase() ? undefined : alias;
}

function getAccountStatusLabel(account: Account, t: ReturnType<typeof useTranslation>["t"]): string {
  if (account.syncStatus === "syncing") {
    return t("integrations.syncing") || "同步中...";
  }
  if (account.authStatus === "error") {
    return t("integrations.watchError") || "监听异常";
  }
  if (account.authStatus === "connected") {
    return t("integrations.watching") || "监听中";
  }
  return t("settings.email.notConnected");
}

function getAccountStatusStyle(account: Account): CSSProperties {
  if (account.syncStatus === "syncing") {
    return {
      background: "var(--color-warning-soft)",
      color: "var(--color-warning)",
      border: "1px solid color-mix(in srgb, var(--color-warning) 24%, transparent)",
    };
  }
  if (account.authStatus === "error") {
    return {
      background: "var(--color-error-soft)",
      color: "var(--color-error)",
      border: "1px solid color-mix(in srgb, var(--color-error) 24%, transparent)",
    };
  }
  if (account.authStatus === "connected") {
    return {
      background: "var(--color-success-soft)",
      color: "var(--color-success)",
      border: "1px solid color-mix(in srgb, var(--color-success) 24%, transparent)",
    };
  }
  return {
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    border: "1px solid color-mix(in srgb, var(--color-warning) 24%, transparent)",
  };
}

function getStatusBadgeStyle(
  tone: "success" | "warning" | "error" | "neutral",
): CSSProperties {
  if (tone === "success") {
    return {
      background: "var(--color-success-soft)",
      color: "var(--color-success)",
      border: "1px solid color-mix(in srgb, var(--color-success) 24%, transparent)",
    };
  }
  if (tone === "error") {
    return {
      background: "var(--color-error-soft)",
      color: "var(--color-error)",
      border: "1px solid color-mix(in srgb, var(--color-error) 24%, transparent)",
    };
  }
  if (tone === "neutral") {
    return {
      background: "var(--color-border-light)",
      color: "var(--color-text-secondary)",
      border: "1px solid var(--color-border)",
    };
  }
  return {
    background: "var(--color-warning-soft)",
    color: "var(--color-warning)",
    border: "1px solid color-mix(in srgb, var(--color-warning) 24%, transparent)",
  };
}

// ==================== 组件 ====================

export function IntegrationsPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemCalendarStatus, setSystemCalendarStatus] = useState<SystemCalendarStatus | null>(null);
  const [systemCalendarLoading, setSystemCalendarLoading] = useState(true);
  const [systemCalendarError, setSystemCalendarError] = useState<string | null>(null);
  const [systemCalendarBusyAction, setSystemCalendarBusyAction] = useState<"connect" | "sync" | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState<string | null>(null);

  // Async operation states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null); // accountId being synced
  const [syncError, setSyncError] = useState<string | null>(null);
  const [accountPendingDelete, setAccountPendingDelete] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : t("integrations.loadFailed") || "加载失败");
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [t]);

  const loadSystemCalendar = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background === true;
    if (!background) {
      setSystemCalendarLoading(true);
      setSystemCalendarError(null);
    }

    try {
      const status = await getSystemCalendarStatus();
      setSystemCalendarStatus(status);
    } catch (err) {
      if (!background) {
        setSystemCalendarError(
          err instanceof Error ? err.message : t("integrations.loadFailed") || "加载失败",
        );
      }
    } finally {
      if (!background) {
        setSystemCalendarLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadSystemCalendar();
  }, [loadSystemCalendar]);

  useEffect(() => {
    const handleStatusChanged = () => {
      void loadAccounts({ background: true });
    };

    window.addEventListener(MAIL_WATCH_STATUS_CHANGED_EVENT, handleStatusChanged as EventListener);
    return () => {
      window.removeEventListener(MAIL_WATCH_STATUS_CHANGED_EVENT, handleStatusChanged as EventListener);
    };
  }, [loadAccounts]);

  const resetFormState = useCallback(() => {
    setForm({ ...DEFAULT_FORM });
    setFormError(null);
    setTestResult(null);
  }, []);

  const handleOpenForm = useCallback(() => {
    resetFormState();
    setSyncError(null);
    setShowForm(true);
  }, [resetFormState]);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    resetFormState();
  }, [resetFormState]);

  // Auto-fill username when email changes
  const handleEmailChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      email: value,
      username: prev.username || value, // auto-fill username if empty
    }));
  };

  const handleTestConnection = async () => {
    if (!form.email || !form.imapHost || !form.imapPort || !form.password) {
      setFormError(t("integrations.fillRequired") || "请填写邮箱、IMAP 服务器、端口和密码");
      return;
    }
    setFormError(null);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        email: form.email,
        imapHost: form.imapHost,
        imapPort: Number(form.imapPort),
        username: form.username,
        password: form.password,
        secure: form.secure,
      });
      setTestResult(result);
      if (result.success) {
        toast.success(t("feedback.emailConnectionSuccess"));
      } else {
        toast.error(t("feedback.emailConnectionFailed"), result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("integrations.testFailed") || "测试连接失败";
      setTestResult({
        success: false,
        connected: false,
        error: message,
      });
      toast.error(t("feedback.emailConnectionFailed"), message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!form.email || !form.imapHost || !form.imapPort || !form.password) {
      setFormError(t("integrations.fillAllFields") || "请填写所有必填字段");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const updated = await addAccount({
        email: form.email,
        imapHost: form.imapHost,
        imapPort: Number(form.imapPort),
        username: form.username,
        password: form.password,
        secure: form.secure,
        displayName: form.displayName,
      });
      setAccounts(updated);
      handleCloseForm();
      toast.success(t("feedback.emailAccountSaved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("integrations.saveFailed") || "保存失败";
      setFormError(message);
      toast.error(t("feedback.emailAccountSaveFailed"), message);
    } finally {
      setSaving(false);
    }
  }, [form, handleCloseForm, t, toast]);

  const handleRequestDelete = useCallback((account: Account) => {
    setError(null);
    setAccountPendingDelete(account);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletingAccountId) {
      return;
    }

    setAccountPendingDelete(null);
  }, [deletingAccountId]);

  const handleDelete = useCallback(async () => {
    if (!accountPendingDelete) {
      return;
    }

    try {
      setDeletingAccountId(accountPendingDelete.id);
      setSyncError(null);
      const updated = await deleteAccount(accountPendingDelete.id);
      setAccounts(updated);
      setAccountPendingDelete(null);
      toast.success(t("feedback.emailAccountDeleted"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("integrations.deleteFailed") || "删除失败";
      setError(message);
      toast.error(t("feedback.emailAccountDeleteFailed"), message);
    } finally {
      setDeletingAccountId(null);
    }
  }, [accountPendingDelete, t, toast]);

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    setSyncError(null);
    try {
      const result = await syncAccount(accountId);
      await processPersistedExternalScheduleCandidates({ candidateIds: result.candidates.map((candidate) => candidate.id) });
      // Reload accounts to get updated lastSyncedAt
      await loadAccounts();
      toast.success(t("feedback.emailSyncSuccess"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("integrations.syncFailed") || "同步失败";
      setSyncError(message);
      toast.error(t("feedback.emailSyncFailed"), message);
    } finally {
      setSyncing(null);
    }
  };

  const handleConnectSystemCalendar = useCallback(async () => {
    setSystemCalendarBusyAction("connect");
    setSystemCalendarError(null);

    try {
      const status = await requestSystemCalendarAccess();
      setSystemCalendarStatus(status);

      if (status.authStatus === "connected") {
        toast.success(t("feedback.systemCalendarConnected"));
      } else {
        const message =
          status.lastSyncError ??
          t("integrations.systemCalendar.errorDescription") ??
          t("feedback.systemCalendarConnectFailed");
        setSystemCalendarError(message);
        toast.error(t("feedback.systemCalendarConnectFailed"), message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("feedback.systemCalendarConnectFailed");
      setSystemCalendarError(message);
      toast.error(t("feedback.systemCalendarConnectFailed"), message);
    } finally {
      setSystemCalendarBusyAction(null);
    }
  }, [t, toast]);

  const handleSyncSystemCalendar = useCallback(async () => {
    setSystemCalendarBusyAction("sync");
    setSystemCalendarError(null);

    try {
      const status = await syncSystemCalendar();
      setSystemCalendarStatus(status);
      emitScheduleReminderRefresh();

      if (status.authStatus === "connected" && status.syncStatus === "idle" && !status.lastSyncError) {
        toast.success(t("feedback.systemCalendarSynced"));
      } else {
        const message =
          status.lastSyncError ??
          t("integrations.systemCalendar.errorDescription") ??
          t("feedback.systemCalendarSyncFailed");
        setSystemCalendarError(message);
        toast.error(t("feedback.systemCalendarSyncFailed"), message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("feedback.systemCalendarSyncFailed");
      setSystemCalendarError(message);
      toast.error(t("feedback.systemCalendarSyncFailed"), message);
    } finally {
      setSystemCalendarBusyAction(null);
    }
  }, [t, toast]);

  const resolvedSystemCalendarStatus =
    systemCalendarStatus ?? {
      available: false,
      authStatus: "disconnected" as const,
      syncStatus: "idle" as const,
      lastSyncedAt: null,
      lastSyncError: null,
    };
  const systemCalendarViewState = getSystemCalendarViewState(resolvedSystemCalendarStatus);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "8px 0 24px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <p className="panel-eyebrow">{t("integrations.appSettings")}</p>
        <h1 className="panel-title" style={{ fontSize: 26 }}>{t("integrations.title")}</h1>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "10px 16px",
          borderRadius: 12,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "var(--color-error)",
          fontSize: 13,
          marginBottom: 16,
        }}>
          {error}
          <button
            onClick={() => {
              void loadAccounts();
            }}
            style={{ marginLeft: 12, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 13 }}
          >
            {t("integrations.retry") || "重试"}
          </button>
        </div>
      )}

      {/* Email Accounts Card */}
      <GlassCard className="card" style={{ padding: 24 }}>
        <div className="panel-head" style={{ marginBottom: 16 }}>
          <div>
            <p className="panel-eyebrow">{t("settings.email.title")}</p>
            <h2 className="panel-title">{t("integrations.title")}</h2>
          </div>
          <button
            className="btn-primary"
            onClick={handleOpenForm}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            + {t("settings.email.addAccount")}
          </button>
        </div>

        {/* Account List */}
        {shouldShowBlockingAccountsLoading(loading, accounts.length) ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-muted)", fontSize: 13 }}>
            {t("integrations.loading") || "加载中..."}
          </div>
        ) : accounts.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "32px 0",
            color: "var(--color-text-muted)",
            fontSize: 13,
            border: "1px dashed var(--color-border)",
            borderRadius: 16,
          }}>
            {t("settings.email.noAccounts")}<br />
            <span style={{ fontSize: 12 }}>{t("integrations.clickToAdd") || "点击上方「添加邮箱账号」开始配置"}</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {accounts.map((acc) => {
              const alias = getAccountAlias(acc);

              return (
                <div
                  key={acc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 14,
                    background: "var(--color-border-light)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {/* Email info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
                        {alias ?? acc.email}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "2px 8px",
                          borderRadius: 999,
                          ...getAccountStatusStyle(acc),
                        }}
                      >
                        {getAccountStatusLabel(acc, t)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {acc.email} · {acc.imapHost}:{acc.imapPort}
                      {acc.lastSyncedAt && (
                        <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>
                          {t("integrations.lastSync") || "上次同步"}: {formatDateTime(acc.lastSyncedAt)}
                        </span>
                      )}
                    </div>
                    {acc.lastSyncError && (acc.authStatus === "error" || acc.syncStatus === "error") && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-error)" }}>
                        {acc.lastSyncError}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleSync(acc.id)}
                    disabled={syncing === acc.id}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      borderRadius: 999,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: syncing === acc.id ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                      cursor: syncing === acc.id ? "not-allowed" : "pointer",
                      transition: "all 180ms ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {syncing === acc.id
                      ? t("integrations.syncing") || "同步中..."
                      : t("integrations.manualCheck") || "立即检查"}
                  </button>

                  <button
                    onClick={() => handleRequestDelete(acc)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      background: "transparent",
                      color: "var(--color-text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      transition: "all 180ms ease",
                    }}
                    title={t("settings.email.delete")}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                      e.currentTarget.style.color = "var(--color-error)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--color-text-muted)";
                      e.currentTarget.style.borderColor = "var(--color-border)";
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Sync Error */}
        {syncError && (
          <div style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            fontSize: 13,
            color: "var(--color-error)",
          }}>
            {t("integrations.syncFailed") || "同步失败"}: {syncError}
          </div>
        )}

      </GlassCard>

      <GlassCard className="card" style={{ padding: 24, marginTop: 16 }}>
        <div className="panel-head" style={{ marginBottom: 16 }}>
          <div>
            <p className="panel-eyebrow">{t("integrations.systemCalendar.title")}</p>
            <h2 className="panel-title">{t("integrations.systemCalendar.title")}</h2>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 999,
              ...getStatusBadgeStyle(systemCalendarViewState.badgeTone),
            }}
          >
            {t(systemCalendarViewState.statusLabelKey)}
          </span>
        </div>

        {systemCalendarLoading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-muted)", fontSize: 13 }}>
            {t("integrations.loading") || "加载中..."}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "16px 18px",
              borderRadius: 16,
              background: "var(--color-border-light)",
              border: "1px solid var(--color-border)",
            }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
              {t(systemCalendarViewState.helperTextKey)}
            </p>

            {resolvedSystemCalendarStatus.lastSyncedAt && (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {t("integrations.lastSync") || "上次同步"}: {formatDateTime(resolvedSystemCalendarStatus.lastSyncedAt)}
              </div>
            )}

            {(systemCalendarError ||
              (systemCalendarViewState.showErrorText && resolvedSystemCalendarStatus.lastSyncError)) && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--color-error-soft)",
                  border: "1px solid color-mix(in srgb, var(--color-error) 18%, transparent)",
                  color: "var(--color-error)",
                  fontSize: 12,
                }}
              >
                {systemCalendarError ?? resolvedSystemCalendarStatus.lastSyncError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  void handleConnectSystemCalendar();
                }}
                disabled={!systemCalendarViewState.connectEnabled || systemCalendarBusyAction !== null}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor:
                    !systemCalendarViewState.connectEnabled || systemCalendarBusyAction !== null
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !systemCalendarViewState.connectEnabled || systemCalendarBusyAction !== null ? 0.6 : 1,
                }}
              >
                {systemCalendarBusyAction === "connect"
                  ? t("integrations.syncing") || "同步中..."
                  : t("integrations.systemCalendar.connectAction")}
              </button>

              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  void handleSyncSystemCalendar();
                }}
                disabled={!systemCalendarViewState.syncEnabled || systemCalendarBusyAction !== null}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor:
                    !systemCalendarViewState.syncEnabled || systemCalendarBusyAction !== null
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !systemCalendarViewState.syncEnabled || systemCalendarBusyAction !== null ? 0.65 : 1,
                }}
              >
                {systemCalendarBusyAction === "sync"
                  ? t("integrations.syncing") || "同步中..."
                  : t("integrations.systemCalendar.syncAction")}
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative w-full max-w-[560px] overflow-hidden rounded-2xl"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-xl)",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div>
                  <p className="panel-eyebrow">{t("settings.email.title")}</p>
                  <h3 className="panel-title" style={{ fontSize: 18 }}>
                    {t("settings.email.addAccount")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  aria-label={t("common.close")}
                  className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors"
                  style={{
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <FormField
                    label={t("settings.email.emailAddress")}
                    required
                    hint={t("integrations.emailHint") || "如: your-email@163.com"}
                  >
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="your-email@163.com"
                      style={inputStyle}
                    />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                    <FormField label={t("settings.email.imapServer")} required hint={t("integrations.imapHint") || "如: imap.163.com"}>
                      <input
                        type="text"
                        value={form.imapHost}
                        onChange={(e) => setForm((p) => ({ ...p, imapHost: e.target.value }))}
                        placeholder="imap.163.com"
                        style={inputStyle}
                      />
                    </FormField>
                    <FormField label={t("settings.email.port")} required>
                      <input
                        type="number"
                        value={form.imapPort}
                        onChange={(e) => setForm((p) => ({ ...p, imapPort: e.target.value }))}
                        placeholder="993"
                        style={{ ...inputStyle, width: "100%" }}
                      />
                    </FormField>
                  </div>

                  <FormField label={t("settings.email.username")} hint={t("integrations.usernameHint") || "通常同邮箱地址，留空则同邮箱"}>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder={form.email || "your-email@163.com"}
                      style={inputStyle}
                    />
                  </FormField>

                  <FormField label={t("settings.email.password")} required hint={t("integrations.passwordHint") || "邮箱的 IMAP 专用密码，非登录密码"}>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder={t("integrations.enterAuthCode") || "请输入授权码"}
                      style={inputStyle}
                    />
                  </FormField>

                  <FormField label={t("settings.email.displayName")} hint={t("integrations.displayNameHint") || "可选，如: 我的 163 邮箱"}>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                      placeholder={t("integrations.optional") || "可选"}
                      style={inputStyle}
                    />
                  </FormField>
                </div>

                {formError && (
                  <div style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "var(--color-error)",
                    fontSize: 12,
                  }}>
                    {formError}
                  </div>
                )}

                {testResult && (
                  <div style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: testResult.success
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(239,68,68,0.08)",
                    border: `1px solid ${testResult.success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    color: testResult.success ? "var(--color-success)" : "var(--color-error)",
                    fontSize: 12,
                  }}>
                    {testResult.success
                      ? `✅ ${t("settings.email.testSuccess")} ${t("integrations.foldersFound", { count: testResult.folders?.length ?? 0 }) || `发现 ${testResult.folders?.length ?? 0} 个文件夹`}`
                      : `❌ ${t("settings.email.testFailed", { error: testResult.error || "" })}`}
                  </div>
                )}
              </div>

              <div
                className="flex items-center justify-end gap-2 px-4 py-3"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="btn-secondary"
                  style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500 }}
                >
                  {t("settings.email.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTestConnection}
                  disabled={testing}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: testing ? "not-allowed" : "pointer",
                    opacity: testing ? 0.6 : 1,
                  }}
                >
                  {testing ? t("integrations.testing") || "测试中..." : t("settings.email.testConnection")}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    border: "none",
                  }}
                >
                  {saving ? t("integrations.saving") || "保存中..." : t("settings.email.save")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GlassCard className="card" style={{ padding: 24, marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <p className="panel-eyebrow">{t("integrations.ai.eyebrow")}</p>
            <h2 className="panel-title">{t("integrations.ai.title")}</h2>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
            {t("integrations.ai.description")}
          </p>
        </div>
      </GlassCard>

      <ConfirmDialog
        open={Boolean(accountPendingDelete)}
        title={t("integrations.confirmDeleteAccountTitle") || "删除邮箱账号"}
        description={
          accountPendingDelete
            ? t("integrations.confirmDeleteAccountDescription", {
                name: getAccountAlias(accountPendingDelete) ?? accountPendingDelete.email,
              }) || `确认删除“${getAccountAlias(accountPendingDelete) ?? accountPendingDelete.email}”吗？删除后将移除这个邮箱账号及其同步状态。`
            : undefined
        }
        confirmLabel={t("common.delete")}
        confirming={Boolean(deletingAccountId)}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ==================== 小组件 ====================

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>
          {label}
          {required && <span style={{ color: "var(--color-error)", marginLeft: 2 }}>*</span>}
        </label>
        {hint && (
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>({hint})</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 13,
  outline: "none",
  transition: "border-color 180ms ease",
  boxSizing: "border-box",
};
