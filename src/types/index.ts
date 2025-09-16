export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  assignee?: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
  };
  labels: Array<{
    id: string;
    name: string;
  }>;
  url: string;
}

export interface PipelineResult {
  success: boolean;
  issueId: string;
  branchName?: string;
  commitHash?: string;
  prUrl?: string;
  error?: string;
  logs: string[];
}

export interface GitConfig {
  owner: string;
  repo: string;
  token: string;
}