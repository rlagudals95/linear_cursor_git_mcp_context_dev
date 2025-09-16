export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  estimate?: number;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  assignee?: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  creator: {
    id: string;
    name: string;
    email?: string;
  };
  team: {
    id: string;
    name: string;
    key: string;
    description?: string;
  };
  project?: {
    id: string;
    name: string;
    description?: string;
    status: string;
    progress: number;
    startDate?: string;
    targetDate?: string;
  };
  cycle?: {
    id: string;
    name: string;
    number: number;
    startsAt: string;
    endsAt: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color: string;
    description?: string;
  }>;
  url: string;
  branchName?: string;
  gitBranchName?: string;
  
  // 댓글 및 소통
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      name: string;
      email?: string;
      avatarUrl?: string;
    };
    // Slack 메시지 여부 등
    externalId?: string;
    source?: 'linear' | 'slack' | 'github' | 'email';
  }>;
  
  // 첨부파일 및 링크
  attachments: Array<{
    id: string;
    title: string;
    url: string;
    subtitle?: string;
    metadata?: {
      size?: number;
      mimeType?: string;
    };
  }>;
  
  // 관련 이슈들
  relations: {
    parent?: {
      id: string;
      identifier: string;
      title: string;
      status: string;
    };
    children: Array<{
      id: string;
      identifier: string;
      title: string;
      status: string;
    }>;
    relatedIssues: Array<{
      id: string;
      identifier: string;
      title: string;
      type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
    }>;
  };
  
  // 히스토리 및 변경사항
  history: Array<{
    id: string;
    createdAt: string;
    user: {
      name: string;
    };
    type: 'status_change' | 'assignment' | 'label_change' | 'comment' | 'description_change';
    fromValue?: string;
    toValue?: string;
    description: string;
  }>;
  
  // 개발 관련 정보
  development: {
    prUrl?: string;
    branchName?: string;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      url: string;
    }>;
  };
  
  // 메트릭스
  metrics: {
    timeInTriage?: number;
    timeInProgress?: number;
    timeInReview?: number;
    cycleTime?: number;
    commentCount: number;
    viewCount?: number;
  };
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