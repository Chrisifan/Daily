/**
 * 邮箱服务入口示例
 * 演示如何配置 IMAP 账户、连接、搜索和拉取邮件
 *
 * 运行前请先设置环境变量，例如：
 *   export MAIL_EXAMPLE_GMAIL_APP_PASSWORD="your-app-password"
 *   export MAIL_EXAMPLE_OUTLOOK_APP_PASSWORD="your-app-password"
 */

import * as path from "path";
import { createMailAccountManager, generateExampleConfig } from "./mail-account.js";
import { createEmailSyncService, testAccountConnection } from "./email-sync-service.js";
import { EmailSyncOptions } from "./email-sync-service.js";
import { ImapConnector, createImapConnector } from "./imap-connector.js";

// ==================== 示例 1：基本同步流程 ====================

/**
 * 基本同步示例：配置账户并拉取最新邮件
 */
async function basicSyncDemo() {
  console.log("\n========== 基本同步示例 ==========\n");

  // 1. 确定配置文件路径
  const configPath = path.join(process.cwd(), "config", "mail-accounts.json");

  // 2. 创建账户管理器
  const accountManager = createMailAccountManager(configPath, {
    passwordEnvPrefix: "MAIL_",
    autoLoad: true,
  });

  // 3. 等待配置加载
  await new Promise((r) => setTimeout(r, 500));

  // 4. 查看已配置的账户
  const accounts = accountManager.getAccounts();
  console.log(`已配置 ${accounts.length} 个账户:`);
  for (const acc of accounts) {
    console.log(`  - ${acc.displayName ?? acc.email} (${acc.id})`);
    console.log(`    服务器: ${acc.imapHost}:${acc.imapPort}`);
    console.log(`    上次同步: ${acc.lastSyncedAt ?? "从未同步"}`);
  }

  if (accounts.length === 0) {
    console.log("\n没有配置任何账户，请先创建配置文件。");
    console.log("示例配置:");
    console.log(generateExampleConfig());
    return;
  }

  // 5. 创建同步服务
  const syncService = createEmailSyncService(accountManager, {
    convertHtmlToText: true,
    parseCalendarInvites: true,
  });

  // 6. 同步第一个账户
  const firstAccount = accounts[0];
  console.log(`\n开始同步账户: ${firstAccount.email}...`);

  const syncOptions: EmailSyncOptions = {
    type: "incremental",
    incrementalDays: 7,
    incrementalUnreadOnly: false,
    maxMessagesPerSync: 10,
  };

  try {
    const result = await syncService.syncAccount(firstAccount.id, syncOptions);

    console.log("\n同步完成！");
    console.log(`  总邮件数: ${result.stats.totalFetched}`);
    console.log(`  新邮件: ${result.stats.newMessages}`);
    console.log(`  解析失败: ${result.stats.parseErrors}`);
    console.log(`  日历事件: ${result.stats.icsEventsFound}`);
    console.log(`  耗时: ${result.stats.completedAt && result.stats.startedAt
      ? `${new Date(result.stats.completedAt).getTime() - new Date(result.stats.startedAt).getTime()}ms`
      : "未知"
    }`);

    // 7. 打印邮件摘要
    if (result.messages.length > 0) {
      console.log("\n最新邮件:");
      for (const msg of result.messages.slice(0, 5)) {
        console.log(`  [${msg.seen ? "已读" : "未读"}] ${msg.from?.name ?? msg.from?.address ?? "未知"}`);
        console.log(`    主题: ${msg.subject ?? "(无主题)"}`);
        console.log(`    时间: ${msg.date.toLocaleString("zh-CN")}`);
        if (msg.hasAttachments) {
          console.log(`    附件: ${msg.attachments.length} 个`);
        }
        if (msg.icsEvents && msg.icsEvents.length > 0) {
          console.log(`    日历事件: ${msg.icsEvents.length} 个`);
        }
        console.log("");
      }
    }

    // 8. 断开连接
    await syncService.disconnectAll();
    console.log("同步流程结束。\n");
  } catch (err) {
    console.error("同步失败:", err);
  }
}

// ==================== 示例 2：测试账户连接 ====================

/**
 * 测试账户连接示例
 */
async function testConnectionDemo() {
  console.log("\n========== 连接测试示例 ==========\n");

  const configPath = path.join(process.cwd(), "config", "mail-accounts.json");
  const accountManager = createMailAccountManager(configPath);
  await new Promise((r) => setTimeout(r, 500));

  const accounts = accountManager.getAccounts();

  for (const account of accounts) {
    console.log(`测试账户: ${account.email}...`);
    const result = await testAccountConnection(accountManager, account.id);

    if (result.success) {
      console.log(`  ✓ 连接成功！`);
      if (result.folders) {
        console.log(`  文件夹数量: ${result.folders.length}`);
      }
    } else {
      console.log(`  ✗ 连接失败: ${result.error}`);
    }
    console.log("");
  }
}

// ==================== 示例 3：高级搜索 ====================

/**
 * 高级搜索示例：按发件人、日期、未读状态等条件搜索
 */
