import { promises as fs } from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { LinearIssue, MCPToolResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ValidationResult {
  step: string;
  success: boolean;
  score: number; // 0-100 품질 점수
  issues: string[];
  recommendations: string[];
  data?: any;
}

export interface PipelineValidationReport {
  overallSuccess: boolean;
  overallScore: number;
  steps: ValidationResult[];
  summary: string;
}

export class PipelineValidator {
  private workspaceDir: string;

  constructor(workspaceDir: string = './workspace') {
    this.workspaceDir = workspaceDir;
  }

  public async validatePipeline(
    issue: LinearIssue,
    executionResults: Array<{ command: any; result: MCPToolResult }>
  ): Promise<PipelineValidationReport> {
    logger.info('🔍 Starting pipeline validation', { issueId: issue.identifier });

    const validationResults: ValidationResult[] = [];

    // 1. Linear 컨텍스트 품질 검증
    validationResults.push(await this.validateLinearContext(issue));

    // 2. 리포지토리 클론 검증
    const cloneResult = executionResults.find(r => r.command.type === 'repo.clone');
    if (cloneResult) {
      validationResults.push(await this.validateRepositoryClone(cloneResult));
    }

    // 3. 브랜치 생성 검증
    const branchResult = executionResults.find(r => r.command.type === 'branch.create');
    if (branchResult) {
      validationResults.push(await this.validateBranchCreation(branchResult, issue));
    }

    // 4. 구현/수정 결과 검증
    const patchResult = executionResults.find(r => r.command.type === 'repo.apply_patch');
    if (patchResult) {
      validationResults.push(await this.validateImplementation(patchResult, issue));
    }

    // 5. Git 작업 검증
    const commitResult = executionResults.find(r => r.command.type === 'git.commit');
    const pushResult = executionResults.find(r => r.command.type === 'git.push');
    if (commitResult && pushResult) {
      validationResults.push(await this.validateGitOperations(commitResult, pushResult, issue));
    }

    // 6. PR 생성 검증
    const prResult = executionResults.find(r => r.command.type === 'github.pr.create');
    if (prResult) {
      validationResults.push(await this.validatePRCreation(prResult, issue));
    }

    // 전체 결과 계산
    const overallScore = validationResults.reduce((sum, r) => sum + r.score, 0) / validationResults.length;
    const overallSuccess = validationResults.every(r => r.success) && overallScore >= 70;

    const report: PipelineValidationReport = {
      overallSuccess,
      overallScore: Math.round(overallScore),
      steps: validationResults,
      summary: this.generateSummary(validationResults, overallScore)
    };

    logger.info('✅ Pipeline validation completed', {
      issueId: issue.identifier,
      overallSuccess,
      overallScore: report.overallScore
    });

    return report;
  }

  private async validateLinearContext(issue: LinearIssue): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 필수 정보 체크
    if (!issue.title || issue.title.trim().length < 5) {
      issues.push('제목이 너무 짧거나 없음');
      score -= 20;
    }

    if (!issue.description || issue.description.trim().length < 10) {
      issues.push('설명이 부족함');
      score -= 15;
      recommendations.push('이슈 설명을 더 자세히 작성하세요');
    }

    if (!issue.assignee) {
      issues.push('담당자가 지정되지 않음');
      score -= 10;
    }

    if (!issue.labels || issue.labels.length === 0) {
      issues.push('라벨이 없음');
      score -= 10;
      recommendations.push('적절한 라벨을 추가하세요 (bug, feature, enhancement 등)');
    }

    // 컨텍스트 풍부성 체크
    if (!issue.comments || issue.comments.length === 0) {
      score -= 5;
      recommendations.push('추가 컨텍스트를 위해 댓글을 추가하는 것을 고려하세요');
    }

    if ((!issue.attachments || issue.attachments.length === 0) && 
        issue.description && (issue.description.includes('이미지') || issue.description.includes('스크린샷'))) {
      issues.push('이미지/스크린샷 언급이 있지만 첨부파일이 없음');
      score -= 10;
    }

    return {
      step: 'Linear Context Quality',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
        data: {
          titleLength: issue.title?.length || 0,
          descriptionLength: issue.description?.length || 0,
          commentsCount: issue.comments?.length || 0,
          attachmentsCount: issue.attachments?.length || 0,
          labelsCount: issue.labels?.length || 0
        }
    };
  }

  private async validateRepositoryClone(cloneResult: { command: any; result: MCPToolResult }): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (!cloneResult.result.success) {
      issues.push('리포지토리 클론 실패');
      score = 0;
    } else {
      // 클론된 디렉토리 존재 확인
      try {
        const workspaceExists = await fs.access(this.workspaceDir).then(() => true).catch(() => false);
        if (!workspaceExists) {
          issues.push('워크스페이스 디렉토리가 생성되지 않음');
          score -= 50;
        } else {
          // Git 리포지토리 확인
          const git = simpleGit(this.workspaceDir);
          const isRepo = await git.checkIsRepo();
          if (!isRepo) {
            issues.push('유효한 Git 리포지토리가 아님');
            score -= 30;
          }

          // 올바른 브랜치 확인
          const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
          const expectedBranch = cloneResult.command.params.branch || 'main';
          if (currentBranch.trim() !== expectedBranch) {
            issues.push(`잘못된 브랜치 (예상: ${expectedBranch}, 실제: ${currentBranch.trim()})`);
            score -= 20;
          }
        }
      } catch (error) {
        issues.push(`리포지토리 검증 중 오류: ${error}`);
        score -= 30;
      }
    }

    return {
      step: 'Repository Clone',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
      data: cloneResult.result.data
    };
  }

  private async validateBranchCreation(branchResult: { command: any; result: MCPToolResult }, issue: LinearIssue): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (!branchResult.result.success) {
      issues.push('브랜치 생성 실패');
      score = 0;
    } else {
      try {
        const git = simpleGit(this.workspaceDir);
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        const expectedBranch = branchResult.command.params.name;

        if (currentBranch.trim() !== expectedBranch) {
          issues.push(`브랜치 체크아웃 실패 (예상: ${expectedBranch}, 실제: ${currentBranch.trim()})`);
          score -= 50;
        }

        // 브랜치명 규칙 검증
        const branchName = expectedBranch;
        if (!branchName.includes(issue.identifier.toLowerCase())) {
          issues.push('브랜치명에 이슈 ID가 포함되지 않음');
          score -= 20;
        }

        if (!branchName.match(/^(feat|fix|chore|docs)\//)) {
          issues.push('브랜치명이 컨벤션을 따르지 않음');
          score -= 15;
          recommendations.push('브랜치명은 feat/, fix/, chore/, docs/ 등으로 시작해야 합니다');
        }
      } catch (error) {
        issues.push(`브랜치 검증 중 오류: ${error}`);
        score -= 30;
      }
    }

    return {
      step: 'Branch Creation',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
      data: branchResult.result.data
    };
  }

  private async validateImplementation(patchResult: { command: any; result: MCPToolResult }, issue: LinearIssue): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (!patchResult.result.success) {
      issues.push('구현/수정 적용 실패');
      score = 0;
    } else {
      try {
        // 생성된 파일들 확인
        const files = patchResult.command.params.files || [];
        
        for (const file of files) {
          const filePath = path.join(this.workspaceDir, file.path);
          const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
          
          if (!fileExists) {
            issues.push(`파일이 생성되지 않음: ${file.path}`);
            score -= 20;
          } else {
            // 파일 내용 품질 체크
            const content = await fs.readFile(filePath, 'utf-8');
            
            // 기본적인 품질 체크
            if (content.includes('TODO') && !content.includes('Linear:')) {
              issues.push(`${file.path}에 Linear 이슈 참조가 없는 TODO가 있음`);
              score -= 10;
            }

            if (content.length < 50) {
              issues.push(`${file.path} 내용이 너무 짧음`);
              score -= 15;
            }

            // 이슈 컨텍스트 반영 확인
            if (!content.includes(issue.identifier)) {
              issues.push(`${file.path}에 이슈 ID가 포함되지 않음`);
              score -= 10;
            }
          }
        }

        if (files.length === 0) {
          issues.push('생성된 파일이 없음');
          score -= 30;
          recommendations.push('이슈 요구사항에 따라 실제 구현 파일을 생성하세요');
        }
      } catch (error) {
        issues.push(`구현 검증 중 오류: ${error}`);
        score -= 30;
      }
    }

    return {
      step: 'Implementation',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
      data: patchResult.result.data
    };
  }

  private async validateGitOperations(
    commitResult: { command: any; result: MCPToolResult },
    pushResult: { command: any; result: MCPToolResult },
    issue: LinearIssue
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 커밋 검증
    if (!commitResult.result.success) {
      issues.push('커밋 실패');
      score -= 50;
    } else {
      try {
        const git = simpleGit(this.workspaceDir);
        const log = await git.log(['-1']);
        const lastCommit = log.latest;

        if (!lastCommit) {
          issues.push('커밋이 생성되지 않음');
          score -= 50;
        } else {
          // 커밋 메시지 품질 체크
          const message = lastCommit.message;
          
          if (!message.includes(issue.identifier)) {
            issues.push('커밋 메시지에 이슈 ID가 없음');
            score -= 15;
          }

          if (!message.match(/^(feat|fix|chore|docs):/)) {
            issues.push('커밋 메시지가 컨벤션을 따르지 않음');
            score -= 10;
            recommendations.push('커밋 메시지는 feat:, fix:, chore:, docs: 등으로 시작해야 합니다');
          }

          if (message.length < 10) {
            issues.push('커밋 메시지가 너무 짧음');
            score -= 10;
          }
        }
      } catch (error) {
        issues.push(`커밋 검증 중 오류: ${error}`);
        score -= 20;
      }
    }

    // 푸시 검증
    if (!pushResult.result.success) {
      issues.push('푸시 실패');
      score -= 30;
    }

    return {
      step: 'Git Operations',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
      data: {
        commit: commitResult.result.data,
        push: pushResult.result.data
      }
    };
  }

  private async validatePRCreation(prResult: { command: any; result: MCPToolResult }, issue: LinearIssue): Promise<ValidationResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    if (!prResult.result.success) {
      issues.push('PR 생성 실패');
      score = 0;
    } else {
      // PR 데이터 품질 체크
      const prData = prResult.result.data;
      
      if (!prData.url) {
        issues.push('PR URL이 없음');
        score -= 20;
      }

      // PR 제목 체크
      const title = prResult.command.params.title;
      if (!title.includes(issue.identifier)) {
        issues.push('PR 제목에 이슈 ID가 없음');
        score -= 15;
      }

      // PR 본문 체크
      const body = prResult.command.params.body;
      if (!body.includes(issue.url)) {
        issues.push('PR 본문에 Linear 이슈 링크가 없음');
        score -= 10;
      }

      if (body.length < 100) {
        issues.push('PR 본문이 너무 짧음');
        score -= 10;
        recommendations.push('PR 본문에 변경사항과 테스트 방법을 자세히 설명하세요');
      }

      // 라벨 체크
      const labels = prResult.command.params.labels || [];
      if (!labels.includes('auto-generated')) {
        issues.push('자동 생성 라벨이 없음');
        score -= 5;
      }
    }

    return {
      step: 'PR Creation',
      success: score >= 70,
      score: Math.max(0, score),
      issues,
      recommendations,
      data: prResult.result.data
    };
  }

  private generateSummary(results: ValidationResult[], overallScore: number): string {
    const successfulSteps = results.filter(r => r.success).length;
    const totalSteps = results.length;
    
    let summary = `파이프라인 실행 완료: ${successfulSteps}/${totalSteps} 단계 성공, 전체 품질 점수: ${Math.round(overallScore)}점\n\n`;
    
    // 주요 이슈들
    const allIssues = results.flatMap(r => r.issues);
    if (allIssues.length > 0) {
      summary += `🚨 주요 이슈:\n${allIssues.map(issue => `- ${issue}`).join('\n')}\n\n`;
    }
    
    // 개선 권장사항
    const allRecommendations = results.flatMap(r => r.recommendations);
    if (allRecommendations.length > 0) {
      summary += `💡 개선 권장사항:\n${allRecommendations.map(rec => `- ${rec}`).join('\n')}`;
    }
    
    return summary;
  }
}
