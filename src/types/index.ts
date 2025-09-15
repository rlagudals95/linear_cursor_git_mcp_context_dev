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
  estimate?: number;
  priority?: number;
  url: string;
  gitBranchName?: string;
}

export interface LinearWebhookPayload {
  action: string;
  data: LinearIssue;
  type: string;
  organizationId: string;
  webhookTimestamp: number;
}

export interface ImperativePlan {
  issueId: string;
  branchName: string;
  commands: ImperativeCommand[];
}

export interface ImperativeCommand {
  id: string;
  type: 'branch.create' | 'repo.apply_patch' | 'test.run' | 'git.commit' | 'git.push' | 'github.pr.create';
  params: Record<string, any>;
  description: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}

export interface GitHubPROptions {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
  assignees?: string[];
  reviewers?: string[];
  labels?: string[];
}
