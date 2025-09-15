import { Tool } from '@modelcontextprotocol/sdk/types.js';
import simpleGit, { SimpleGit } from 'simple-git';
import { MCPToolResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class GitTool {
  private git: SimpleGit;

  constructor(repoPath: string = './workspace') {
    this.git = simpleGit(repoPath);
  }

  public getToolDefinitions(): Tool[] {
    return [
      {
        name: 'git_status',
        description: 'Get git status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'git_add',
        description: 'Add files to staging area',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files to add (use "." for all)'
            }
          },
          required: ['files']
        }
      },
      {
        name: 'git_commit',
        description: 'Commit staged changes',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Commit message' },
            author: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' }
              }
            }
          },
          required: ['message']
        }
      },
      {
        name: 'git_push',
        description: 'Push commits to remote repository',
        inputSchema: {
          type: 'object',
          properties: {
            remote: { type: 'string', description: 'Remote name (default: origin)' },
            branch: { type: 'string', description: 'Branch name (default: current)' },
            setUpstream: { type: 'boolean', description: 'Set upstream for new branch' }
          }
        }
      }
    ];
  }

  public async executeTool(name: string, args: any): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'git_status':
          return await this.getStatus();
        case 'git_add':
          return await this.addFiles(args.files);
        case 'git_commit':
          return await this.commit(args.message, args.author);
        case 'git_push':
          return await this.push(args.remote, args.branch, args.setUpstream);
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      logger.error(`Error executing git tool ${name}`, { error, args });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async getStatus(): Promise<MCPToolResult> {
    try {
      const status = await this.git.status();
      
      return {
        success: true,
        data: {
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged,
          modified: status.modified,
          not_added: status.not_added,
          deleted: status.deleted
        },
        logs: [`Current branch: ${status.current}`, `Files staged: ${status.staged.length}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to get git status: ${error}` };
    }
  }

  private async addFiles(files: string[]): Promise<MCPToolResult> {
    try {
      await this.git.add(files);
      
      logger.info('Added files to staging area', { files });
      return {
        success: true,
        data: { files },
        logs: [`Added ${files.length} file(s) to staging area`]
      };
    } catch (error) {
      return { success: false, error: `Failed to add files: ${error}` };
    }
  }

  private async commit(message: string, author?: { name: string; email: string }): Promise<MCPToolResult> {
    try {
      let result;
      if (author) {
        result = await this.git.raw(['commit', '-m', message, '--author', `${author.name} <${author.email}>`]);
      } else {
        result = await this.git.commit(message);
      }
      
      logger.info('Committed changes', { message });
      return {
        success: true,
        data: {
          message,
          author
        },
        logs: [`Committed: ${message}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to commit: ${error}` };
    }
  }

  private async push(remote: string = 'origin', branch?: string, setUpstream: boolean = false): Promise<MCPToolResult> {
    try {
      const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      const targetBranch = branch || currentBranch.trim();
      
      const options: string[] = [remote, targetBranch];
      if (setUpstream) {
        options.unshift('--set-upstream');
      }
      
      await this.git.push(options);
      
      logger.info('Pushed to remote', { remote, branch: targetBranch, setUpstream });
      return {
        success: true,
        data: { remote, branch: targetBranch, setUpstream },
        logs: [`Pushed ${targetBranch} to ${remote}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to push: ${error}` };
    }
  }
}
