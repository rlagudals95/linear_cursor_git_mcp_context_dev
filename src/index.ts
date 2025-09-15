import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { logger } from './utils/logger.js';
import { LinearWebhookHandler } from './webhook/linear-webhook.js';

// 환경 변수 로드
dotenv.config();

async function main() {
  try {
    // 필수 환경 변수 확인
    const requiredEnvVars = [
      'LINEAR_API_KEY',
      'LINEAR_WEBHOOK_SECRET',
      'GITHUB_TOKEN',
      'GITHUB_OWNER',
      'GITHUB_REPO'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // 로그 디렉토리 생성
    await fs.mkdir('logs', { recursive: true });

    // 워크스페이스 디렉토리 생성
    await fs.mkdir('workspace', { recursive: true });

    // Linear Webhook 핸들러 초기화
    const webhookHandler = new LinearWebhookHandler(process.env.LINEAR_WEBHOOK_SECRET!);
    const app = webhookHandler.getApp();

    // 서버 시작
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info('MCP Context Processor started', {
        port,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();
