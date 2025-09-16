import { OpenAIService } from '../services/openai-service.js';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface GeneratedImplementation {
  path: string;
  content: string;
  type: 'component' | 'service' | 'api' | 'test' | 'config' | 'style';
  dependencies: string[];
  aiGenerated: boolean;
}

export interface ProjectContext {
  type: 'react' | 'node-api' | 'python' | 'generic';
  technologies: string[];
  patterns: string[];
  dependencies: string[];
}

/**
 * 범용적 하이브리드 코드 생성기
 * - AI 기반 메인 생성
 * - 패턴 기반 폴백
 * - 확장 가능한 구조
 */
export class HybridCodeGenerator {
  private aiService: OpenAIService | null = null;

  constructor(private workDir: string) {
    // AI 서비스는 환경변수 있을 때만 초기화
    if (process.env.OPENAI_API_KEY) {
      this.aiService = new OpenAIService(process.env.OPENAI_API_KEY);
      logger.info('🤖 AI service initialized');
    } else {
      logger.warn('⚠️ AI service not available - using pattern-based generation only');
    }
  }

  async generateCode(issue: LinearIssue): Promise<GeneratedImplementation[]> {
    logger.info('🚀 Starting hybrid code generation', {
      issueId: issue.identifier,
      hasAI: !!this.aiService,
      title: issue.title
    });

    try {
      // 1. 프로젝트 컨텍스트 빠른 분석
      const context = this.analyzeProjectContext(issue);
      
      // 2. AI 기반 생성 (메인 전략)
      if (this.aiService) {
        return await this.generateWithAI(issue, context);
      }
      
      // 3. 패턴 기반 폴백
      return await this.generateWithPatterns(issue, context);

    } catch (error) {
      logger.error('❌ Hybrid generation failed', {
        issueId: issue.identifier,
        error: error instanceof Error ? error.message : error
      });
      
      // 최종 폴백
      return this.generateMinimalFallback(issue);
    }
  }

  private analyzeProjectContext(issue: LinearIssue): ProjectContext {
    const allText = [
      issue.title,
      issue.description || '',
      ...issue.comments.map(c => c.body)
    ].join('\n').toLowerCase();

    // 기술 스택 감지 (범용적)
    const technologies = this.detectTechnologies(allText);
    
    // 프로젝트 타입 감지
    const type = this.detectProjectType(technologies, allText);
    
    // 패턴 감지
    const patterns = this.detectPatterns(allText);

    return {
      type,
      technologies,
      patterns,
      dependencies: technologies
    };
  }

  private detectTechnologies(text: string): string[] {
    const techPatterns = {
      'react': /리액트|react/gi,
      'vue': /뷰|vue/gi,
      'angular': /앵귤러|angular/gi,
      'node.js': /노드|node\.?js/gi,
      'python': /파이썬|python/gi,
      'typescript': /타입스크립트|typescript/gi,
      'javascript': /자바스크립트|javascript/gi,
      'express': /익스프레스|express/gi,
      'fastapi': /fastapi/gi,
      'django': /장고|django/gi
    };

    const detected: string[] = [];
    Object.entries(techPatterns).forEach(([tech, pattern]) => {
      if (pattern.test(text)) {
        detected.push(tech);
      }
    });

    return detected;
  }

  private detectProjectType(technologies: string[], text: string): ProjectContext['type'] {
    if (technologies.includes('react') || technologies.includes('vue') || technologies.includes('angular')) {
      return 'react';
    }
    if (technologies.includes('node.js') || technologies.includes('express')) {
      return 'node-api';
    }
    if (technologies.includes('python') || technologies.includes('django') || technologies.includes('fastapi')) {
      return 'python';
    }
    return 'generic';
  }

  private detectPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // 일반적인 패턴만 감지
    if (text.includes('crud') || text.includes('생성') && text.includes('조회') && text.includes('수정')) {
      patterns.push('crud');
    }
    if (text.includes('api') || text.includes('endpoint')) {
      patterns.push('api');
    }
    if (text.includes('component') || text.includes('컴포넌트')) {
      patterns.push('component');
    }

