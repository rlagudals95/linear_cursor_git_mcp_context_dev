import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface ContextualRequirement {
  type: 'function' | 'class' | 'component' | 'api' | 'test' | 'config' | 'style';
  name: string;
  description: string;
  implementation: string;
  dependencies: string[];
  testCases: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ContextAnalysis {
  requirements: ContextualRequirement[];
  technologies: string[];
  patterns: string[];
  businessLogic: string[];
  userStories: string[];
  acceptanceCriteria: string[];
}

export class ContextAnalyzer {
  
  analyzeIssueContext(issue: LinearIssue): ContextAnalysis {
    logger.info('🔍 Analyzing issue context', { 
      issueId: issue.identifier,
      commentsCount: issue.comments.length 
    });

    // 모든 텍스트 컨텍스트 수집
    const allText = this.collectAllText(issue);
    
    // 기술 스택 분석
    const technologies = this.extractTechnologies(allText);
    
    // 패턴 및 아키텍처 분석
    const patterns = this.extractPatterns(allText);
    
    // 비즈니스 로직 추출
    const businessLogic = this.extractBusinessLogic(allText);
    
    // 사용자 스토리 추출
    const userStories = this.extractUserStories(allText);
    
    // 인수 조건 추출
    const acceptanceCriteria = this.extractAcceptanceCriteria(allText);
    
    // 구체적인 요구사항 생성
    const requirements = this.generateRequirements(issue, {
      technologies,
      patterns,
      businessLogic,
      userStories,
      acceptanceCriteria
    });

    const analysis: ContextAnalysis = {
      requirements,
      technologies,
      patterns,
      businessLogic,
      userStories,
      acceptanceCriteria
    };

    logger.info('✅ Context analysis complete', {
      issueId: issue.identifier,
      requirementsCount: requirements.length,
      technologies: technologies.slice(0, 3),
      patterns: patterns.slice(0, 3)
    });

    return analysis;
  }

  private collectAllText(issue: LinearIssue): string {
    const texts = [
      issue.title,
      issue.description || '',
      ...issue.comments.map(c => c.body),
      ...issue.labels.map(l => l.name)
    ];
    
    return texts.join('\n').toLowerCase();
  }

  private extractTechnologies(text: string): string[] {
    const techPatterns = {
      // Frontend
      'react': /\b(react|jsx|tsx|component|hook|state|props)\b/gi,
      'vue': /\b(vue|vuejs|composition api|reactive)\b/gi,
      'angular': /\b(angular|typescript|component|service|directive)\b/gi,
      'next.js': /\b(next\.?js|ssr|getServerSideProps|getStaticProps)\b/gi,
      
      // Backend
      'node.js': /\b(node\.?js|express|fastify|koa)\b/gi,
      'python': /\b(python|django|flask|fastapi|pandas)\b/gi,
      'java': /\b(java|spring|springboot|maven|gradle)\b/gi,
      'go': /\b(golang|go|goroutine|gin|echo)\b/gi,
      
      // Database
      'mongodb': /\b(mongodb|mongo|mongoose|nosql)\b/gi,
      'postgresql': /\b(postgresql|postgres|sql|prisma|sequelize)\b/gi,
      'redis': /\b(redis|cache|session|pub\/sub)\b/gi,
      
      // Tools & Services
      'docker': /\b(docker|container|dockerfile|compose)\b/gi,
      'kubernetes': /\b(kubernetes|k8s|pod|deployment|service)\b/gi,
      'aws': /\b(aws|s3|ec2|lambda|cloudformation)\b/gi,
      'graphql': /\b(graphql|apollo|relay|query|mutation)\b/gi,
      'rest': /\b(rest|restful|api|endpoint|json)\b/gi,
      
      // Testing
      'jest': /\b(jest|test|spec|mock|snapshot)\b/gi,
      'cypress': /\b(cypress|e2e|integration test)\b/gi,
      'playwright': /\b(playwright|browser test|automation)\b/gi
    };

    const technologies: string[] = [];
    
    for (const [tech, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(text)) {
        technologies.push(tech);
      }
    }

    return technologies;
  }

  private extractPatterns(text: string): string[] {
    const patternMatches = {
      'mvc': /\b(mvc|model.*view.*controller|separation of concerns)\b/gi,
      'mvvm': /\b(mvvm|model.*view.*viewmodel|data binding)\b/gi,
      'microservices': /\b(microservice|service.*oriented|distributed)\b/gi,
      'event-driven': /\b(event.*driven|pub.*sub|message.*queue|event.*bus)\b/gi,
      'crud': /\b(crud|create.*read.*update.*delete|basic operations)\b/gi,
      'authentication': /\b(auth|login|jwt|oauth|session|token)\b/gi,
      'validation': /\b(validation|validate|sanitize|check|verify)\b/gi,
      'pagination': /\b(pagination|page|limit|offset|cursor)\b/gi,
      'search': /\b(search|filter|query|find|lookup)\b/gi,
      'real-time': /\b(real.*time|websocket|socket\.io|live|streaming)\b/gi
    };

    const patterns: string[] = [];
    
    for (const [pattern, regex] of Object.entries(patternMatches)) {
      if (regex.test(text)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private extractBusinessLogic(text: string): string[] {
    const businessLogic: string[] = [];
    
    // 비즈니스 로직 키워드 패턴
    const businessPatterns = [
      /계산[하해]/g,
      /처리[하해]/g,
      /관리[하해]/g,
      /생성[하해]/g,
      /수정[하해]/g,
      /삭제[하해]/g,
      /조회[하해]/g,
      /검증[하해]/g,
      /승인[하해]/g,
      /거부[하해]/g,
      /알림[하해]/g,
      /전송[하해]/g,
      /저장[하해]/g,
      /업로드[하해]/g,
      /다운로드[하해]/g,
      /\b(calculate|process|manage|create|update|delete|retrieve|validate|approve|reject|notify|send|save|upload|download)\b/gi
    ];

    for (const pattern of businessPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        businessLogic.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(businessLogic)];
  }

  private extractUserStories(text: string): string[] {
    const userStories: string[] = [];
    
    // "~로서", "~하고 싶다", "~할 수 있다" 패턴
    const storyPatterns = [
      /.*로서.*하고\s*싶다/g,
      /.*할\s*수\s*있다/g,
      /.*해야\s*한다/g,
      /as\s+a.*i\s+want.*so\s+that/gi,
      /given.*when.*then/gi
    ];

    for (const pattern of storyPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        userStories.push(...matches);
      }
    }

    return userStories;
  }

  private extractAcceptanceCriteria(text: string): string[] {
    const criteria: string[] = [];
    
    // 인수 조건 패턴
    const criteriaPatterns = [
      /- \[[ x]\].*$/gm,  // 체크리스트
      /\d+\.\s+.*$/gm,    // 번호 목록
      /•\s+.*$/gm,        // 불릿 포인트
      /should\s+.*$/gmi,  // should 문장
      /must\s+.*$/gmi,    // must 문장
      /반드시.*$/gm,      // 반드시
      /필수.*$/gm,        // 필수
      /조건.*$/gm         // 조건
    ];

    for (const pattern of criteriaPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        criteria.push(...matches.map(m => m.trim()));
      }
    }

    return criteria;
  }

  private generateRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    const requirements: ContextualRequirement[] = [];
    
    // 이슈 타입에 따른 기본 요구사항
    const issueType = this.determineIssueType(issue, context);
    
    switch (issueType) {
      case 'feature':
        requirements.push(...this.generateFeatureRequirements(issue, context));
        break;
      case 'bug':
        requirements.push(...this.generateBugfixRequirements(issue, context));
        break;
      case 'api':
        requirements.push(...this.generateApiRequirements(issue, context));
        break;
      case 'component':
        requirements.push(...this.generateComponentRequirements(issue, context));
        break;
      default:
        requirements.push(...this.generateGenericRequirements(issue, context));
    }

    return requirements;
  }

  private determineIssueType(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const title = issue.title.toLowerCase();
    const description = (issue.description || '').toLowerCase();
    const labels = issue.labels.map(l => l.name.toLowerCase());
    
    if (labels.includes('bug') || title.includes('fix') || title.includes('버그')) {
      return 'bug';
    }
    
    if (context.technologies.includes('react') || title.includes('component') || title.includes('컴포넌트')) {
      return 'component';
    }
    
    if (title.includes('api') || description.includes('endpoint') || context.patterns.includes('rest')) {
      return 'api';
    }
    
    return 'feature';
  }

  private generateFeatureRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    const requirements: ContextualRequirement[] = [];
    const featureName = this.extractFeatureName(issue);
    
    // 메인 기능 클래스/함수
    requirements.push({
      type: 'function',
      name: `${this.toCamelCase(featureName)}Handler`,
      description: `${issue.title}의 메인 처리 로직`,
      implementation: this.generateFeatureImplementation(issue, context),
      dependencies: context.technologies,
      testCases: this.generateTestCases(issue, context),
      priority: 'high'
    });

    // 비즈니스 로직이 있으면 서비스 클래스 생성
    if (context.businessLogic.length > 0) {
      requirements.push({
        type: 'class',
        name: `${this.toPascalCase(featureName)}Service`,
        description: `${issue.title}의 비즈니스 로직 처리`,
        implementation: this.generateServiceImplementation(issue, context),
        dependencies: ['logger', 'validator'],
        testCases: context.businessLogic.map(logic => `should handle ${logic} correctly`),
        priority: 'high'
      });
    }

    // API가 필요하면 컨트롤러 생성
    if (context.patterns.includes('rest') || context.patterns.includes('crud')) {
      requirements.push({
        type: 'api',
        name: `${this.toCamelCase(featureName)}Controller`,
        description: `${issue.title}의 API 엔드포인트`,
        implementation: this.generateApiImplementation(issue, context),
        dependencies: ['express', 'validator'],
        testCases: ['should handle GET request', 'should handle POST request', 'should validate input'],
        priority: 'medium'
      });
    }

    return requirements;
  }

  private generateBugfixRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    return [{
      type: 'function',
      name: `fix${this.toPascalCase(issue.identifier)}`,
      description: `Bug fix for ${issue.title}`,
      implementation: this.generateBugfixImplementation(issue, context),
      dependencies: ['logger'],
      testCases: ['should fix the reported issue', 'should not break existing functionality'],
      priority: 'high'
    }];
  }

  private generateApiRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    const apiName = this.extractFeatureName(issue);
    
    return [{
      type: 'api',
      name: `${this.toCamelCase(apiName)}Api`,
      description: `API implementation for ${issue.title}`,
      implementation: this.generateApiImplementation(issue, context),
      dependencies: ['express', 'joi', 'logger'],
      testCases: ['should return 200 on success', 'should validate request body', 'should handle errors'],
      priority: 'high'
    }];
  }

  private generateComponentRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    const componentName = this.extractFeatureName(issue);
    
    return [{
      type: 'component',
      name: this.toPascalCase(componentName),
      description: `React component for ${issue.title}`,
      implementation: this.generateComponentImplementation(issue, context),
      dependencies: ['react', 'typescript'],
      testCases: ['should render without crashing', 'should handle props correctly', 'should handle events'],
      priority: 'high'
    }];
  }

  private generateGenericRequirements(
    issue: LinearIssue, 
    context: Omit<ContextAnalysis, 'requirements'>
  ): ContextualRequirement[] {
    const taskName = this.extractFeatureName(issue);
    
    return [{
      type: 'function',
      name: this.toCamelCase(taskName),
      description: `Implementation for ${issue.title}`,
      implementation: this.generateGenericImplementation(issue, context),
      dependencies: ['logger'],
      testCases: ['should execute successfully', 'should handle errors gracefully'],
      priority: 'medium'
    }];
  }

  private extractFeatureName(issue: LinearIssue): string {
    // 제목에서 의미있는 단어 추출
    return issue.title
      .replace(/\b(생성|수정|삭제|조회|추가|개선|버그|픽스|테스트)\b/g, '')
      .trim() || issue.identifier;
  }

  private generateFeatureImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const featureName = this.toCamelCase(this.extractFeatureName(issue));
    const businessLogic = context.businessLogic.slice(0, 3);
    
    return `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export async function ${featureName}Handler(input: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log('🚀 Starting ${issue.title}');
    
    // Input validation
    if (!input) {
      throw new Error('Input is required');
    }
    
    ${businessLogic.map(logic => `// ${logic.charAt(0).toUpperCase() + logic.slice(1)} logic
    console.log('Processing ${logic}...');`).join('\n    ')}
    
    // Main implementation based on issue requirements
    const result = await process${this.toPascalCase(featureName)}(input);
    
    console.log('✅ ${issue.title} completed successfully');
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ Error in ${featureName}Handler:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function process${this.toPascalCase(featureName)}(input: any): Promise<any> {
  // TODO: Implement actual business logic based on Linear issue context
  // Issue Description: ${issue.description || 'No description'}
  ${issue.comments.length > 0 ? `// Comments from Linear:
  ${issue.comments.map(c => `// ${c.user.name}: ${c.body.substring(0, 100)}...`).join('\n  ')}` : ''}
  
  return { processed: true, input };
}`;
  }

  private generateServiceImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const serviceName = this.toPascalCase(this.extractFeatureName(issue));
    
    return `/**
 * ${serviceName} Service
 * Handles business logic for ${issue.title}
 */

export class ${serviceName}Service {
  constructor(private logger: any) {}

  async execute(params: any): Promise<any> {
    this.logger.info('Executing ${serviceName} service', { params });
    
    try {
      ${context.businessLogic.map(logic => `await this.handle${this.toPascalCase(logic)}(params);`).join('\n      ')}
      
      return { success: true, message: '${issue.title} completed' };
    } catch (error) {
      this.logger.error('Service execution failed', { error });
      throw error;
    }
  }

  ${context.businessLogic.map(logic => `
  private async handle${this.toPascalCase(logic)}(params: any): Promise<void> {
    // TODO: Implement ${logic} logic
    console.log('Handling ${logic}...');
  }`).join('')}
}`;
  }

  private generateApiImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const apiName = this.toCamelCase(this.extractFeatureName(issue));
    
    return `/**
 * API Controller for ${issue.title}
 */

import { Request, Response } from 'express';

export class ${this.toPascalCase(apiName)}Controller {
  
  async create(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement creation logic based on ${issue.identifier}
      const result = await this.processCreate(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async get(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement retrieval logic
      const result = await this.processGet(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async processCreate(data: any): Promise<any> {
    // Implementation based on: ${issue.description?.substring(0, 100)}...
    return { id: Date.now(), ...data };
  }

  private async processGet(id: string): Promise<any> {
    // TODO: Implement based on Linear issue requirements
    return { id, message: 'Retrieved successfully' };
  }
}`;
  }

  private generateComponentImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const componentName = this.toPascalCase(this.extractFeatureName(issue));
    
    return `/**
 * ${componentName} Component
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 */

import React, { useState, useEffect } from 'react';

interface ${componentName}Props {
  // TODO: Define props based on ${issue.identifier} requirements
  data?: any;
  onAction?: (action: string) => void;
}

export const ${componentName}: React.FC<${componentName}Props> = ({ data, onAction }) => {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Initialize component based on Linear issue context
    console.log('${componentName} initialized');
  }, []);

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      // TODO: Implement action handling based on ${issue.description?.substring(0, 50)}...
      onAction?.(action);
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="${this.toKebabCase(componentName)}">
      <h2>${issue.title}</h2>
      {loading && <div>Loading...</div>}
      
      {/* TODO: Implement UI based on Linear issue requirements */}
      <button onClick={() => handleAction('primary')}>
        Execute Action
      </button>
      
      {state && (
        <div className="result">
          <pre>{JSON.stringify(state, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default ${componentName};`;
  }

  private generateBugfixImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    return `/**
 * Bug Fix: ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 */

export function fix${this.toPascalCase(issue.identifier)}(): void {
  console.log('🔧 Applying fix for ${issue.identifier}');
  
  try {
    // TODO: Implement fix based on issue description:
    // ${issue.description?.substring(0, 200)}...
    
    ${issue.comments.length > 0 ? `// Additional context from comments:
    ${issue.comments.slice(0, 2).map(c => `// ${c.user.name}: ${c.body.substring(0, 100)}...`).join('\n    ')}` : ''}
    
    console.log('✅ Fix applied successfully');
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}`;
  }

  private generateGenericImplementation(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string {
    const taskName = this.toCamelCase(this.extractFeatureName(issue));
    
    return `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 */

export async function ${taskName}(): Promise<{ success: boolean; message: string }> {
  console.log('🚀 Executing ${issue.title}');
  
  try {
    // TODO: Implement based on Linear issue context
    // Description: ${issue.description || 'No description provided'}
    
    ${context.businessLogic.length > 0 ? `// Business logic to implement:
    ${context.businessLogic.slice(0, 3).map(logic => `// - ${logic}`).join('\n    ')}` : ''}
    
    return {
      success: true,
      message: '${issue.title} completed successfully'
    };
  } catch (error) {
    console.error('❌ Task failed:', error);
    return {
      success: false,
      message: \`Failed to execute ${issue.title}: \${error}\`
    };
  }
}`;
  }

  private generateTestCases(issue: LinearIssue, context: Omit<ContextAnalysis, 'requirements'>): string[] {
    const testCases = [
      'should execute without errors',
      'should handle valid input correctly',
      'should handle invalid input gracefully',
      'should return expected output format'
    ];

    // 비즈니스 로직 기반 테스트 케이스
    context.businessLogic.forEach(logic => {
      testCases.push(`should handle ${logic} correctly`);
    });

    // 인수 조건 기반 테스트 케이스
    context.acceptanceCriteria.forEach(criteria => {
      testCases.push(`should satisfy: ${criteria.substring(0, 50)}...`);
    });

    return testCases;
  }

  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
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
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }
}
