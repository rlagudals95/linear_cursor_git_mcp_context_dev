import Queue from 'bull';
import Redis from 'ioredis';
import { MCPExecutor } from '../mcp/mcp-executor.js';
import { PlanBuilder } from '../plan/plan-builder.js';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const jobQueue = new Queue('linear-processing', {
  redis: {
    port: 6379,
    host: 'localhost',
  },
});

interface ProcessLinearIssueJob {
  issue: LinearIssue;
  action: string;
  timestamp: number;
}

// Job 처리기 등록
jobQueue.process('process-linear-issue', async (job) => {
  const { issue, action } = job.data as ProcessLinearIssueJob;
  
  logger.info('Processing Linear issue job', {
    issueId: issue.identifier,
    action
  });

  try {
    // 1. Plan Builder로 명령형 계획 생성
    const planBuilder = new PlanBuilder();
    const plan = await planBuilder.createPlan(issue);
    
    logger.info('Generated imperative plan', {
      issueId: issue.identifier,
      commandCount: plan.commands.length
    });

    // 2. MCP Executor로 계획 실행
    const executor = new MCPExecutor();
    const result = await executor.executePlan(plan, issue);
    
    if (result.success) {
      logger.info('Successfully executed plan', {
        issueId: issue.identifier,
        prUrl: result.data?.prUrl
      });
    } else {
      logger.error('Failed to execute plan', {
        issueId: issue.identifier,
        error: result.error
      });
    }

    return result;
  } catch (error) {
    logger.error('💥 Error processing Linear issue', {
      jobId: job.id,
      issueId: issue.identifier,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: typeof error,
      errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    throw error;
  }
});

// Job 이벤트 리스너
jobQueue.on('completed', (job, result) => {
  logger.info('Job completed', { jobId: job.id, result });
});

jobQueue.on('failed', (job, err) => {
  logger.error('Job failed', { jobId: job.id, error: err });
});

export { redis };
