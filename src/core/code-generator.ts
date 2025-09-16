import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { CodeAnalyzer } from './code-analyzer.js';
import { CodeModifier } from './code-modifier.js';
import { HybridCodeGenerator } from './hybrid-code-generator.js';

export interface GeneratedFile {
  path: string;
  content: string;
}

export class CodeGenerator {
  private analyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private hybridGenerator: HybridCodeGenerator;
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
    this.analyzer = new CodeAnalyzer(workDir);
    this.modifier = new CodeModifier(workDir);
    this.hybridGenerator = new HybridCodeGenerator(workDir);
  }

  async generateSmartModifications(issue: LinearIssue): Promise<void> {
    logger.info('🚀 Starting HYBRID code generation', { 
      issueId: issue.identifier,
      title: issue.title,
      hasAI: !!process.env.OPENAI_API_KEY
    });

    try {
      // 1. 하이브리드 코드 생성 (패턴 + AI)
      const implementations = await this.hybridGenerator.generateCode(issue);
      
      // 2. 구현을 수정사항으로 변환
      const modifications = implementations.map(impl => ({
        file: impl.path,
        changes: [{
          type: 'add' as const,
          location: 'file',
          content: impl.content,
          reason: `${impl.aiGenerated ? 'AI-enhanced' : 'Pattern-based'} ${impl.type}: ${impl.path}`
        }]
      }));
      
      // 3. 기존 파일 분석 및 컨텍스트 추가 (선택적)
      const codeFiles = await this.analyzer.analyzeRepository();
      if (codeFiles.length > 0) {
        const contextModifications = await this.analyzer.generateModifications(issue, codeFiles);
        // 타입 호환성을 위해 add 타입만 필터링
        const compatibleMods = contextModifications.map(mod => ({
          file: mod.file,
          changes: mod.changes.filter((change): change is { type: 'add'; location: string; content: string; reason: string } => 
            change.type === 'add'
          )
        })).filter(mod => mod.changes.length > 0);
        modifications.push(...compatibleMods.slice(0, 3));
      }
      
      // 4. 모든 수정사항 적용
      await this.modifier.applyModifications(modifications);
      
      logger.info('✅ HYBRID implementation completed', {
        issueId: issue.identifier,
        totalFiles: implementations.length,
        aiEnhanced: implementations.filter(impl => impl.aiGenerated).length,
        patternBased: implementations.filter(impl => !impl.aiGenerated).length,
        dependencies: [...new Set(implementations.flatMap(impl => impl.dependencies))]
      });

    } catch (error) {
      logger.error('❌ Hybrid generation failed, falling back to basic implementation', {
        issueId: issue.identifier,
        error: error instanceof Error ? error.message : error
      });
      
      // 폴백: 기본 구현
      await this.generateFallbackImplementation(issue);
    }
  }

  private async generateFallbackImplementation(issue: LinearIssue): Promise<void> {
    const fallbackContent = `/**
 * Fallback implementation for ${issue.title}
 * Linear Issue: ${issue.identifier}
 * Generated when hybrid generation failed
 */

export const ${this.toCamelCase(issue.title)} = {
  execute: async () => {
    console.log('Executing fallback implementation for: ${issue.title}');
    
    // Basic implementation based on issue title
    return {
      success: true,
      message: 'Fallback implementation executed',
      issueId: '${issue.identifier}',
      timestamp: new Date().toISOString()
    };
  }
};

export default ${this.toCamelCase(issue.title)};`;

    const modifications = [{
      file: `src/fallback/${issue.identifier.toLowerCase()}.ts`,
      changes: [{
        type: 'add' as const,
        location: 'file',
        content: fallbackContent,
        reason: 'Fallback implementation when hybrid generation fails'
      }]
    }];

    await this.modifier.applyModifications(modifications);
    
    logger.info('✅ Fallback implementation completed', { issueId: issue.identifier });
  }

  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .map((word, index) => 
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }

  generateFiles(issue: LinearIssue): GeneratedFile[] {
    logger.info('🤖 Generating code files', { issueId: issue.identifier });

    const files: GeneratedFile[] = [];
    
    // 1. 태스크 문서 파일
    files.push({
      path: `docs/tasks/${issue.identifier.toLowerCase()}.md`,
      content: this.generateTaskDoc(issue)
    });

    // 2. 이슈 타입에 따른 코드 파일 생성
    const issueType = this.getIssueType(issue);
    
    switch (issueType) {
      case 'feature':
        files.push(...this.generateFeatureFiles(issue));
        break;
      case 'bug':
        files.push(...this.generateBugFixFiles(issue));
        break;
      case 'component':
        files.push(...this.generateComponentFiles(issue));
        break;
      default:
        files.push(...this.generateGenericFiles(issue));
    }

    logger.info('✅ Generated code files', { 
      issueId: issue.identifier, 
      fileCount: files.length,
      files: files.map(f => f.path)
    });

    return files;
  }

  private generateTaskDoc(issue: LinearIssue): string {
    return `# ${issue.title}

## Issue Information
- **ID**: ${issue.identifier}
- **Team**: ${issue.team.name} (${issue.team.key})
- **Status**: ${issue.status}
- **Assignee**: ${issue.assignee?.name || 'Unassigned'}
- **URL**: ${issue.url}

## Description
${issue.description || 'No description provided'}

## Labels
${issue.labels.map(label => `- ${label.name}`).join('\n') || 'No labels'}

## Implementation Notes
- Generated automatically from Linear issue
- Created on: ${new Date().toISOString()}

## TODO
- [ ] Review implementation
- [ ] Add tests if needed
- [ ] Update documentation
`;
  }

  private getIssueType(issue: LinearIssue): string {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    const description = (issue.description || '').toLowerCase();

    if (labels.includes('bug') || title.includes('fix') || title.includes('bug')) {
      return 'bug';
    }
    
    if (labels.includes('feature') || title.includes('feature') || title.includes('add')) {
      return 'feature';
    }
    
    if (title.includes('component') || description.includes('component') || 
        title.includes('react') || description.includes('react')) {
      return 'component';
    }
    
    return 'generic';
  }

  private generateFeatureFiles(issue: LinearIssue): GeneratedFile[] {
    const featureName = this.sanitizeFileName(issue.title);
    
    return [
      {
        path: `src/features/${featureName}/${featureName}.ts`,
        content: `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export class ${this.toPascalCase(featureName)} {
  constructor() {
    // TODO: Initialize ${issue.title}
  }

  public execute(): void {
    // TODO: Implement ${issue.title}
    console.log('Executing ${issue.title}');
  }
}

export default ${this.toPascalCase(featureName)};
`
      },
      {
        path: `src/features/${featureName}/${featureName}.test.ts`,
        content: `import { ${this.toPascalCase(featureName)} } from './${featureName}';

describe('${this.toPascalCase(featureName)}', () => {
  let feature: ${this.toPascalCase(featureName)};

  beforeEach(() => {
    feature = new ${this.toPascalCase(featureName)}();
  });

  it('should be created', () => {
    expect(feature).toBeDefined();
  });

  it('should execute successfully', () => {
    expect(() => feature.execute()).not.toThrow();
  });

  // TODO: Add more tests based on ${issue.identifier} requirements
});
`
      }
    ];
  }

  private generateBugFixFiles(issue: LinearIssue): GeneratedFile[] {
    const bugName = this.sanitizeFileName(issue.title);
    
    return [
      {
        path: `src/fixes/${bugName}.ts`,
        content: `/**
 * Bug Fix: ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export function fix${this.toPascalCase(bugName)}(): void {
  // TODO: Implement fix for ${issue.title}
  console.log('Applying fix for ${issue.title}');
}

export default fix${this.toPascalCase(bugName)};
`
      }
    ];
  }

  private generateComponentFiles(issue: LinearIssue): GeneratedFile[] {
    const componentName = this.sanitizeFileName(issue.title);
    
    return [
      {
        path: `src/components/${this.toPascalCase(componentName)}.tsx`,
        content: `import React from 'react';

/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

interface ${this.toPascalCase(componentName)}Props {
  // TODO: Define props based on ${issue.identifier} requirements
}

export const ${this.toPascalCase(componentName)}: React.FC<${this.toPascalCase(componentName)}Props> = (props) => {
  return (
    <div>
      <h1>${issue.title}</h1>
      <p>TODO: Implement component based on ${issue.identifier}</p>
    </div>
  );
};

export default ${this.toPascalCase(componentName)};
`
      },
      {
        path: `src/components/${this.toPascalCase(componentName)}.test.tsx`,
        content: `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${this.toPascalCase(componentName)} from './${this.toPascalCase(componentName)}';

describe('${this.toPascalCase(componentName)}', () => {
  it('renders without crashing', () => {
    render(<${this.toPascalCase(componentName)} />);
    expect(screen.getByText('${issue.title}')).toBeInTheDocument();
  });

  // TODO: Add more tests based on ${issue.identifier} requirements
});
`
      }
    ];
  }

  private generateGenericFiles(issue: LinearIssue): GeneratedFile[] {
    const fileName = this.sanitizeFileName(issue.title);
    
    return [
      {
        path: `src/tasks/${fileName}.ts`,
        content: `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export function ${this.toCamelCase(fileName)}(): void {
  // TODO: Implement ${issue.title}
  console.log('Executing task: ${issue.title}');
}

export default ${this.toCamelCase(fileName)};
`
      }
    ];
  }

  private sanitizeFileName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }


}
