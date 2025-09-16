import axios from 'axios';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LinearClient {
  private apiKey: string;
  private baseURL = 'https://api.linear.app/graphql';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getIssue(issueIdentifier: string): Promise<LinearIssue | null> {
    try {
      logger.info('📋 Fetching Linear issue', { issueIdentifier });

      const query = `
        query GetIssues($first: Int!) {
          issues(first: $first) {
            nodes {
              id
              identifier
              title
              description
              url
              priority
              estimate
              createdAt
              updatedAt
              
              # 상태 정보
              state { 
                name 
              }
              
              # 담당자 정보
              assignee { 
                id 
                name 
              }
              
              # 생성자 정보
              creator {
                id
                name
              }
              
              # 팀 정보
              team { 
                id 
                name 
                key 
              }
              
              # 라벨 정보
              labels { 
                nodes { 
                  id 
                  name 
                } 
              }
              
              # 댓글
              comments {
                nodes {
                  id
                  body
                  createdAt
                  user { 
                    id
                    name 
                  }
                }
              }
              
              # 첨부파일
              attachments {
                nodes {
                  id
                  title
                  url
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(this.baseURL, {
        query,
        variables: { first: 100 }
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        logger.error('Linear API errors', { errors: response.data.errors });
        return null;
      }

      const issues = response.data.data?.issues?.nodes;
      const issueData = issues?.find((issue: any) => issue.identifier === issueIdentifier);
      
      if (!issueData) {
        logger.warn('Issue not found', { issueIdentifier });
        return null;
      }

      const linearIssue: LinearIssue = {
        id: issueData.id,
        identifier: issueData.identifier,
        title: issueData.title,
        description: issueData.description,
        status: issueData.state?.name || 'Unknown',
        priority: issueData.priority || 0,
        estimate: issueData.estimate,
        createdAt: issueData.createdAt,
        updatedAt: issueData.updatedAt,
        dueDate: undefined, // 추후 구현
        
        assignee: issueData.assignee ? {
          id: issueData.assignee.id,
          name: issueData.assignee.name
        } : undefined,
        
        creator: {
          id: issueData.creator.id,
          name: issueData.creator.name
        },
        
        team: {
          id: issueData.team.id,
          name: issueData.team.name,
          key: issueData.team.key
        },
        
        project: undefined, // 추후 구현
        cycle: undefined, // 추후 구현
        
        labels: issueData.labels?.nodes?.map((label: any) => ({
          id: label.id,
          name: label.name,
          color: '#000000', // 기본값
          description: undefined
        })) || [],
        
        url: issueData.url,
        branchName: undefined,
        gitBranchName: undefined,
        
        comments: issueData.comments?.nodes?.map((comment: any) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          updatedAt: comment.createdAt, // 기본값
          user: {
            id: comment.user.id,
            name: comment.user.name
          },
          source: this.detectCommentSource(comment.body)
        })) || [],
        
        attachments: issueData.attachments?.nodes?.map((attachment: any) => ({
          id: attachment.id,
          title: attachment.title,
          url: attachment.url,
          subtitle: undefined,
          metadata: undefined
        })) || [],
        
        relations: {
          parent: undefined,
          children: [],
          relatedIssues: []
        },
        
        history: [],
        
        development: {
          branchName: undefined,
          commits: []
        },
        
        metrics: {
          commentCount: issueData.comments?.nodes?.length || 0,
          cycleTime: this.calculateCycleTime(issueData.createdAt, issueData.updatedAt)
        }
      };

      logger.info('✅ Successfully fetched Linear issue', {
        issueId: linearIssue.identifier,
        title: linearIssue.title
      });

      return linearIssue;
    } catch (error) {
      logger.error('Failed to fetch Linear issue', { issueIdentifier, error });
      return null;
    }
  }

  // 댓글 소스 감지 (Slack, GitHub 등)
  private detectCommentSource(body: string): 'linear' | 'slack' | 'github' | 'email' {
    if (body.includes('slack.com') || body.includes('Posted via Slack')) {
      return 'slack';
    }
    if (body.includes('github.com') || body.includes('commit') || body.includes('pull request')) {
      return 'github';
    }
    if (body.includes('via email') || body.includes('@')) {
      return 'email';
    }
    return 'linear';
  }

  // 히스토리 타입 매핑
  private mapHistoryType(type: string): 'status_change' | 'assignment' | 'label_change' | 'comment' | 'description_change' {
    const typeMap: { [key: string]: any } = {
      'IssueStatusChangedHistoryItem': 'status_change',
      'IssueAssigneeChangedHistoryItem': 'assignment',
      'IssueLabelChangedHistoryItem': 'label_change',
      'IssueCommentCreatedHistoryItem': 'comment',
      'IssueDescriptionChangedHistoryItem': 'description_change'
    };
    
    return typeMap[type] || 'status_change';
  }

  // 히스토리 설명 생성
  private generateHistoryDescription(historyItem: any): string {
    const type = historyItem.type || historyItem.__typename;
    const actor = historyItem.actor?.name || 'System';
    
    switch (type) {
      case 'IssueStatusChangedHistoryItem':
        return `${actor} changed status from ${historyItem.fromState?.name} to ${historyItem.toState?.name}`;
      case 'IssueAssigneeChangedHistoryItem':
        return `${actor} changed assignee`;
      case 'IssueLabelChangedHistoryItem':
        return `${actor} updated labels`;
      case 'IssueCommentCreatedHistoryItem':
        return `${actor} added a comment`;
      case 'IssueDescriptionChangedHistoryItem':
        return `${actor} updated description`;
      default:
        return `${actor} made changes`;
    }
  }

  // 사이클 타임 계산 (시간 단위)
  private calculateCycleTime(createdAt: string, updatedAt: string): number {
    const created = new Date(createdAt);
    const updated = new Date(updatedAt);
    return Math.round((updated.getTime() - created.getTime()) / (1000 * 60 * 60)); // 시간 단위
  }
}