async function advancedSearchDemo() {
  console.log("\n========== 高级搜索示例 ==========\n");

  // 手动创建连接配置（不通过配置文件）
  const config = {
    host: process.env.MAIL_TEST_HOST ?? "imap.example.com",
    port: parseInt(process.env.MAIL_TEST_PORT ?? "993", 10),
    user: process.env.MAIL_TEST_USER ?? "test@example.com",
    password: process.env.MAIL_TEST_PASSWORD ?? "",
    secure: true,
    connectionTimeout: 30000,
    heartbeatInterval: 300000,
    maxReconnectAttempts: 3,
    reconnectDelay: 3000,
  };

  if (!config.password) {
    console.log("请设置环境变量 MAIL_TEST_PASSWORD 后重试。\n");
    return;
  }

  const connector = new ImapConnector(config);

  try {
    console.log("连接到服务器...");
    await connector.connect();
    await connector.authenticate();

    // 搜索条件示例
    const searchResults = await connector.searchEmails({
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近 7 天
      unread: false,
      limit: 20,
    });

    console.log(`找到 ${searchResults.length} 封符合条件的邮件`);
    console.log(`UID 列表: ${searchResults.map((r) => r.uid).join(", ")}`);

    // 获取前 3 封邮件的摘要
    if (searchResults.length > 0) {
      const sampleUids = searchResults.slice(0, 3).map((r) => r.uid);
      const emails = await connector.fetchEmails(sampleUids);

      console.log("\n邮件预览:");
      for (const email of emails) {
        console.log(`\n  主题: ${email.subject}`);
        console.log(`  发件人: ${email.from?.name ?? ""} <${email.from?.address ?? ""}>`);
        console.log(`  时间: ${email.date.toLocaleString("zh-CN")}`);
        console.log(`  摘要: ${email.body.text?.slice(0, 100).replace(/\n/g, " ")}...`);
      }
    }

    await connector.disconnect();
  } catch (err) {
    console.error("搜索失败:", err);
  }
}

// ==================== 示例 4：按需获取单封邮件正文 ====================

/**
 * 按需获取邮件正文示例
 */
async function fetchSingleEmailDemo() {
  console.log("\n========== 按需获取单封邮件示例 ==========\n");

  const configPath = path.join(process.cwd(), "config", "mail-accounts.json");
  const accountManager = createMailAccountManager(configPath);
  await new Promise((r) => setTimeout(r, 500));

  const accounts = accountManager.getAccounts();
  if (accounts.length === 0) {
    console.log("没有已配置的账户。\n");
    return;
  }

  const syncService = createEmailSyncService(accountManager);
  const account = accounts[0];

  // 先搜索找到邮件
  const connector = new ImapConnector(
    accountManager.getConnectorConfig(account.id)
  );

  try {
    await connector.connect();
    await connector.authenticate();

    // 搜索最新 5 封邮件
    const results = await connector.searchEmails({ limit: 5 });

    if (results.length === 0) {
      console.log("收件箱为空。");
      return;
    }

    // 获取第一封邮件的完整内容
    const uid = results[0].uid;
    console.log(`获取邮件 UID ${uid} 的完整内容...`);

    const email = await connector.fetchEmail(uid);
    console.log(`\n主题: ${email.subject}`);
    console.log(`发件人: ${email.from?.name ?? ""} <${email.from?.address ?? ""}>`);
    console.log(`时间: ${email.date.toLocaleString("zh-CN")}`);
    console.log(`附件数量: ${email.attachments.length}`);

    if (email.attachments.length > 0) {
      console.log("\n附件列表:");
      for (const att of email.attachments) {
        console.log(`  - ${att.filename} (${att.contentType}, ${att.size} bytes)`);
        if (att.isCalendarInvite) {
          console.log(`    [日历邀请]`);
        }
      }
    }

    if (email.icsEvents && email.icsEvents.length > 0) {
      console.log("\n日历事件:");
      for (const event of email.icsEvents) {
        console.log(`  标题: ${event.summary}`);
        console.log(`  开始: ${event.start.toLocaleString("zh-CN")}`);
        if (event.end) {
          console.log(`  结束: ${event.end.toLocaleString("zh-CN")}`);
        }
        if (event.location) {
          console.log(`  地点: ${event.location}`);
        }
      }
    }

    console.log(`\n正文（纯文本，前 300 字）:`);
    console.log("---");
    console.log(email.body.text?.slice(0, 300).replace(/\n/g, "\n") ?? "(无正文)");
    console.log("---\n");

    await connector.disconnect();
    await syncService.disconnectAll();
  } catch (err) {
    console.error("获取邮件失败:", err);
  }
}

// ==================== 入口 ====================

/**
 * 运行所有示例
 */
async function runAllDemos() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║     IMAP 邮箱服务 - 功能演示                     ║");
  console.log("╚════════════════════════════════════════════════╝");

  // 示例 1：基本同步（必须先运行，建立基础数据）
  await basicSyncDemo();

  // 示例 2：测试连接（可选）
  // await testConnectionDemo();

  // 示例 3：高级搜索（需要配置测试环境变量）
  // await advancedSearchDemo();

  // 示例 4：按需获取单封邮件（可选）
  // await fetchSingleEmailDemo();
}

// 根据命令行参数选择运行的示例
const args = process.argv.slice(2);
const demoName = args[0] ?? "basic";

async function runDemo() {
  switch (demoName) {
    case "basic":
      await basicSyncDemo();
      break;
    case "test":
      await testConnectionDemo();
      break;
    case "search":
      await advancedSearchDemo();
      break;
    case "single":
      await fetchSingleEmailDemo();
      break;
    case "all":
      await runAllDemos();
      break;
    default:
      console.log(`未知示例: ${demoName}`);
      console.log("可用示例: basic, test, search, single, all");
  }
}

runDemo().catch(console.error);

// 导出模块供外部使用
export {
  basicSyncDemo,
  testConnectionDemo,
  advancedSearchDemo,
  fetchSingleEmailDemo,
  runAllDemos,
};
