export interface LinkAnalysis {
  url: string;
  summary: string;
}

export interface AnalysisResult {
  isSpam: boolean;
  confidenceScore: number;
  explanation: string;
  redFlags: string[];
  senderReputation: string;
  domainAnalysis: string;
  linkAnalysis: LinkAnalysis[];
}