import { promises as fs } from 'fs';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { GitConfig, LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { GeneratedFile } from './code-generator.js';

export class GitManager {
  private git: SimpleGit;
  private workDir: string;
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
    this.workDir = `/tmp/linear-pipeline-${Date.now()}`;
    this.git = simpleGit();
  }

  getWorkDir(): string {
    return this.workDir;
  }

  async setupRepository(): Promise<void> {
    logger.info('🔧 Setting up repository', { 
      owner: this.config.owner, 
      repo: this.config.repo,
      workDir: this.workDir 
    });

    // 임시 디렉토리 생성
    await fs.mkdir(this.workDir, { recursive: true });

    // 리포지토리 클론
    const repoUrl = `https://${this.config.token}@github.com/${this.config.owner}/${this.config.repo}.git`;
    await this.git.clone(repoUrl, this.workDir);

    // Git 인스턴스를 작업 디렉토리로 설정
    this.git = simpleGit(this.workDir);

    logger.info('✅ Repository setup complete');
  }

  async createBranch(issue: LinearIssue): Promise<string> {
    const branchName = this.generateBranchName(issue);
    
    logger.info('🌿 Creating branch', { branchName });

    // develop 브랜치로 체크아웃 (없으면 main)
    try {
      await this.git.checkout('develop');
    } catch {
      await this.git.checkout('main');
    }

    // 기존 브랜치가 있으면 삭제
    try {
      // 로컬 브랜치 삭제
      await this.git.deleteLocalBranch(branchName, true);
      logger.info('🗑️ Deleted existing local branch', { branchName });
    } catch {
      // 브랜치가 없으면 무시
    }

    try {
      // 원격 브랜치 삭제
      await this.git.push('origin', `:${branchName}`);
      logger.info('🗑️ Deleted existing remote branch', { branchName });
    } catch {
      // 원격 브랜치가 없으면 무시
    }

    // 새 브랜치 생성 및 체크아웃
    await this.git.checkoutLocalBranch(branchName);

    logger.info('✅ Branch created', { branchName });
    return branchName;
  }

  async writeFiles(files: GeneratedFile[]): Promise<void> {
    logger.info('📝 Writing generated files', { fileCount: files.length });

    for (const file of files) {
      const fullPath = path.join(this.workDir, file.path);
      const dir = path.dirname(fullPath);

      // 디렉토리 생성
      await fs.mkdir(dir, { recursive: true });

      // 파일 작성
      await fs.writeFile(fullPath, file.content, 'utf-8');
      
      logger.info('📄 File written', { path: file.path });
    }

    logger.info('✅ All files written');
  }

  async commitAndPush(issue: LinearIssue, branchName: string): Promise<string> {
    logger.info('💾 Committing and pushing changes');

    // 모든 변경사항 추가
    await this.git.add('.');

    // 커밋 메시지 생성
    const commitMessage = this.generateCommitMessage(issue);
    
    // 커밋
    const commitResult = await this.git.commit(commitMessage);
    const commitHash = commitResult.commit;

    // 푸시
    await this.git.push('origin', branchName, { '--set-upstream': null });

    logger.info('✅ Changes committed and pushed', { 
      commitHash,
      branchName 
    });

    return commitHash;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.workDir.startsWith('/tmp/linear-pipeline-')) {
        await fs.rm(this.workDir, { recursive: true, force: true });
        logger.info('🧹 Cleaned up temporary directory', { workDir: this.workDir });
      }
    } catch (error) {
      logger.warn('Failed to cleanup', { workDir: this.workDir, error });
    }
  }

  private generateBranchName(issue: LinearIssue): string {
    const type = this.getBranchType(issue);
    const slug = this.titleToSlug(issue.title);
    return `${type}/${issue.identifier.toLowerCase()}-${slug}`;
  }

  private getBranchType(issue: LinearIssue): string {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();

    if (labels.includes('bug') || title.includes('fix') || title.includes('bug')) {
      return 'fix';
    }
    
    if (labels.includes('feature') || title.includes('feature') || title.includes('add')) {
      return 'feat';
    }
    
    if (labels.includes('docs') || title.includes('doc')) {
      return 'docs';
    }
    
    return 'feat';
  }

  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }

  private generateCommitMessage(issue: LinearIssue): string {
    const type = this.getBranchType(issue);
    const scope = issue.team.key.toLowerCase();
    
    return `${type}(${scope}): ${issue.title}

Linear Issue: ${issue.identifier}
${issue.url}

${issue.description || 'Auto-generated implementation'}`;
  }
}