    return patterns;
  }

  private async generateWithAI(issue: LinearIssue, context: ProjectContext): Promise<GeneratedImplementation[]> {
    logger.info('🤖 Generating with AI', { issueId: issue.identifier });

    try {
      const aiCode = await this.aiService!.generateFromScratch(issue, context);
      
      return [{
        path: this.generateFileName(issue, context),
        content: aiCode,
        type: this.determineFileType(context),
        dependencies: context.dependencies,
        aiGenerated: true
      }];

    } catch (error) {
      logger.warn('AI generation failed, falling back to patterns', { error });
      return await this.generateWithPatterns(issue, context);
    }
  }

  private async generateWithPatterns(issue: LinearIssue, context: ProjectContext): Promise<GeneratedImplementation[]> {
    logger.info('🔧 Generating with patterns', { issueId: issue.identifier });

    const template = this.selectTemplate(context);
    const content = this.fillTemplate(template, issue, context);

    return [{
      path: this.generateFileName(issue, context),
      content,
      type: this.determineFileType(context),
      dependencies: context.dependencies,
      aiGenerated: false
    }];
  }

  private selectTemplate(context: ProjectContext): string {
    // 간단한 템플릿 선택 로직
    switch (context.type) {
      case 'react':
        return this.getReactTemplate();
      case 'node-api':
        return this.getNodeApiTemplate();
      case 'python':
        return this.getPythonTemplate();
      default:
        return this.getGenericTemplate();
    }
  }

  private fillTemplate(template: string, issue: LinearIssue, context: ProjectContext): string {
    return template
      .replace(/{{ISSUE_ID}}/g, issue.identifier)
      .replace(/{{TITLE}}/g, issue.title)
      .replace(/{{URL}}/g, issue.url)
      .replace(/{{DESCRIPTION}}/g, issue.description || 'No description')
      .replace(/{{TECHNOLOGIES}}/g, context.technologies.join(', '))
      .replace(/{{TIMESTAMP}}/g, new Date().toISOString())
      .replace(/{{CLASS_NAME}}/g, this.toPascalCase(issue.title))
      .replace(/{{FUNCTION_NAME}}/g, this.toCamelCase(issue.title));
  }

  private getReactTemplate(): string {
    return `import React from 'react';

/**
 * {{TITLE}}
 * Linear Issue: {{ISSUE_ID}}
 * {{URL}}
 * 
 * Technologies: {{TECHNOLOGIES}}
 * Generated: {{TIMESTAMP}}
 */

export const {{CLASS_NAME}}: React.FC = () => {
  return (
    <div className="{{ISSUE_ID}}-container">
      <h1>{{TITLE}}</h1>
      <p>Implementation for Linear issue {{ISSUE_ID}}</p>
      {/* TODO: Implement based on issue requirements */}
    </div>
  );
};

export default {{CLASS_NAME}};`;
  }

  private getNodeApiTemplate(): string {
    return `/**
 * {{TITLE}}
 * Linear Issue: {{ISSUE_ID}}
 * {{URL}}
 * 
 * Technologies: {{TECHNOLOGIES}}
 * Generated: {{TIMESTAMP}}
 */

export class {{CLASS_NAME}} {
  async execute(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('Executing {{TITLE}}');
      
      // TODO: Implement based on Linear issue requirements
      // Description: {{DESCRIPTION}}
      
      return {
        success: true,
        message: '{{TITLE}} executed successfully',
        data: {
          issueId: '{{ISSUE_ID}}',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error executing {{TITLE}}:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const {{FUNCTION_NAME}} = new {{CLASS_NAME}}();
export default {{FUNCTION_NAME}};`;
  }

  private getPythonTemplate(): string {
    return `"""
{{TITLE}}
Linear Issue: {{ISSUE_ID}}
{{URL}}

Technologies: {{TECHNOLOGIES}}
Generated: {{TIMESTAMP}}
"""

class {{CLASS_NAME}}:
    def __init__(self):
        self.issue_id = "{{ISSUE_ID}}"
        self.title = "{{TITLE}}"
    
    def execute(self):
        """Execute the main functionality"""
        print(f"Executing {self.title}")
        
        # TODO: Implement based on Linear issue requirements
        # Description: {{DESCRIPTION}}
        
        return {
            "success": True,
            "message": f"{self.title} executed successfully",
            "data": {
                "issue_id": self.issue_id,
                "timestamp": "{{TIMESTAMP}}"
            }
        }

# Create instance
{{FUNCTION_NAME}} = {{CLASS_NAME}}()

if __name__ == "__main__":
    result = {{FUNCTION_NAME}}.execute()
    print(result)`;
  }

  private getGenericTemplate(): string {
    return `/**
 * {{TITLE}}
 * Linear Issue: {{ISSUE_ID}}
 * {{URL}}
 * 
 * Technologies: {{TECHNOLOGIES}}
 * Generated: {{TIMESTAMP}}
 */

export const {{FUNCTION_NAME}} = {
  issueId: '{{ISSUE_ID}}',
  title: '{{TITLE}}',
  
  execute: async () => {
    console.log('Executing {{TITLE}}');
    
    // TODO: Implement based on Linear issue requirements
    // Description: {{DESCRIPTION}}
    
    return {
      success: true,
      message: '{{TITLE}} executed successfully',
      issueId: '{{ISSUE_ID}}',
      timestamp: '{{TIMESTAMP}}'
    };
  }
};

export default {{FUNCTION_NAME}};`;
  }

  private generateMinimalFallback(issue: LinearIssue): GeneratedImplementation[] {
    return [{
      path: `src/fallback/${issue.identifier.toLowerCase()}.ts`,
      content: `// Minimal fallback for ${issue.identifier}
export const fallback = () => console.log('${issue.title}');`,
      type: 'service',
      dependencies: [],
      aiGenerated: false
    }];
  }

  private generateFileName(issue: LinearIssue, context: ProjectContext): string {
    const baseName = this.toKebabCase(issue.title);
    const extension = this.getFileExtension(context);
    const directory = this.getDirectory(context);
    
    return `${directory}/${baseName}.${extension}`;
  }

  private getFileExtension(context: ProjectContext): string {
    if (context.technologies.includes('typescript')) {
      return context.type === 'react' ? 'tsx' : 'ts';
    }
    if (context.type === 'react') {
      return 'jsx';
    }
    if (context.type === 'python') {
      return 'py';
    }
    return 'js';
  }

  private getDirectory(context: ProjectContext): string {
    switch (context.type) {
      case 'react':
        return 'src/components';
      case 'node-api':
        return 'src/services';
      case 'python':
        return 'src/modules';
      default:
        return 'src/implementations';
    }
  }

  private determineFileType(context: ProjectContext): GeneratedImplementation['type'] {
    switch (context.type) {
      case 'react':
        return 'component';
      case 'node-api':
        return 'service';
      default:
        return 'service';
    }
  }

  // 유틸리티 메서드들
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

  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private toKebabCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}