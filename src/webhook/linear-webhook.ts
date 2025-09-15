import crypto from 'crypto';
import express from 'express';
import { jobQueue } from '../queue/job-queue.js';
import { LinearWebhookPayload } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class LinearWebhookHandler {
  private app: express.Application;
  private webhookSecret: string;

  constructor(webhookSecret: string) {
    this.app = express();
    this.webhookSecret = webhookSecret;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // 웹훅용 raw 미들웨어
    this.app.use('/webhooks', express.raw({ type: 'application/json' }));
    // API용 JSON 미들웨어  
    this.app.use('/api', express.json());
  }

  private setupRoutes() {
    this.app.post('/webhooks/linear', this.handleLinearWebhook.bind(this));
    this.app.post('/api/trigger/:issueId', this.handleManualTrigger.bind(this));
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private verifySignature(payload: Buffer, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private async handleLinearWebhook(req: express.Request, res: express.Response) {
    try {
      const signature = req.headers['linear-signature'] as string;
      const payload = req.body as Buffer;

      if (!signature) {
        logger.warn('Missing Linear signature header');
        return res.status(401).json({ error: 'Missing signature' });
      }

      if (!this.verifySignature(payload, signature.replace('sha256=', ''))) {
        logger.warn('Invalid Linear webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const webhookData: LinearWebhookPayload = JSON.parse(payload.toString());
      
      logger.info('Received Linear webhook', {
        action: webhookData.action,
        type: webhookData.type,
        issueId: webhookData.data?.identifier
      });

      // 이슈 생성/업데이트 이벤트만 처리
      if (webhookData.type === 'Issue' && 
          ['create', 'update'].includes(webhookData.action)) {
        
        // 개발 관련 이슈만 자동화 처리
        if (this.shouldAutomate(webhookData.data)) {
          // 백그라운드 작업 큐에 추가
          await jobQueue.add('process-linear-issue', {
            issue: webhookData.data,
            action: webhookData.action,
            timestamp: webhookData.webhookTimestamp
          });

          logger.info('Added issue processing job to queue', {
            issueId: webhookData.data.identifier
          });
        } else {
          logger.info('Skipped non-development issue', {
            issueId: webhookData.data.identifier,
            labels: webhookData.data.labels?.map(l => l.name)
          });
        }

      }

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Error processing Linear webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleManualTrigger(req: express.Request, res: express.Response) {
    try {
      const { issueId } = req.params;
      const { force = false } = req.body;

      logger.info('Manual trigger requested', { issueId, force });

      // Linear API에서 이슈 정보 가져오기 (실제로는 Linear API 호출 필요)
      // 여기서는 간단한 예시로 처리
      const mockIssue = {
        identifier: issueId,
        title: 'Manual triggered issue',
        team: { key: 'DEV' },
        labels: [{ name: 'manual-trigger' }]
      };

      // 강제 실행이거나 자동화 조건을 만족하는 경우
      if (force || this.shouldAutomate(mockIssue)) {
        await jobQueue.add('process-linear-issue', {
          issue: mockIssue,
          action: 'manual_trigger',
          timestamp: Date.now()
        });

        res.json({ 
          success: true, 
          message: `Manual trigger for ${issueId} added to queue`,
          issueId 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: `Issue ${issueId} does not meet automation criteria. Use force=true to override.`,
          issueId 
        });
      }
    } catch (error) {
      logger.error('Error processing manual trigger', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private shouldAutomate(issue: any): boolean {
    const labels = issue.labels?.map((l: any) => l.name.toLowerCase()) || [];
    const title = issue.title?.toLowerCase() || '';
    const teamKey = issue.team?.key?.toLowerCase() || '';

    // 1. 개발 관련 라벨이 있는 경우
    const devLabels = ['bug', 'feature', 'enhancement', 'refactor', 'hotfix', 'tech-debt'];
    if (labels.some((label: string) => devLabels.includes(label))) {
      return true;
    }

    // 2. 개발팀 이슈인 경우 (FE, BE, MOBILE 등)
    const devTeams = ['fe', 'be', 'frontend', 'backend', 'mobile', 'dev'];
    if (devTeams.includes(teamKey)) {
      return true;
    }

    // 3. 제목에 개발 관련 키워드가 있는 경우
    const devKeywords = ['구현', 'implement', '개발', 'develop', '코드', 'code', '버그', 'bug', 'fix'];
    if (devKeywords.some(keyword => title.includes(keyword))) {
      return true;
    }

    // 4. 자동화 라벨이 명시적으로 있는 경우
    if (labels.includes('auto-dev') || labels.includes('automation')) {
      return true;
    }

    // 5. 제외 라벨이 있는 경우 자동화 안함
    const excludeLabels = ['design', 'research', 'meeting', 'planning', 'no-automation'];
    if (labels.some((label: string) => excludeLabels.includes(label))) {
      return false;
    }

    return false; // 기본적으로 자동화 안함
  }

  public getApp(): express.Application {
    return this.app;
  }
}
