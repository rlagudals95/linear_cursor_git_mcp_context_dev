import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { MCPToolResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class RepoTool {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = './workspace') {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  public getToolDefinitions(): Tool[] {
    return [
      {
        name: 'repo_clone',
        description: 'Clone a repository to the workspace',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Repository URL to clone' },
            branch: { type: 'string', description: 'Branch to checkout (optional)' }
          },
          required: ['url']
        }
      },
      {
        name: 'repo_checkout',
        description: 'Checkout a specific branch or commit',
        inputSchema: {
          type: 'object',
          properties: {
            branch: { type: 'string', description: 'Branch name or commit hash' }
          },
          required: ['branch']
        }
      },
      {
        name: 'branch_create',
        description: 'Create a new branch',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Branch name' },
            from: { type: 'string', description: 'Base branch (default: current)' }
          },
          required: ['name']
        }
      },
      {
        name: 'repo_apply_patch',
        description: 'Apply code changes to files',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                  operation: { type: 'string', enum: ['create', 'update', 'delete'] }
                },
                required: ['path', 'operation']
              }
            }
          },
          required: ['files']
        }
      }
    ];
  }

  public async executeTool(name: string, args: any): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'repo_clone':
          return await this.cloneRepo(args.url, args.branch);
        case 'repo_checkout':
          return await this.checkout(args.branch);
        case 'branch_create':
          return await this.createBranch(args.name, args.from);
        case 'repo_apply_patch':
          return await this.applyPatch(args.files);
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      logger.error(`Error executing repo tool ${name}`, { error, args });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async cloneRepo(url: string, branch?: string): Promise<MCPToolResult> {
    try {
      // 워크스페이스 디렉토리 생성
      await fs.mkdir(this.repoPath, { recursive: true });
      
      const options: string[] = [];
      if (branch) {
        options.push('--branch', branch);
      }
      
      await this.git.clone(url, this.repoPath, options);
      
      logger.info('Repository cloned successfully', { url, branch, path: this.repoPath });
      return { 
        success: true, 
        data: { url, branch, path: this.repoPath },
        logs: [`Cloned ${url} to ${this.repoPath}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to clone repository: ${error}` };
    }
  }

  private async checkout(branch: string): Promise<MCPToolResult> {
    try {
      await this.git.checkout(branch);
      
      logger.info('Checked out branch', { branch });
      return { 
        success: true, 
        data: { branch },
        logs: [`Checked out ${branch}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to checkout ${branch}: ${error}` };
    }
  }

  private async createBranch(name: string, from?: string): Promise<MCPToolResult> {
    try {
      if (from) {
        await this.git.checkout(from);
      }
      
      await this.git.checkoutLocalBranch(name);
      
      logger.info('Created and checked out new branch', { name, from });
      return { 
        success: true, 
        data: { name, from },
        logs: [`Created branch ${name}${from ? ` from ${from}` : ''}`]
      };
    } catch (error) {
      return { success: false, error: `Failed to create branch ${name}: ${error}` };
    }
  }

  private async applyPatch(files: Array<{ path: string; content?: string; operation: string }>): Promise<MCPToolResult> {
    const results: string[] = [];
    
    try {
      for (const file of files) {
        const fullPath = path.join(this.repoPath, file.path);
        
        switch (file.operation) {
          case 'create':
          case 'update':
            if (!file.content) {
              throw new Error(`Content required for ${file.operation} operation on ${file.path}`);
            }
            
            // 디렉토리 생성
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, file.content, 'utf8');
            results.push(`${file.operation === 'create' ? 'Created' : 'Updated'} ${file.path}`);
            break;
            
          case 'delete':
            await fs.unlink(fullPath);
            results.push(`Deleted ${file.path}`);
            break;
            
          default:
            throw new Error(`Unknown operation: ${file.operation}`);
        }
      }
      
      logger.info('Applied patch successfully', { fileCount: files.length });
      return { 
        success: true, 
        data: { filesProcessed: files.length },
        logs: results
      };
    } catch (error) {
      return { success: false, error: `Failed to apply patch: ${error}` };
    }
  }
}
