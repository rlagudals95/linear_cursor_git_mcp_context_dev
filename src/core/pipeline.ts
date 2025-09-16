import { GitConfig, PipelineResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { CodeGenerator } from './code-generator.js';
import { GitManager } from './git-manager.js';
import { LinearClient } from './linear-client.js';
import { PRCreator } from './pr-creator.js';

export class LinearPipeline {
  private linearClient: LinearClient;
  private codeGenerator: CodeGenerator;
  private gitManager: GitManager;
  private prCreator: PRCreator;

  constructor(linearApiKey: string, gitConfig: GitConfig) {
    this.linearClient = new LinearClient(linearApiKey);
    this.codeGenerator = new CodeGenerator();
    this.gitManager = new GitManager(gitConfig);
    this.prCreator = new PRCreator(gitConfig);
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

      // 2. 코드 생성
      logger.info('🤖 Step 2: Generating code');
      const generatedFiles = this.codeGenerator.generateFiles(issue);
      logs.push(`✅ Generated ${generatedFiles.length} files`);

      // 3. Git 리포지토리 설정
      logger.info('🔧 Step 3: Setting up repository');
      await this.gitManager.setupRepository();
      logs.push('✅ Repository setup complete');

      // 4. 브랜치 생성
      logger.info('🌿 Step 4: Creating branch');
      branchName = await this.gitManager.createBranch(issue);
      logs.push(`✅ Created branch: ${branchName}`);

      // 5. 파일 작성
      logger.info('📝 Step 5: Writing files');
      await this.gitManager.writeFiles(generatedFiles);
      logs.push('✅ Files written to repository');

      // 6. 커밋 및 푸시
      logger.info('💾 Step 6: Committing and pushing');
      commitHash = await this.gitManager.commitAndPush(issue, branchName);
      logs.push(`✅ Committed and pushed: ${commitHash}`);

      // 7. PR 생성
      logger.info('🔗 Step 7: Creating pull request');
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
