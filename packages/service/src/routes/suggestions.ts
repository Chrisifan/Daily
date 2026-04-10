import { Router } from "express";
import { generateWorkspaceSummary } from "../services/langchain.js";

const router = Router();

// POST /api/suggestions/workspace-summary
router.post("/workspace-summary", async (req, res) => {
  try {
    const { 
      workspaceName, 
      workspaceType, 
      description, 
      tasks, 
      schedules 
    } = req.body;

    if (!workspaceName || !workspaceType) {
      return res.status(400).json({
        error: "Missing required fields: workspaceName, workspaceType",
      });
    }

    const result = await generateWorkspaceSummary(
      workspaceName,
      workspaceType,
      description || "",
      tasks || [],
      schedules || []
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Workspace summary error:", error);
    res.status(500).json({
      error: "Summary generation failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/suggestions/priority
router.post("/priority", async (req, res) => {
  try {
    const { tasks, schedules } = req.body;

    // 简单的优先级建议逻辑
    const suggestions = (tasks || []).map((task: { priority: string; dueAt?: string; title: string }) => {
      const isUrgent = task.dueAt && new Date(task.dueAt) < new Date(Date.now() + 24 * 60 * 60 * 1000);
      const isHighPriority = task.priority === "high";
      
      return {
        taskTitle: task.title,
        suggestedPriority: isUrgent || isHighPriority ? "high" : "medium",
        reason: isUrgent ? "即将到期" : isHighPriority ? "高优先级任务" : "常规任务",
      };
    });

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("Priority suggestion error:", error);
    res.status(500).json({
      error: "Priority suggestion failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/suggestions/health
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-suggestions",
    timestamp: new Date().toISOString(),
  });
});

export default router;
