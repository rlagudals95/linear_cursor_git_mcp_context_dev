#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitTool } from './mcp/tools/git-tool.js';
import { GitHubTool } from './mcp/tools/github-tool.js';
import { RepoTool } from './mcp/tools/repo-tool.js';
import { TestTool } from './mcp/tools/test-tool.js';
import { logger } from './utils/logger.js';

class MCPServer {
  private server: Server;
  private repoTool: RepoTool;
  private gitTool: GitTool;
  private githubTool?: GitHubTool;
  private testTool: TestTool;

  constructor() {
    this.server = new Server(
      {
        name: 'linear-context-processor',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 도구 초기화
    this.repoTool = new RepoTool();
    this.gitTool = new GitTool();
    this.testTool = new TestTool();
    
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    
    if (githubToken && githubOwner && githubRepo) {
      this.githubTool = new GitHubTool(githubToken, githubOwner, githubRepo);
    } else {
      logger.warn('GitHub configuration missing, GitHub tools will not be available');
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    // 도구 목록 제공
    this.server.setRequestHandler(z.object({ method: z.literal('tools/list') }), async () => {
      const tools = [
        ...this.repoTool.getToolDefinitions(),
        ...this.gitTool.getToolDefinitions(),
        ...this.testTool.getToolDefinitions(),
      ];

      if (this.githubTool) {
        tools.push(...this.githubTool.getToolDefinitions());
      }

      return { tools };
    });

    // 도구 실행
    this.server.setRequestHandler(z.object({ method: z.literal('tools/call') }), async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        // 도구 이름에 따라 적절한 도구로 라우팅
        if (name.startsWith('repo_') || name.startsWith('branch_')) {
          result = await this.repoTool.executeTool(name, args);
        } else if (name.startsWith('git_')) {
          result = await this.gitTool.executeTool(name, args);
        } else if (name.startsWith('test_') || name.startsWith('lint_') || name.startsWith('build_')) {
          result = await this.testTool.executeTool(name, args);
        } else if (name.startsWith('github_') && this.githubTool) {
          result = await this.githubTool.executeTool(name, args);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      } catch (error) {
        logger.error('Tool execution failed', { name, args, error });
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          isError: true
        };
      }
    });
  }

  public async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Server started');
  }
}

// 서버 시작
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  server.start().catch((error) => {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  });
}

export { MCPServer };
