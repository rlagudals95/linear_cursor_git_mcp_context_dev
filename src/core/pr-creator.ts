import { Octokit } from '@octokit/rest';
import { GitConfig, LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class PRCreator {
  private octokit: Octokit;
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
    this.octokit = new Octokit({ auth: config.token });
  }

  async createPR(issue: LinearIssue, branchName: string): Promise<string> {
    logger.info('🔗 Creating pull request', { 
      branchName,
      issueId: issue.identifier 
    });

    const prData = {
      owner: this.config.owner,
      repo: this.config.repo,
      title: this.generatePRTitle(issue),
      body: this.generatePRBody(issue),
      head: branchName,
      base: await this.getBaseBranch(),
      draft: false
    };

    try {
      const { data: pr } = await this.octokit.rest.pulls.create(prData);

      // 라벨 추가
      const labels = this.generateLabels(issue);
      if (labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.config.owner,
          repo: this.config.repo,
          issue_number: pr.number,
          labels
        });
      }

      // 담당자 할당
      if (issue.assignee) {
        try {
          await this.octokit.rest.issues.addAssignees({
            owner: this.config.owner,
            repo: this.config.repo,
            issue_number: pr.number,
            assignees: [issue.assignee.name]
          });
        } catch (error) {
          logger.warn('Failed to assign PR', { assignee: issue.assignee.name, error });
        }
      }

      logger.info('✅ Pull request created', {
        prNumber: pr.number,
        prUrl: pr.html_url
      });

      return pr.html_url;
    } catch (error) {
      logger.error('Failed to create PR', { error, prData });
      throw error;
    }
  }

  private async getBaseBranch(): Promise<string> {
    try {
      // develop 브랜치가 있는지 확인
      await this.octokit.rest.repos.getBranch({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: 'develop'
      });
      return 'develop';
    } catch {
      return 'main';
    }
  }

  private generatePRTitle(issue: LinearIssue): string {
    return `[${issue.identifier}] ${issue.title}`;
  }

  private generatePRBody(issue: LinearIssue): string {
    return `## 📋 Linear Issue
${issue.url}

## 📝 Description
${issue.description || 'Auto-generated implementation based on Linear issue'}

## 🔄 Changes
- Auto-generated code based on issue requirements
- Added documentation and task files
- Implemented basic structure for ${issue.title}

## ✅ Checklist
- [x] Code generated based on Linear issue
- [ ] Manual review required
- [ ] Tests added/updated (if needed)
- [ ] Documentation updated

## 🏷️ Labels
${issue.labels.map(label => `- ${label.name}`).join('\n') || 'No labels'}

## 👤 Team
- **Team**: ${issue.team.name} (${issue.team.key})
- **Assignee**: ${issue.assignee?.name || 'Unassigned'}

---
*This PR was automatically generated from Linear issue ${issue.identifier}*
*Generated on: ${new Date().toISOString()}*`;
  }

  private generateLabels(issue: LinearIssue): string[] {
    const labels = ['auto-generated'];
    
    // Linear 라벨을 GitHub 라벨로 매핑
    issue.labels.forEach(label => {
      const labelName = label.name.toLowerCase();
      labels.push(labelName);
    });

    // 이슈 타입에 따른 라벨
    const title = issue.title.toLowerCase();
    if (title.includes('bug') || title.includes('fix')) {
      labels.push('bug');
    } else if (title.includes('feature') || title.includes('add')) {
      labels.push('enhancement');
    }

    return [...new Set(labels)]; // 중복 제거
  }
}
