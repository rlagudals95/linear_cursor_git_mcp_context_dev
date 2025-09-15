import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import { GitHubPROptions, MCPToolResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class GitHubTool {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  public getToolDefinitions(): Tool[] {
    return [
      {
        name: 'github_create_pr',
        description: 'Create a pull request',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'PR title' },
            body: { type: 'string', description: 'PR description' },
            head: { type: 'string', description: 'Head branch' },
            base: { type: 'string', description: 'Base branch (default: main)' },
            draft: { type: 'boolean', description: 'Create as draft PR' },
            assignees: {
              type: 'array',
              items: { type: 'string' },
              description: 'GitHub usernames to assign'
            },
            reviewers: {
              type: 'array',
              items: { type: 'string' },
              description: 'GitHub usernames to request review'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to add to PR'
            }
          },
          required: ['title', 'head']
        }
      },
      {
        name: 'github_update_pr',
        description: 'Update an existing pull request',
        inputSchema: {
          type: 'object',
          properties: {
            pull_number: { type: 'number', description: 'PR number' },
            title: { type: 'string', description: 'New PR title' },
            body: { type: 'string', description: 'New PR description' },
            state: { type: 'string', enum: ['open', 'closed'], description: 'PR state' }
          },
          required: ['pull_number']
        }
      },
      {
        name: 'github_add_labels',
        description: 'Add labels to an issue or PR',
        inputSchema: {
          type: 'object',
          properties: {
            issue_number: { type: 'number', description: 'Issue or PR number' },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to add'
            }
          },
          required: ['issue_number', 'labels']
        }
      }
    ];
  }

  public async executeTool(name: string, args: any): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'github_create_pr':
          return await this.createPR(args);
        case 'github_update_pr':
          return await this.updatePR(args.pull_number, args);
        case 'github_add_labels':
          return await this.addLabels(args.issue_number, args.labels);
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      logger.error(`Error executing GitHub tool ${name}`, { error, args });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async createPR(options: GitHubPROptions): Promise<MCPToolResult> {
    try {
      const prData = {
        owner: this.owner,
        repo: this.repo,
        title: options.title,
        body: options.body || '',
        head: options.head,
        base: options.base || 'main',
        draft: options.draft || false
      };

      const { data: pr } = await this.octokit.rest.pulls.create(prData);

      // 담당자 지정
      if (options.assignees && options.assignees.length > 0) {
        await this.octokit.rest.issues.addAssignees({
          owner: this.owner,
          repo: this.repo,
          issue_number: pr.number,
          assignees: options.assignees
        });
      }

      // 리뷰어 요청
      if (options.reviewers && options.reviewers.length > 0) {
        await this.octokit.rest.pulls.requestReviewers({
          owner: this.owner,
          repo: this.repo,
          pull_number: pr.number,
          reviewers: options.reviewers
        });
      }

      // 라벨 추가
      if (options.labels && options.labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.owner,
          repo: this.repo,
          issue_number: pr.number,
          labels: options.labels
        });
      }

      logger.info('Created pull request', {
        number: pr.number,
        title: pr.title,
        url: pr.html_url
      });

      return {
        success: true,
        data: {
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          state: pr.state,
          draft: pr.draft
        },
        logs: [`Created PR #${pr.number}: ${pr.title}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to create PR: ${error}` };
    }
  }

  private async updatePR(pullNumber: number, updates: any): Promise<MCPToolResult> {
    try {
      const updateData: any = {
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber
      };

      if (updates.title) updateData.title = updates.title;
      if (updates.body) updateData.body = updates.body;
      if (updates.state) updateData.state = updates.state;

      const { data: pr } = await this.octokit.rest.pulls.update(updateData);

      logger.info('Updated pull request', {
        number: pr.number,
        title: pr.title
      });

      return {
        success: true,
        data: {
          number: pr.number,
          title: pr.title,
          state: pr.state
        },
        logs: [`Updated PR #${pr.number}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to update PR: ${error}` };
    }
  }

  private async addLabels(issueNumber: number, labels: string[]): Promise<MCPToolResult> {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        labels
      });

      logger.info('Added labels to issue/PR', {
        number: issueNumber,
        labels
      });

      return {
        success: true,
        data: { issueNumber, labels },
        logs: [`Added labels to #${issueNumber}: ${labels.join(', ')}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to add labels: ${error}` };
    }
  }
}
