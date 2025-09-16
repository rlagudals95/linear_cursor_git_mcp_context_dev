import { ImperativeCommand, ImperativePlan, LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class PlanBuilder {
  private readonly BRANCH_PREFIX_MAP: Record<string, string> = {
    'bug': 'fix',
    'feature': 'feat',
    'enhancement': 'feat',
    'task': 'chore',
    'documentation': 'docs'
  };

  public async createPlan(issue: LinearIssue): Promise<ImperativePlan> {
    try {
      logger.info('Creating imperative plan for issue', { issueId: issue.identifier });

      const branchName = this.generateBranchName(issue);
      logger.info('Generated branch name', { issueId: issue.identifier, branchName });
      
      const commands = this.generateCommands(issue, branchName);
      logger.info('Generated commands', { issueId: issue.identifier, commandCount: commands.length });

      const plan: ImperativePlan = {
        issueId: issue.identifier,
        branchName,
        commands
      };

      logger.info('Generated imperative plan', {
        issueId: issue.identifier,
        branchName,
        commandCount: commands.length
      });

      return plan;
    } catch (error) {
      logger.error('💥 Error creating plan', {
        issueId: issue.identifier,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private generateBranchName(issue: LinearIssue): string {
    // 라벨에서 브랜치 타입 결정
    const branchType = this.getBranchTypeFromLabels(issue.labels);
    
    return `${branchType}/${issue.identifier.toLowerCase()}`;
  }

  private getBranchTypeFromLabels(labels: Array<{ name: string }>): string {
    for (const label of labels) {
      const labelName = label.name.toLowerCase();
      if (this.BRANCH_PREFIX_MAP[labelName]) {
        return this.BRANCH_PREFIX_MAP[labelName];
      }
    }
    return 'feat'; // 기본값
  }

  private generateCommands(issue: LinearIssue, branchName: string): ImperativeCommand[] {
    const commands: ImperativeCommand[] = [];

    // 1. 타겟 리포지토리 클론
    const githubOwner = process.env.GITHUB_OWNER?.trim();
    const githubRepo = process.env.GITHUB_REPO?.trim();
    
    if (githubOwner && githubRepo) {
      commands.push({
        id: 'clone-repo',
        type: 'repo.clone',
        params: {
          url: `https://github.com/${githubOwner}/${githubRepo}.git`,
          branch: 'develop'
        },
        description: `Clone target repository ${githubOwner}/${githubRepo}`
      });
    }

    // 2. 브랜치 생성
    commands.push({
      id: 'create-branch',
      type: 'branch.create',
      params: {
        name: branchName,
        from: 'develop'
      },
      description: `브랜치 ${branchName} 생성`
    });

    // 3. 코드 변경 적용
    const patchCommands = this.generatePatchCommands(issue);
    commands.push(...patchCommands);

    // 4. 테스트 실행 (선택적)
    if (this.shouldRunTests(issue)) {
      commands.push({
        id: 'run-tests',
        type: 'test.run',
        params: {
          command: 'npm test',
          timeout: 60000
        },
        description: '테스트 실행'
      });
    }

    // 5. 린팅 (선택적) - 현재 비활성화
    // if (this.shouldRunLint(issue)) {
    //   commands.push({
    //     id: 'run-lint',
    //     type: 'test.run',
    //     params: {
    //       command: 'npm run lint --fix'
    //     },
    //     description: '린팅 및 자동 수정'
    //   });
    // }

    // 6. 파일 추가
    commands.push({
      id: 'git-add',
      type: 'git.commit',
      params: {
        files: ['.']
      },
      description: '변경된 파일들을 스테이징 영역에 추가'
    });

    // 7. 커밋
    commands.push({
      id: 'git-commit',
      type: 'git.commit',
      params: {
        message: this.generateCommitMessage(issue)
      },
      description: '변경사항 커밋'
    });

    // 8. 푸시
    commands.push({
      id: 'git-push',
      type: 'git.push',
      params: {
        remote: 'origin',
        branch: branchName,
        setUpstream: true
      },
      description: '원격 저장소에 푸시'
    });

    // 9. PR 생성
    commands.push({
      id: 'create-pr',
      type: 'github.pr.create',
      params: {
        title: this.generatePRTitle(issue),
        body: this.generatePRBody(issue),
        head: branchName,
          base: 'develop',
        draft: this.shouldCreateDraftPR(issue),
        assignees: issue.assignee ? [issue.assignee.name] : [],
        labels: this.generatePRLabels(issue)
      },
      description: 'Pull Request 생성'
    });

    return commands;
  }

  private generatePatchCommands(issue: LinearIssue): ImperativeCommand[] {
    const commands: ImperativeCommand[] = [];

    // 임시로 더미 파일 생성 (실제 AI 코드 생성 전까지)
    commands.push({
      id: 'create-task-file',
      type: 'repo.apply_patch',
      params: {
        files: [{
          path: `tasks/${issue.identifier.toLowerCase()}.md`,
          content: this.generateTaskFile(issue),
          operation: 'create'
        }]
      },
      description: `태스크 파일 생성: ${issue.identifier}`
    });

    return commands;
  }


  private generateBugFixFiles(issue: LinearIssue): Array<{ path: string; content: string; operation: string }> {
    // 실제로는 이슈 설명에서 파일 경로를 파싱해야 함
    return [
      {
        path: 'src/utils/bugfix.ts',
        content: `// Bug fix for ${issue.identifier}\n// TODO: Implement fix based on issue description\n`,
        operation: 'create'
      }
    ];
  }

  private generateFeatureTemplate(issue: LinearIssue, featureName: string): string {
    return `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export class ${this.capitalize(featureName)} {
  constructor() {
    // TODO: Implement ${issue.title}
  }

  public execute(): void {
    // TODO: Add implementation based on issue requirements
    throw new Error('Not implemented yet');
  }
}

export default ${this.capitalize(featureName)};
`;
  }

  private generateTestTemplate(issue: LinearIssue, featureName: string): string {
    return `import { ${this.capitalize(featureName)} } from './${featureName}';

describe('${this.capitalize(featureName)}', () => {
  let ${featureName}: ${this.capitalize(featureName)};

  beforeEach(() => {
    ${featureName} = new ${this.capitalize(featureName)}();
  });

  it('should be created', () => {
    expect(${featureName}).toBeDefined();
  });

  // TODO: Add more tests based on ${issue.identifier} requirements
});
`;
  }

  private generateCommitMessage(issue: LinearIssue): string {
    const type = this.getCommitType(issue);
    const scope = issue.team.key.toLowerCase();
    const description = issue.title.toLowerCase();
    
    return `${type}(${scope}): ${description} (Linear: ${issue.identifier})`;
  }

  private generatePRTitle(issue: LinearIssue): string {
    return `${issue.identifier}-${issue.id}`;
  }

  private generatePRBody(issue: LinearIssue): string {
    return `## 📋 Issue
${issue.url}

## 📝 Description
${issue.description || 'No description provided'}

## ✅ Checklist
- [ ] 코드 리뷰 완료
- [ ] 테스트 추가/업데이트
- [ ] 문서 업데이트 (필요한 경우)
- [ ] Breaking changes 확인

## 🔗 Related
- Linear Issue: ${issue.identifier}
- Team: ${issue.team.name}
${issue.assignee ? `- Assignee: ${issue.assignee.name}` : ''}

---
*This PR was automatically generated from Linear issue ${issue.identifier}*
`;
  }

  private generatePRLabels(issue: LinearIssue): string[] {
    const labels = ['auto-generated'];
    
    // Linear 라벨을 GitHub 라벨로 매핑
    issue.labels.forEach(label => {
      labels.push(label.name.toLowerCase());
    });

    // 우선순위 라벨 추가
    if (issue.priority) {
      const priorityLabels = ['', 'urgent', 'high', 'normal', 'low'];
      if (priorityLabels[issue.priority]) {
        labels.push(`priority: ${priorityLabels[issue.priority]}`);
      }
    }

    return labels;
  }

  private getCommitType(issue: LinearIssue): string {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    
    if (labels.includes('bug')) return 'fix';
    if (labels.includes('feature') || labels.includes('enhancement')) return 'feat';
    if (labels.includes('documentation')) return 'docs';
    if (labels.includes('refactor')) return 'refactor';
    if (labels.includes('test')) return 'test';
    
    return 'feat'; // 기본값
  }

  private isNewFeature(issue: LinearIssue): boolean {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    return labels.includes('feature') || labels.includes('enhancement');
  }

  private isBugFix(issue: LinearIssue): boolean {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    return labels.includes('bug');
  }

  private shouldRunTests(issue: LinearIssue): boolean {
    // 버그 수정이나 새 기능의 경우 테스트 실행
    return this.isBugFix(issue) || this.isNewFeature(issue);
  }

  private shouldRunLint(issue: LinearIssue): boolean {
    // 모든 코드 변경에 대해 린팅 실행
    return true;
  }

  private shouldCreateDraftPR(issue: LinearIssue): boolean {
    // 큰 기능이나 실험적 기능의 경우 드래프트로 생성
    const estimate = issue.estimate || 0;
    return estimate > 8; // 8 포인트 이상이면 드래프트
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private generateTaskFile(issue: LinearIssue): string {
    return `# ${issue.title}

## Issue Information
- **ID**: ${issue.identifier}
- **Team**: ${issue.team.name} (${issue.team.key})
- **Status**: ${issue.status}
- **Priority**: ${issue.priority || 'Not set'}
- **Assignee**: ${issue.assignee?.name || 'Unassigned'}
- **URL**: ${issue.url}

## Description
${issue.description || 'No description provided'}

## Labels
${issue.labels?.map(label => `- ${label.name}`).join('\n') || 'No labels'}

## Comments
${issue.comments?.map(comment => `
### ${comment.user.name} (${comment.createdAt})
${comment.body}
`).join('\n') || 'No comments'}

## Attachments
${issue.attachments?.map(attachment => `- [${attachment.title}](${attachment.url})`).join('\n') || 'No attachments'}

---
*Generated by MCP Context Processor on ${new Date().toISOString()}*
`;
  }
}
