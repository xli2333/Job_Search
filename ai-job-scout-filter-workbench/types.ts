export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  postedDate: string;
  url: string;
  description: string;
}

export interface AnalysisResult {
  score: number;
  recommendation: '强烈推荐' | '值得考虑' | '勉强匹配' | '不推荐';
  reasoning: string;
  pros: string[];
  cons: string[];
}

export interface ScoredJob extends Job {
  analysis?: AnalysisResult;
  isSelected: boolean;
}

export interface UserConfig {
  resumeText: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  resumeBase64?: string;
  naturalLanguagePreferences: string;
}

export enum AppStatus {
  IDLE = 'idle',
  PARSING = 'parsing', // Also used for Scraping
  ANALYZING = 'analyzing',
  REVIEW = 'review',
}

export interface DBStatus {
  exists: boolean;
  count: number;
  filename: string | null;
}
