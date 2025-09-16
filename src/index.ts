import dotenv from 'dotenv';
import { APIServer } from './api/server.js';
import { logger } from './utils/logger.js';

// 환경 변수 로드
dotenv.config();

async function main() {
  try {
    logger.info('🚀 Starting Linear Pipeline Service');

    // 필수 환경 변수 확인
    const requiredEnvVars = [
      'LINEAR_API_KEY',
      'GITHUB_TOKEN', 
      'GITHUB_OWNER',
      'GITHUB_REPO'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error('Missing required environment variables', { missingVars });
      process.exit(1);
    }

    // API 서버 시작
    const server = new APIServer();
    const port = parseInt(process.env.PORT || '3008');
    
    server.start(port);

  } catch (error) {
    logger.error('Failed to start service', { error });
    process.exit(1);
  }
}

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  logger.info('👋 Shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down gracefully');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Unhandled error', { error });
  process.exit(1);
});