import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Job, AnalysisResult, UserConfig } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// Schema for the Single Analysis (used inside the bulk map)
const ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "匹配度评分 0-100" },
    recommendation: { 
      type: Type.STRING, 
      enum: ["强烈推荐", "值得考虑", "勉强匹配", "不推荐"] 
    },
    reasoning: { type: Type.STRING, description: "一句话简短评价 (中文)" },
    pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "优点 (中文)" },
    cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "缺点/风险 (中文)" },
  },
  required: ["score", "recommendation", "reasoning", "pros", "cons"],
};

// Schema for Bulk Output (Map of JobID -> Analysis)
const BULK_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          jobId: { type: Type.STRING },
          analysis: ANALYSIS_SCHEMA
        },
        required: ["jobId", "analysis"]
      }
    }
  }
};

/**
 * Bulk Analysis Function.
 * Takes the full list of jobs (from CSV), splits them into chunks (to avoid output token limits),
 * and processes them in parallel.
 */
export const analyzeJobsBulk = async (jobs: Job[], config: UserConfig, onProgress?: (current: number, total: number) => void): Promise<Record<string, AnalysisResult>> => {
  const model = "gemini-2.5-pro";
  const BATCH_SIZE = 15; // Process 15 jobs per request to ensure JSON fits in output window
  const chunks: Job[][] = [];
  
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    chunks.push(jobs.slice(i, i + BATCH_SIZE));
  }

  // Track progress
  let completedJobs = 0;
  const totalJobs = jobs.length;

  // Helper function to process one chunk
  const processChunk = async (chunk: Job[]): Promise<any[]> => {
    const jobData = chunk.map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      description: j.description,
      location: j.location,
      date: j.postedDate
    }));

    const parts: any[] = [];
    
    // Add Resume Context
    if (config.resumeBase64) {
      parts.push({
          inlineData: {
              mimeType: config.resumeMimeType || 'application/pdf',
              data: config.resumeBase64
          }
      });
      parts.push({ text: "候选人简历 (见上文附件)。" });
    } else {
      parts.push({ text: `候选人简历内容:\n${config.resumeText.slice(0, 3000)}` });
    }

    const promptText = `
      你是一位拥有20年经验的高级猎头顾问。
      
      候选人偏好 (Preferences): "${config.naturalLanguagePreferences}"
      
      这里有一份包含 ${chunk.length} 个职位的列表 (JSON格式):
      ${JSON.stringify(jobData)}

      任务:
      请根据简历和偏好分析每一个职位。
      返回一个包含 "results" 数组的 JSON 对象。
      每个结果必须包含 'jobId' 和 'analysis' 对象 (score, recommendation, reasoning, pros, cons)。
      
      要求:
      1. 评分标准要严格。
      2. 所有输出 (reasoning, pros, cons) 必须使用中文。
      3. reasoning 必须犀利、专业、简练。
    `;
    
    parts.push({ text: promptText });

    try {
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: BULK_ANALYSIS_SCHEMA,
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      
      // Update progress
      completedJobs += chunk.length;
      if (onProgress) {
          onProgress(completedJobs, totalJobs);
      }

      return parsed.results || [];
    } catch (e) {
      console.error("Batch processing failed", e);
      // Even on failure, we count them as processed (but failed)
      completedJobs += chunk.length;
      if (onProgress) {
          onProgress(completedJobs, totalJobs);
      }
      return [];
    }
  };

  // Run all chunks in parallel
  // Note: For better progress updates, we might want to run them sequentially or in smaller groups if concurrency is high.
  // But Promise.all is faster. Since we update a shared variable, it's fine for simple progress bars.
  const chunkResults = await Promise.all(chunks.map(chunk => processChunk(chunk)));
  
  // Flatten results and convert to Map
  const resultMap: Record<string, AnalysisResult> = {};
  
  chunkResults.flat().forEach((item: any) => {
    if (item && item.jobId && item.analysis) {
      resultMap[item.jobId] = item.analysis;
    }
  });

  return resultMap;
};