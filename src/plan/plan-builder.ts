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
    logger.info('Creating imperative plan for issue', { issueId: issue.identifier });

    const branchName = this.generateBranchName(issue);
    const commands = this.generateCommands(issue, branchName);

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
  }

  private generateBranchName(issue: LinearIssue): string {
    // 라벨에서 브랜치 타입 결정
    const branchType = this.getBranchTypeFromLabels(issue.labels);
    
    // 제목을 slug로 변환
    const slug = this.titleToSlug(issue.title);
    
    return `${branchType}/${issue.identifier.toLowerCase()}-${slug}`;
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

  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '') // 특수문자 제거 (한글 포함)
      .replace(/\s+/g, '-') // 공백을 하이픈으로
      .replace(/-+/g, '-') // 연속 하이픈 제거
      .replace(/^-|-$/g, '') // 앞뒤 하이픈 제거
      .substring(0, 50); // 길이 제한
  }

  private generateCommands(issue: LinearIssue, branchName: string): ImperativeCommand[] {
    const commands: ImperativeCommand[] = [];

    // 1. 브랜치 생성
    commands.push({
      id: 'create-branch',
      type: 'branch.create',
      params: {
        name: branchName,
        from: 'main'
      },
      description: `브랜치 ${branchName} 생성`
    });

    // 2. 코드 변경 적용
    const patchCommands = this.generatePatchCommands(issue);
    commands.push(...patchCommands);

    // 3. 테스트 실행 (선택적)
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

    // 4. 린팅 (선택적)
    if (this.shouldRunLint(issue)) {
      commands.push({
        id: 'run-lint',
        type: 'test.run',
        params: {
          command: 'npm run lint --fix'
        },
        description: '린팅 및 자동 수정'
      });
    }

    // 5. 파일 추가
    commands.push({
      id: 'git-add',
      type: 'git.commit',
      params: {
        files: ['.']
      },
      description: '변경된 파일들을 스테이징 영역에 추가'
    });

    // 6. 커밋
    commands.push({
      id: 'git-commit',
      type: 'git.commit',
      params: {
        message: this.generateCommitMessage(issue)
      },
      description: '변경사항 커밋'
    });

    // 7. 푸시
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

    // 8. PR 생성
    commands.push({
      id: 'create-pr',
      type: 'github.pr.create',
      params: {
        title: this.generatePRTitle(issue),
        body: this.generatePRBody(issue),
        head: branchName,
        base: 'main',
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

    // 이슈 설명에서 파일 변경 사항 추출 (간단한 예시)
    const description = issue.description || '';
    
    // 기본적인 스캐폴딩 파일 생성
    if (this.isNewFeature(issue)) {
      commands.push({
        id: 'create-feature-files',
        type: 'repo.apply_patch',
        params: {
          files: this.generateFeatureFiles(issue)
        },
        description: '기능 파일들 생성'
      });
    }

    // 버그 수정의 경우
    if (this.isBugFix(issue)) {
      commands.push({
        id: 'apply-bug-fix',
        type: 'repo.apply_patch',
        params: {
          files: this.generateBugFixFiles(issue)
        },
        description: '버그 수정 적용'
      });
    }

    return commands;
  }

  private generateFeatureFiles(issue: LinearIssue): Array<{ path: string; content: string; operation: string }> {
    const featureName = this.titleToSlug(issue.title).replace(/-/g, '');
    
    return [
      {
        path: `src/features/${featureName}/${featureName}.ts`,
        content: this.generateFeatureTemplate(issue, featureName),
        operation: 'create'
      },
      {
        path: `src/features/${featureName}/${featureName}.test.ts`,
        content: this.generateTestTemplate(issue, featureName),
        operation: 'create'
      }
    ];
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
    return `[${issue.identifier}] ${issue.title}`;
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
}
