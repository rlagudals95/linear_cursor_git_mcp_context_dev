import { GitConfig, PipelineResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { CodeGenerator } from './code-generator.js';
import { GitManager } from './git-manager.js';
import { LinearClient } from './linear-client.js';
import { PRCreator } from './pr-creator.js';

export class LinearPipeline {
  private linearClient: LinearClient;
  private codeGenerator!: CodeGenerator;
  private gitManager: GitManager;
  private prCreator: PRCreator;

  constructor(linearApiKey: string, gitConfig: GitConfig) {
    this.linearClient = new LinearClient(linearApiKey);
    this.gitManager = new GitManager(gitConfig);
    this.prCreator = new PRCreator(gitConfig);
    // CodeGenerator will be initialized later with workDir
  }

  async execute(issueIdentifier: string): Promise<PipelineResult> {
    const logs: string[] = [];
    let branchName: string | undefined;
    let commitHash: string | undefined;
    let prUrl: string | undefined;

    try {
      logger.info('🚀 Starting Linear pipeline', { issueIdentifier });
      logs.push(`Starting pipeline for ${issueIdentifier}`);

      // 1. Linear 이슈 가져오기
      logger.info('📋 Step 1: Fetching Linear issue');
      const issue = await this.linearClient.getIssue(issueIdentifier);
      
      if (!issue) {
        throw new Error(`Linear issue ${issueIdentifier} not found`);
      }
      
      logs.push(`✅ Fetched Linear issue: ${issue.title}`);

      // 2. Git 리포지토리 설정 (코드 분석 전에 필요)
      logger.info('🔧 Step 2: Setting up repository');
      await this.gitManager.setupRepository();
      logs.push('✅ Repository setup complete');

      // 3. 스마트 코드 수정
      logger.info('🤖 Step 3: Analyzing and modifying code');
      this.codeGenerator = new CodeGenerator(this.gitManager.getWorkDir());
      await this.codeGenerator.generateSmartModifications(issue);
      logs.push('✅ Smart code modifications applied');

      // 4. 브랜치 생성
      logger.info('🌿 Step 4: Creating branch');
      branchName = await this.gitManager.createBranch(issue);
      logs.push(`✅ Created branch: ${branchName}`);

      // 5. 커밋 및 푸시 (파일은 이미 수정됨)
      logger.info('💾 Step 5: Committing and pushing');
      commitHash = await this.gitManager.commitAndPush(issue, branchName);
      logs.push(`✅ Committed and pushed: ${commitHash}`);

      // 6. PR 생성
      logger.info('🔗 Step 6: Creating pull request');
      prUrl = await this.prCreator.createPR(issue, branchName);
      logs.push(`✅ Pull request created: ${prUrl}`);

      logger.info('🎉 Pipeline completed successfully', {
        issueIdentifier,
        branchName,
        commitHash,
        prUrl
      });

      return {
        success: true,
        issueId: issueIdentifier,
        branchName,
        commitHash,
        prUrl,
        logs
      };

    } catch (error) {
      logger.error('❌ Pipeline failed', { 
        issueIdentifier, 
        error: error instanceof Error ? error.message : error 
      });

      return {
        success: false,
        issueId: issueIdentifier,
        branchName,
        commitHash,
        prUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [...logs, `❌ Error: ${error instanceof Error ? error.message : error}`]
      };

    } finally {
      // 정리 작업
      try {
        await this.gitManager.cleanup();
        logs.push('🧹 Cleanup completed');
      } catch (cleanupError) {
        logger.warn('Cleanup failed', { cleanupError });
      }
    }
  }
}
