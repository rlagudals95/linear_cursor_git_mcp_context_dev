import { ImperativeCommand, ImperativePlan, MCPToolResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { GitTool } from './tools/git-tool.js';
import { GitHubTool } from './tools/github-tool.js';
import { RepoTool } from './tools/repo-tool.js';
import { TestTool } from './tools/test-tool.js';

export class MCPExecutor {
  private repoTool: RepoTool;
  private gitTool: GitTool;
  private githubTool: GitHubTool;
  private testTool: TestTool;
  private workspaceDir: string;

  constructor(workspaceDir: string = './workspace') {
    this.workspaceDir = workspaceDir;
    this.repoTool = new RepoTool(workspaceDir);
    this.gitTool = new GitTool(workspaceDir);
    this.testTool = new TestTool(workspaceDir);
    
    // GitHub 설정
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    
    if (!githubToken || !githubOwner || !githubRepo) {
      throw new Error('GitHub configuration missing: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO required');
    }
    
    this.githubTool = new GitHubTool(githubToken, githubOwner, githubRepo);
  }

  public async executePlan(plan: ImperativePlan): Promise<MCPToolResult> {
    logger.info('Starting plan execution', {
      issueId: plan.issueId,
      branchName: plan.branchName,
      commandCount: plan.commands.length
    });

    const executionResults: Array<{ command: ImperativeCommand; result: MCPToolResult }> = [];
    let overallSuccess = true;
    const allLogs: string[] = [];

    try {
      for (const command of plan.commands) {
        logger.info('Executing command', {
          commandId: command.id,
          type: command.type,
          description: command.description
        });

        const result = await this.executeCommand(command);
        executionResults.push({ command, result });

        if (result.logs) {
          allLogs.push(...result.logs);
        }

        if (!result.success) {
          logger.error('Command execution failed', {
            commandId: command.id,
            error: result.error
          });
          
          overallSuccess = false;
          
          // 중요한 명령이 실패하면 전체 실행 중단
          if (this.isCriticalCommand(command)) {
            logger.error('Critical command failed, stopping execution', {
              commandId: command.id
            });
            break;
          }
        } else {
          logger.info('Command executed successfully', {
            commandId: command.id
          });
        }
      }

      const finalResult: MCPToolResult = {
        success: overallSuccess,
        data: {
          issueId: plan.issueId,
          branchName: plan.branchName,
          executedCommands: executionResults.length,
          totalCommands: plan.commands.length,
          results: executionResults,
          prUrl: this.extractPRUrl(executionResults)
        },
        logs: allLogs
      };

      if (!overallSuccess) {
        finalResult.error = 'One or more commands failed during execution';
      }

      logger.info('Plan execution completed', {
        issueId: plan.issueId,
        success: overallSuccess,
        executedCommands: executionResults.length
      });

      return finalResult;
    } catch (error) {
      logger.error('Plan execution failed with exception', {
        issueId: plan.issueId,
        error
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        data: {
          issueId: plan.issueId,
          executedCommands: executionResults.length,
          results: executionResults
        },
        logs: allLogs
      };
    }
  }

  private async executeCommand(command: ImperativeCommand): Promise<MCPToolResult> {
    try {
      switch (command.type) {
        case 'branch.create':
          return await this.repoTool.executeTool('branch_create', command.params);
          
        case 'repo.apply_patch':
          return await this.repoTool.executeTool('repo_apply_patch', command.params);
          
        case 'test.run':
          if (command.params.command?.includes('lint')) {
            return await this.testTool.executeTool('lint_run', command.params);
          } else if (command.params.command?.includes('build')) {
            return await this.testTool.executeTool('build_run', command.params);
          } else {
            return await this.testTool.executeTool('test_run', command.params);
          }
          
        case 'git.commit':
          // git add와 git commit을 분리해서 처리
          if (command.params.files) {
            const addResult = await this.gitTool.executeTool('git_add', { files: command.params.files });
            if (!addResult.success) {
              return addResult;
            }
          }
          
          return await this.gitTool.executeTool('git_commit', {
            message: command.params.message,
            author: command.params.author
          });
          
        case 'git.push':
          return await this.gitTool.executeTool('git_push', command.params);
          
        case 'github.pr.create':
          return await this.githubTool.executeTool('github_create_pr', command.params);
          
        default:
          return {
            success: false,
            error: `Unknown command type: ${command.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command execution error'
      };
    }
  }

  private isCriticalCommand(command: ImperativeCommand): boolean {
    // 이 명령들이 실패하면 전체 프로세스를 중단해야 함
    const criticalCommands = [
      'branch.create',
      'git.commit',
      'git.push'
    ];
    
    return criticalCommands.includes(command.type);
  }

  private extractPRUrl(results: Array<{ command: ImperativeCommand; result: MCPToolResult }>): string | undefined {
    for (const { command, result } of results) {
      if (command.type === 'github.pr.create' && result.success && result.data?.url) {
        return result.data.url;
      }
    }
    return undefined;
  }

  // 실행 상태 조회
  public async getExecutionStatus(issueId: string): Promise<any> {
    // 실제로는 Redis나 데이터베이스에서 실행 상태를 조회
    return {
      issueId,
      status: 'completed', // pending, running, completed, failed
      progress: 100,
      lastUpdated: new Date().toISOString()
    };
  }

  // 실행 취소/롤백
  public async rollbackExecution(issueId: string): Promise<MCPToolResult> {
    logger.info('Rolling back execution', { issueId });
    
    try {
      // 브랜치 삭제 등 롤백 작업 수행
      // 실제 구현에서는 실행 히스토리를 기반으로 롤백
      
      return {
        success: true,
        data: { issueId, rolledBack: true },
        logs: [`Rolled back execution for ${issueId}`]
      };
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error}`
      };
    }
  }
}
