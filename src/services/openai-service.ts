import OpenAI from 'openai';
// import { ProjectContext } from '../core/hybrid-code-generator.js'; // 순환참조 방지
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class OpenAIService {
  private openai: OpenAI;
  private model = 'gpt-4o-mini'; // 비용 효율적인 모델

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async enhanceCode(
    baseCode: string, 
    issue: LinearIssue, 
    context: any
  ): Promise<string> {
    logger.info('🤖 Enhancing code with OpenAI', {
      issueId: issue.identifier,
      codeLength: baseCode.length,
      projectType: context.type
    });

    try {
      const prompt = this.buildEnhancementPrompt(baseCode, issue, context);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software developer. Enhance the provided code based on the Linear issue requirements. Return only the improved code, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000, // 토큰 제한
        temperature: 0.3  // 일관성 있는 결과
      });

      const enhancedCode = response.choices[0]?.message?.content || baseCode;
      
      logger.info('✅ Code enhanced successfully', {
        issueId: issue.identifier,
        originalLength: baseCode.length,
        enhancedLength: enhancedCode.length,
        tokensUsed: response.usage?.total_tokens || 0
      });

      return enhancedCode;

    } catch (error) {
      logger.error('❌ OpenAI enhancement failed', {
        issueId: issue.identifier,
        error: error instanceof Error ? error.message : error
      });
      
      // AI 실패시 원본 코드 반환
      return baseCode;
    }
  }

  async generateFromScratch(issue: LinearIssue, context: any): Promise<string> {
    logger.info('🚀 Generating code from scratch with OpenAI', {
      issueId: issue.identifier,
      projectType: context.type
    });

    try {
      const prompt = this.buildGenerationPrompt(issue, context);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert ${context.type} developer. Generate production-ready code based on the Linear issue requirements. Include proper error handling, TypeScript types if applicable, and follow best practices.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.2
      });

      const generatedCode = response.choices[0]?.message?.content || '';
      
      logger.info('✅ Code generated from scratch', {
        issueId: issue.identifier,
        codeLength: generatedCode.length,
        tokensUsed: response.usage?.total_tokens || 0
      });

      return generatedCode;

    } catch (error) {
      logger.error('❌ OpenAI generation failed', {
        issueId: issue.identifier,
        error: error instanceof Error ? error.message : error
      });
      
      throw error;
    }
  }

  private buildEnhancementPrompt(
    baseCode: string, 
    issue: LinearIssue, 
    context: any
  ): string {
    return `
**Linear Issue Context:**
- ID: ${issue.identifier}
- Title: ${issue.title}
- Description: ${issue.description || 'No description'}
- Comments: ${issue.comments.map(c => `${c.user.name}: ${c.body}`).join('\n')}

**Project Context:**
- Type: ${context.type}
- Technologies: ${context.technologies.join(', ')}
- Patterns: ${context.patterns.join(', ')}

**Current Code:**
\`\`\`
${baseCode}
\`\`\`

**Requirements:**
Please enhance this code to fully implement the Linear issue requirements. Make it production-ready with:
1. Complete functionality based on the issue description
2. Proper error handling
3. Clean, readable code
4. TypeScript types if applicable
5. Comments explaining key functionality

Return only the enhanced code, no markdown formatting.
`;
  }

  private buildGenerationPrompt(issue: LinearIssue, context: any): string {
    const requirements = this.extractRequirements(issue);
    
    return `
**Linear Issue:**
- Title: ${issue.title}
- Description: ${issue.description || 'No description'}
- Comments: ${issue.comments.map(c => c.body).join('\n')}

**Project Context:**
- Type: ${context.type}
- Technologies: ${context.technologies.join(', ')}

**Extracted Requirements:**
${requirements.join('\n')}

**Task:**
Generate complete, production-ready ${context.type} code that implements these requirements. 
The code should:
1. Be fully functional and ready to run
2. Include proper error handling
3. Follow best practices for ${context.type}
4. Use ${context.technologies.join(' + ')} as specified
5. Include TypeScript types if TypeScript is mentioned

Return only the code, no explanations or markdown formatting.
`;
  }

  private extractRequirements(issue: LinearIssue): string[] {
    const requirements: string[] = [];
    
    // 제목에서 요구사항 추출
    if (issue.title) {
      requirements.push(`- ${issue.title}`);
    }
    
    // 설명에서 요구사항 추출
    if (issue.description) {
      const sentences = issue.description.split(/[.\n]/).filter(s => s.trim());
      requirements.push(...sentences.map(s => `- ${s.trim()}`));
    }
    
    // 댓글에서 요구사항 추출
    issue.comments.forEach(comment => {
      if (comment.body.includes('요구사항') || comment.body.includes('requirement')) {
        requirements.push(`- Comment from ${comment.user.name}: ${comment.body}`);
      }
    });
    
    return requirements.slice(0, 10); // 최대 10개로 제한
  }

  // 토큰 사용량 추정
  estimateTokens(text: string): number {
    // 대략적인 토큰 추정 (1토큰 ≈ 4문자)
    return Math.ceil(text.length / 4);
  }

  // 비용 추정 (GPT-4o-mini 기준)
  estimateCost(tokens: number): number {
    const inputCost = 0.00015; // $0.00015 per 1K tokens
    const outputCost = 0.0006;  // $0.0006 per 1K tokens
    
    return (tokens / 1000) * (inputCost + outputCost);
  }
}
