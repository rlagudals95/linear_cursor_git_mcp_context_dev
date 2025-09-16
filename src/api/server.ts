import express from 'express';
import { LinearPipeline } from '../core/pipeline.js';
import { GitConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class APIServer {
  private app: express.Application;
  private pipeline: LinearPipeline;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializePipeline();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializePipeline(): void {
    const linearApiKey = process.env.LINEAR_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER?.trim();
    const githubRepo = process.env.GITHUB_REPO?.trim();

    if (!linearApiKey || !githubToken || !githubOwner || !githubRepo) {
      throw new Error('Missing required environment variables: LINEAR_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
    }

    const gitConfig: GitConfig = {
      owner: githubOwner,
      repo: githubRepo,
      token: githubToken
    };

    this.pipeline = new LinearPipeline(linearApiKey, gitConfig);
    logger.info('🔧 Pipeline initialized', { githubOwner, githubRepo });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'linear-pipeline'
      });
    });

    // 메인 파이프라인 트리거
    this.app.post('/trigger/:issueId', async (req, res) => {
      try {
        const { issueId } = req.params;
        
        logger.info('🚀 Pipeline triggered via API', { issueId });

        const result = await this.pipeline.execute(issueId);

        if (result.success) {
          res.json({
            success: true,
            message: 'Pipeline executed successfully',
            data: result
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Pipeline execution failed',
            error: result.error,
            data: result
          });
        }

      } catch (error) {
        logger.error('API error', { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 간단한 테스트 엔드포인트
    this.app.get('/test/:issueId', async (req, res) => {
      try {
        const { issueId } = req.params;
        
        // Linear 이슈만 가져와서 확인
        const linearClient = new (await import('../core/linear-client.js')).LinearClient(
          process.env.LINEAR_API_KEY!
        );
        
        const issue = await linearClient.getIssue(issueId);
        
        if (issue) {
          res.json({
            success: true,
            message: 'Issue found',
            issue: {
              id: issue.identifier,
              title: issue.title,
              team: issue.team.key,
              labels: issue.labels.map(l => l.name)
            }
          });
        } else {
          res.status(404).json({
            success: false,
            message: 'Issue not found'
          });
        }

      } catch (error) {
        logger.error('Test API error', { error });
        res.status(500).json({
          success: false,
          message: 'Test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  public start(port: number = 3008): void {
    this.app.listen(port, () => {
      logger.info('🌐 API Server started', { port });
      console.log(`
🚀 Linear Pipeline API Server
📡 Port: ${port}
🔗 Health: http://localhost:${port}/health
🧪 Test: http://localhost:${port}/test/FE-1140
⚡ Trigger: POST http://localhost:${port}/trigger/FE-1140
      `);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}
