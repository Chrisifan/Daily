import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// 检查环境变量
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("Warning: OPENAI_API_KEY not set. AI features will use mock responses.");
}

// 初始化模型
const model = apiKey 
  ? new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.3,
      apiKey,
    })
  : null;

// 邮件工作区归类输出格式
const emailClassificationSchema = z.object({
  workspaceType: z.enum(["code", "image", "writing", "general"]).describe("推荐的工作区类型"),
  confidence: z.number().min(0).max(1).describe("置信度"),
  reason: z.string().describe("归类理由"),
  suggestedActions: z.array(z.enum(["schedule", "task", "review", "note"])).describe("建议操作"),
});

const emailClassificationParser = StructuredOutputParser.fromZodSchema(emailClassificationSchema);

// 邮件归类提示词
const emailClassificationPrompt = PromptTemplate.fromTemplate(`
分析以下邮件内容，判断它最适合归类到哪个工作区类型。

工作区类型说明：
- code: 代码相关，如开发任务、bug修复、code review、API联调、技术会议
- image: 图片处理相关，如设计稿、修图、素材整理、视觉评审
- writing: 写作相关，如文章、文案、提纲、周报、调研整理
- general: 通用事务，如行政、个人安排、跨类型任务

邮件主题: {subject}
邮件发件人: {from}
邮件摘要: {summary}

{format_instructions}
`);

// 工作区摘要输出格式
const workspaceSummarySchema = z.object({
  summary: z.string().describe("工作区进展摘要"),
  completed: z.array(z.string()).describe("已完成事项"),
  inProgress: z.array(z.string()).describe("进行中事项"),
  blockers: z.array(z.string()).describe("阻塞事项"),
  nextSteps: z.array(z.string()).describe("下一步建议"),
});

const workspaceSummaryParser = StructuredOutputParser.fromZodSchema(workspaceSummarySchema);

// 工作区摘要提示词
const workspaceSummaryPrompt = PromptTemplate.fromTemplate(`
根据以下工作区信息，生成一份智能摘要报告。

工作区名称: {workspaceName}
工作区类型: {workspaceType}
工作区描述: {description}

近期任务:
{tasks}

近期日程:
{schedules}

{format_instructions}
`);

// 邮件归类函数
export async function classifyEmail(
  subject: string,
  from: string,
  summary: string
): Promise<z.infer<typeof emailClassificationSchema>> {
  if (!model) {
    // 模拟响应
    return mockClassifyEmail(subject, from, summary);
  }

  const chain = emailClassificationPrompt.pipe(model).pipe(emailClassificationParser);

  const result = await chain.invoke({
    subject,
    from,
    summary,
    format_instructions: emailClassificationParser.getFormatInstructions(),
  });

  return result;
}

// 工作区摘要函数
export async function generateWorkspaceSummary(
  workspaceName: string,
  workspaceType: string,
  description: string,
  tasks: string[],
  schedules: string[]
): Promise<z.infer<typeof workspaceSummarySchema>> {
  if (!model) {
    // 模拟响应
    return mockWorkspaceSummary(workspaceName, workspaceType, description, tasks, schedules);
  }

  const chain = workspaceSummaryPrompt.pipe(model).pipe(workspaceSummaryParser);

  const result = await chain.invoke({
    workspaceName,
    workspaceType,
    description,
    tasks: tasks.join("\n"),
    schedules: schedules.join("\n"),
    format_instructions: workspaceSummaryParser.getFormatInstructions(),
  });

  return result;
}

// 模拟邮件归类
function mockClassifyEmail(
  subject: string,
  from: string,
  summary: string
): z.infer<typeof emailClassificationSchema> {
  const content = (subject + " " + summary).toLowerCase();
  
  if (content.includes("pr") || content.includes("commit") || content.includes("bug") || content.includes("接口")) {
    return {
      workspaceType: "code",
      confidence: 0.92,
      reason: "邮件内容涉及代码相关关键词（PR、commit、bug、接口）",
      suggestedActions: ["review", "task"],
    };
  }
  
  if (content.includes("设计") || content.includes("psd") || content.includes("海报") || content.includes("素材")) {
    return {
      workspaceType: "image",
      confidence: 0.88,
      reason: "邮件内容涉及设计相关关键词",
      suggestedActions: ["review", "note"],
    };
  }
  
  if (content.includes("文章") || content.includes("文案") || content.includes("周报") || content.includes("提纲")) {
    return {
      workspaceType: "writing",
      confidence: 0.85,
      reason: "邮件内容涉及写作相关关键词",
      suggestedActions: ["task", "schedule"],
    };
  }
  
  return {
    workspaceType: "general",
    confidence: 0.70,
    reason: "未识别到特定类型关键词，归类为通用工作区",
    suggestedActions: ["note"],
  };
}

// 模拟工作区摘要
function mockWorkspaceSummary(
  workspaceName: string,
  workspaceType: string,
  description: string,
  tasks: string[],
  schedules: string[]
): z.infer<typeof workspaceSummarySchema> {
  return {
    summary: `${workspaceName} 进展顺利，主要聚焦于${description}。整体进度符合预期。`,
    completed: tasks.filter((_, i) => i % 3 === 0),
    inProgress: tasks.filter((_, i) => i % 3 === 1),
    blockers: tasks.length > 5 ? ["资源协调需要时间"] : [],
    nextSteps: ["继续推进核心任务", "安排下周评审会议"],
  };
}
