import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "../../shared/ui/GlassCard";

// ==================== 类型定义 ====================

interface Account {
  id: string;
  email: string;
  imapHost: string;
  imapPort: number;
  username: string;
  secure: boolean;
  displayName?: string;
  lastSyncedAt?: string;
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
  return data.data;
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
  return data.data;
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

// ==================== 组件 ====================

export function IntegrationsPage() {
  const { t } = useTranslation();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState<string | null>(null);

  // Async operation states
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null); // accountId being synced
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("integrations.loadFailed") || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
    } catch (err) {
      setTestResult({
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : t("integrations.testFailed") || "测试连接失败",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
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
      setShowForm(false);
      setForm({ ...DEFAULT_FORM });
      setTestResult(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("integrations.saveFailed") || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const updated = await deleteAccount(id);
      setAccounts(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("integrations.deleteFailed") || "删除失败");
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncAccount(accountId);
      setSyncResult(result);
      // Reload accounts to get updated lastSyncedAt
      await loadAccounts();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : t("integrations.syncFailed") || "同步失败");
    } finally {
      setSyncing(null);
    }
  };

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
            onClick={loadAccounts}
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
          {!showForm && (
            <button
              className="btn-primary"
              onClick={() => {
                setShowForm(true);
                setFormError(null);
                setTestResult(null);
                setForm({ ...DEFAULT_FORM });
              }}
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
          )}
        </div>

        {/* Account List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--color-text-muted)", fontSize: 13 }}>
            {t("integrations.loading") || "加载中..."}
          </div>
        ) : accounts.length === 0 && !showForm ? (
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
            {accounts.map((acc) => (
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
                      {acc.displayName || acc.email}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: acc.connected
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(245,158,11,0.1)",
                        color: acc.connected
                          ? "var(--color-success)"
                          : "var(--color-warning)",
                        border: `1px solid ${acc.connected ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
                      }}
                    >
                      {acc.connected ? t("settings.email.connected") : t("settings.email.notConnected")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {acc.email} · {acc.imapHost}:{acc.imapPort}
                    {acc.lastSyncedAt && (
                      <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>
                        {t("integrations.lastSync") || "上次同步"}: {new Date(acc.lastSyncedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
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
                  {syncing === acc.id ? t("integrations.syncing") || "同步中..." : t("settings.email.sync")}
                </button>

                <button
                  onClick={() => handleDelete(acc.id)}
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
            ))}
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div style={{
            marginTop: 12,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            fontSize: 13,
            color: "var(--color-text-secondary)",
          }}>
            ✅ {t("settings.email.syncSuccess", { count: syncResult.totalEmails })}
            {syncResult.messages.slice(0, 3).map((msg) => (
              <div key={msg.uid} style={{ marginTop: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
                {msg.seen ? "○" : "●"} {msg.from?.name || msg.from?.address} — {msg.subject || `(${t("integrations.noSubject") || "无主题"})`}
              </div>
            ))}
            {syncResult.messages.length > 3 && (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-text-muted)" }}>
                ...{t("integrations.moreEmails", { count: syncResult.messages.length - 3 }) || `还有 ${syncResult.messages.length - 3} 封`}
              </div>
            )}
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

        {/* Add Account Form */}
        {showForm && (
          <div style={{
            marginTop: 20,
            padding: "20px",
            borderRadius: 16,
            background: "var(--color-border-light)",
            border: "1px solid var(--color-border)",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--color-text)" }}>
              {t("settings.email.addAccount")}
            </h3>

            {/* Form Fields */}
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

            {/* Form Error */}
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

            {/* Test Result */}
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

            {/* Form Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
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

              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                  setTestResult(null);
                  setForm({ ...DEFAULT_FORM });
                }}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                {t("settings.email.cancel")}
              </button>
            </div>
          </div>
        )}
      </GlassCard>
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
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 13,
  outline: "none",
  transition: "border-color 180ms ease",
  boxSizing: "border-box",
};
