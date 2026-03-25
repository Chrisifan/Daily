import { Router } from "express";
import { classifyEmail } from "../services/langchain.js";

const router = Router();

// POST /api/classify/email
router.post("/email", async (req, res) => {
  try {
    const { subject, from, summary } = req.body;

    if (!subject || !from) {
      return res.status(400).json({
        error: "Missing required fields: subject, from",
      });
    }

    const result = await classifyEmail(subject, from, summary || "");

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Email classification error:", error);
    res.status(500).json({
      error: "Classification failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/classify/batch
router.post("/batch", async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        error: "Missing required field: emails (array)",
      });
    }

    const results = await Promise.all(
      emails.map(async (email) => {
        const result = await classifyEmail(
          email.subject,
          email.from,
          email.summary || ""
        );
        return {
          emailId: email.id,
          ...result,
        };
      })
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Batch classification error:", error);
    res.status(500).json({
      error: "Batch classification failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
