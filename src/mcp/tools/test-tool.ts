import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { MCPToolResult } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

const execAsync = promisify(exec);

export class TestTool {
  private workingDir: string;

  constructor(workingDir: string = './workspace') {
    this.workingDir = workingDir;
  }

  public getToolDefinitions(): Tool[] {
    return [
      {
        name: 'test_run',
        description: 'Run tests',
        inputSchema: {
          type: 'object',
          properties: {
            command: { 
              type: 'string', 
              description: 'Test command to run (e.g., "npm test", "pnpm test", "yarn test")' 
            },
            pattern: { 
              type: 'string', 
              description: 'Test file pattern or specific test to run' 
            },
            timeout: { 
              type: 'number', 
              description: 'Timeout in milliseconds (default: 30000)' 
            }
          },
          required: ['command']
        }
      },
      {
        name: 'lint_run',
        description: 'Run linting',
        inputSchema: {
          type: 'object',
          properties: {
            command: { 
              type: 'string', 
              description: 'Lint command to run (e.g., "npm run lint", "eslint .")' 
            },
            fix: { 
              type: 'boolean', 
              description: 'Automatically fix linting issues' 
            }
          },
          required: ['command']
        }
      },
      {
        name: 'build_run',
        description: 'Run build process',
        inputSchema: {
          type: 'object',
          properties: {
            command: { 
              type: 'string', 
              description: 'Build command to run (e.g., "npm run build", "tsc")' 
            }
          },
          required: ['command']
        }
      }
    ];
  }

  public async executeTool(name: string, args: any): Promise<MCPToolResult> {
    try {
      switch (name) {
        case 'test_run':
          return await this.runTests(args.command, args.pattern, args.timeout);
        case 'lint_run':
          return await this.runLint(args.command, args.fix);
        case 'build_run':
          return await this.runBuild(args.command);
        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      logger.error(`Error executing test tool ${name}`, { error, args });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async runTests(command: string, pattern?: string, timeout: number = 30000): Promise<MCPToolResult> {
    try {
      let fullCommand = command;
      if (pattern) {
        fullCommand += ` ${pattern}`;
      }

      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.workingDir,
        timeout
      });

      const output = stdout + stderr;
      const success = !stderr.includes('FAIL') && !stderr.includes('Error');

      logger.info('Test execution completed', {
        command: fullCommand,
        success,
        outputLength: output.length
      });

      return {
        success,
        data: {
          command: fullCommand,
          stdout,
          stderr,
          exitCode: 0
        },
        logs: [
          `Executed: ${fullCommand}`,
          success ? 'Tests passed' : 'Tests failed',
          `Output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`
        ]
      };
    } catch (error: any) {
      const isTimeout = error.code === 'ETIMEDOUT';
      const exitCode = error.code || 1;
      
      return {
        success: false,
        error: isTimeout ? `Test execution timed out after ${timeout}ms` : `Test execution failed: ${error.message}`,
        data: {
          command,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode,
          timeout: isTimeout
        }
      };
    }
  }

  private async runLint(command: string, fix: boolean = false): Promise<MCPToolResult> {
    try {
      let fullCommand = command;
      if (fix && !command.includes('--fix')) {
        fullCommand += ' --fix';
      }

      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.workingDir
      });

      const output = stdout + stderr;
      const hasErrors = stderr.includes('error') || stderr.includes('Error');

      logger.info('Lint execution completed', {
        command: fullCommand,
        hasErrors,
        fixed: fix
      });

      return {
        success: !hasErrors,
        data: {
          command: fullCommand,
          stdout,
          stderr,
          fixed: fix
        },
        logs: [
          `Executed: ${fullCommand}`,
          hasErrors ? 'Linting found errors' : 'Linting passed',
          fix ? 'Auto-fix applied' : '',
          `Output: ${output.substring(0, 300)}${output.length > 300 ? '...' : ''}`
        ].filter(Boolean)
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Lint execution failed: ${error.message}`,
        data: {
          command,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code || 1
        }
      };
    }
  }

  private async runBuild(command: string): Promise<MCPToolResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDir
      });

      const output = stdout + stderr;
      const hasErrors = stderr.includes('error') || stderr.includes('Error');

      logger.info('Build execution completed', {
        command,
        hasErrors
      });

      return {
        success: !hasErrors,
        data: {
          command,
          stdout,
          stderr
        },
        logs: [
          `Executed: ${command}`,
          hasErrors ? 'Build failed' : 'Build successful',
          `Output: ${output.substring(0, 300)}${output.length > 300 ? '...' : ''}`
        ]
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Build execution failed: ${error.message}`,
        data: {
          command,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code || 1
        }
      };
    }
  }
}
