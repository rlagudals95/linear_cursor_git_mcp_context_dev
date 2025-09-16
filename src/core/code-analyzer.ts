import { promises as fs } from 'fs';
import path from 'path';
import { LinearIssue } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export interface CodeModification {
  file: string;
  changes: Array<{
    type: 'add' | 'modify' | 'delete';
    location: string; // 함수명, 클래스명, 라인번호 등
    content: string;
    reason: string;
  }>;
}

export class CodeAnalyzer {
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  async analyzeRepository(): Promise<CodeFile[]> {
    logger.info('🔍 Analyzing repository structure');
    
    const codeFiles: CodeFile[] = [];
    await this.scanDirectory(this.workDir, codeFiles);
    
    logger.info('📊 Repository analysis complete', { 
      totalFiles: codeFiles.length,
      languages: [...new Set(codeFiles.map(f => f.language))]
    });
    
    return codeFiles;
  }

  async generateModifications(issue: LinearIssue, codeFiles: CodeFile[]): Promise<CodeModification[]> {
    logger.info('🤖 Generating code modifications based on Linear issue');
    
    const modifications: CodeModification[] = [];
    
    // 이슈 분석
    const issueAnalysis = this.analyzeIssue(issue);
    
    // 관련 파일 찾기
    const relevantFiles = this.findRelevantFiles(issueAnalysis, codeFiles);
    
    // 각 파일에 대한 수정사항 생성
    for (const file of relevantFiles) {
      const fileModifications = this.generateFileModifications(issue, issueAnalysis, file);
      if (fileModifications.changes.length > 0) {
        modifications.push(fileModifications);
      }
    }
    
    // 새 파일이 필요한 경우
    const newFiles = this.generateNewFiles(issue, issueAnalysis, codeFiles);
    modifications.push(...newFiles);
    
    logger.info('✅ Code modifications generated', {
      modifiedFiles: modifications.length,
      totalChanges: modifications.reduce((sum, mod) => sum + mod.changes.length, 0)
    });
    
    return modifications;
  }

  private async scanDirectory(dir: string, codeFiles: CodeFile[], depth: number = 0): Promise<void> {
    if (depth > 5) return; // 깊이 제한
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.workDir, fullPath);
        
        // 무시할 디렉토리/파일
        if (this.shouldIgnore(entry.name)) continue;
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, codeFiles, depth + 1);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            codeFiles.push({
              path: relativePath,
              content,
              language: this.detectLanguage(entry.name)
            });
          } catch (error) {
            logger.warn('Failed to read file', { path: relativePath, error });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to scan directory', { dir, error });
    }
  }

  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
      '.DS_Store', 'Thumbs.db', '*.log', '*.tmp'
    ];
    
    return ignorePatterns.some(pattern => 
      name === pattern || name.includes(pattern.replace('*', ''))
    );
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
      '.vue', '.svelte', '.html', '.css', '.scss', '.less'
    ];
    
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  private detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss'
    };
    
    return languageMap[ext] || 'text';
  }

  private analyzeIssue(issue: LinearIssue) {
    const title = issue.title.toLowerCase();
    const description = (issue.description || '').toLowerCase();
    const labels = issue.labels.map(l => l.name.toLowerCase());
    
    return {
      type: this.determineIssueType(title, description, labels),
      keywords: this.extractKeywords(title, description),
      components: this.extractComponents(title, description),
      actions: this.extractActions(title, description),
      priority: this.determinePriority(labels),
      scope: this.determineScope(title, description, labels)
    };
  }

  private determineIssueType(title: string, description: string, labels: string[]) {
    if (labels.includes('bug') || title.includes('fix') || title.includes('bug')) {
      return 'bugfix';
    }
    if (labels.includes('feature') || title.includes('add') || title.includes('implement')) {
      return 'feature';
    }
    if (title.includes('update') || title.includes('modify') || title.includes('change')) {
      return 'enhancement';
    }
    if (title.includes('refactor') || labels.includes('refactor')) {
      return 'refactor';
    }
    return 'feature';
  }

  private extractKeywords(title: string, description: string): string[] {
    const text = `${title} ${description}`;
    const keywords = text.match(/\b[a-z]{3,}\b/g) || [];
    return [...new Set(keywords)].filter(word => 
      !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'will'].includes(word)
    );
  }

  private extractComponents(title: string, description: string): string[] {
    const text = `${title} ${description}`;
    const components = [];
    
    // React 컴포넌트 패턴
    const reactMatches = text.match(/\b[A-Z][a-zA-Z]*(?:Component|Button|Modal|Form|Input|Card|List|Item)\b/g);
    if (reactMatches) components.push(...reactMatches);
    
    // 일반적인 컴포넌트 이름
    const componentMatches = text.match(/\b(?:component|widget|element|module|service|controller|manager|handler|provider|factory|builder|validator|formatter|parser|renderer|loader|processor|generator|analyzer|calculator|converter|transformer|filter|sorter|searcher|finder|matcher|selector|detector|monitor|tracker|logger|reporter|notifier|publisher|subscriber|observer|listener|dispatcher|router|navigator|guard|interceptor|middleware|plugin|extension|addon|helper|utility|tool|kit|library|framework|engine|driver|client|server|api|endpoint|resource|repository|store|cache|database|model|entity|schema|table|collection|document|record|field|column|row|index|query|transaction|connection|session|context|state|config|setting|option|parameter|argument|variable|constant|enum|type|interface|class|struct|object|instance|prototype|method|function|procedure|routine|algorithm|process|thread|task|job|worker|queue|stack|heap|tree|graph|node|edge|vertex|path|route|link|reference|pointer|handle|descriptor|identifier|key|value|pair|tuple|array|list|set|map|dictionary|hash|table)\b/gi);
    if (componentMatches) components.push(...componentMatches);
    
    return [...new Set(components.map(c => c.toLowerCase()))];
  }

  private extractActions(title: string, description: string): string[] {
    const text = `${title} ${description}`;
    const actionWords = text.match(/\b(?:add|create|implement|build|develop|make|generate|produce|construct|establish|setup|install|configure|initialize|start|begin|launch|execute|run|process|handle|manage|control|operate|perform|do|act|work|function|behave|respond|react|trigger|fire|emit|send|receive|get|fetch|retrieve|obtain|acquire|collect|gather|extract|parse|analyze|examine|inspect|check|verify|validate|test|evaluate|assess|measure|calculate|compute|determine|decide|choose|select|pick|find|search|locate|discover|detect|identify|recognize|match|compare|sort|order|arrange|organize|group|categorize|classify|filter|exclude|include|contain|hold|store|save|persist|cache|load|read|write|update|modify|change|alter|edit|revise|correct|fix|repair|solve|resolve|address|handle|deal|treat|process|transform|convert|translate|format|render|display|show|present|exhibit|demonstrate|illustrate|visualize|draw|paint|color|style|design|layout|position|place|move|shift|transfer|copy|clone|duplicate|replicate|mirror|reflect|rotate|scale|resize|adjust|tune|optimize|improve|enhance|upgrade|extend|expand|increase|decrease|reduce|minimize|maximize|limit|restrict|constrain|bound|wrap|unwrap|pack|unpack|compress|decompress|encode|decode|encrypt|decrypt|hash|sign|verify|authenticate|authorize|login|logout|register|subscribe|unsubscribe|follow|unfollow|like|unlike|share|comment|reply|notify|alert|warn|inform|report|log|record|track|monitor|watch|observe|listen|hear|see|view|look|peek|glance|scan|browse|navigate|go|come|return|back|forward|next|previous|first|last|skip|jump|hop|step|walk|run|fly|move|travel|journey|visit|explore|discover|find|search|hunt|seek|look|check|verify|confirm|approve|accept|reject|deny|refuse|decline|cancel|abort|stop|pause|resume|continue|proceed|advance|progress|complete|finish|end|close|shut|open|start|begin|initiate|trigger|activate|enable|disable|turn|switch|toggle|flip|rotate|spin|roll|slide|drag|drop|push|pull|press|click|tap|touch|swipe|scroll|zoom|pan|pinch|stretch|squeeze|grab|hold|release|let|allow|permit|grant|give|take|receive|accept|get|obtain|acquire|buy|sell|trade|exchange|swap|replace|substitute|switch|change|alter|modify|update|upgrade|downgrade|install|uninstall|remove|delete|destroy|kill|terminate|exit|quit|leave|abandon|discard|throw|toss|drop|lose|miss|fail|error|crash|break|damage|harm|hurt|injure|wound|cut|slice|chop|split|divide|separate|isolate|disconnect|unlink|detach|remove|extract|pull|draw|drag|push|move|shift|transfer|transport|carry|bring|take|send|deliver|ship|mail|post|publish|broadcast|announce|declare|state|say|tell|speak|talk|communicate|express|convey|transmit|transfer|pass|give|hand|offer|provide|supply|serve|help|assist|support|aid|guide|lead|direct|instruct|teach|learn|study|practice|train|exercise|drill|rehearse|prepare|ready|setup|arrange|organize|plan|design|create|make|build|construct|develop|produce|generate|manufacture|craft|form|shape|mold|cast|forge|weld|join|connect|link|attach|bind|tie|fasten|secure|lock|unlock|open|close|seal|cover|hide|show|reveal|expose|uncover|discover|find|locate|spot|notice|see|observe|watch|monitor|track|follow|trace|hunt|search|look|seek|explore|investigate|examine|inspect|analyze|study|research|survey|poll|ask|question|inquire|request|demand|require|need|want|wish|desire|hope|expect|anticipate|predict|forecast|estimate|guess|assume|suppose|believe|think|consider|regard|view|see|perceive|understand|comprehend|grasp|realize|recognize|acknowledge|admit|confess|reveal|disclose|share|tell|inform|notify|alert|warn|advise|suggest|recommend|propose|offer|present|submit|provide|give|deliver|send|transmit|transfer|pass|hand|offer|serve|supply|furnish|equip|outfit|dress|wear|put|place|set|lay|rest|sit|stand|lie|sleep|wake|rise|get|go|come|arrive|reach|approach|near|close|far|distant|remote|away|off|out|in|inside|outside|within|without|above|below|over|under|up|down|left|right|front|back|side|center|middle|edge|corner|top|bottom|high|low|tall|short|long|wide|narrow|thick|thin|big|large|huge|small|tiny|little|great|grand|major|minor|main|primary|secondary|first|second|third|last|final|initial|original|new|old|young|fresh|stale|hot|cold|warm|cool|dry|wet|clean|dirty|clear|cloudy|bright|dark|light|heavy|easy|hard|simple|complex|basic|advanced|fast|slow|quick|rapid|swift|gradual|sudden|immediate|instant|delayed|late|early|soon|now|then|before|after|during|while|when|where|why|how|what|who|which|whose|whom)\b/gi) || [];
    
    return [...new Set(actionWords.map(a => a.toLowerCase()))];
  }

  private determinePriority(labels: string[]): 'high' | 'medium' | 'low' {
    if (labels.includes('urgent') || labels.includes('critical') || labels.includes('high')) {
      return 'high';
    }
    if (labels.includes('low') || labels.includes('minor')) {
      return 'low';
    }
    return 'medium';
  }

  private determineScope(title: string, description: string, labels: string[]): string[] {
    const text = `${title} ${description} ${labels.join(' ')}`;
    const scopes = [];
    
    // Frontend/Backend 구분
    if (text.includes('frontend') || text.includes('ui') || text.includes('react') || text.includes('component')) {
      scopes.push('frontend');
    }
    if (text.includes('backend') || text.includes('api') || text.includes('server') || text.includes('database')) {
      scopes.push('backend');
    }
    
    // 기술 스택
    const techStack = ['react', 'vue', 'angular', 'node', 'express', 'fastapi', 'django', 'flask', 'spring', 'laravel'];
    techStack.forEach(tech => {
      if (text.includes(tech)) scopes.push(tech);
    });
    
    return scopes;
  }

  private findRelevantFiles(analysis: any, codeFiles: CodeFile[]): CodeFile[] {
    const relevantFiles: CodeFile[] = [];
    
    for (const file of codeFiles) {
      let relevanceScore = 0;
      
      // 파일명 매칭
      analysis.keywords.forEach((keyword: string) => {
        if (file.path.toLowerCase().includes(keyword)) {
          relevanceScore += 3;
        }
      });
      
      // 컴포넌트명 매칭
      analysis.components.forEach((component: string) => {
        if (file.path.toLowerCase().includes(component) || 
            file.content.toLowerCase().includes(component)) {
          relevanceScore += 5;
        }
      });
      
      // 내용 매칭
      analysis.keywords.forEach((keyword: string) => {
        const matches = (file.content.toLowerCase().match(new RegExp(keyword, 'g')) || []).length;
        relevanceScore += matches;
      });
      
      if (relevanceScore > 2) {
        relevantFiles.push(file);
      }
    }
    
    // 관련성 높은 순으로 정렬
    return relevantFiles.slice(0, 10); // 최대 10개 파일
  }

  private generateFileModifications(issue: LinearIssue, analysis: any, file: CodeFile): CodeModification {
    const changes: CodeModification['changes'] = [];
    
    // 이슈 타입에 따른 수정사항 생성
    switch (analysis.type) {
      case 'bugfix':
        changes.push(...this.generateBugfixChanges(issue, analysis, file));
        break;
      case 'feature':
        changes.push(...this.generateFeatureChanges(issue, analysis, file));
        break;
      case 'enhancement':
        changes.push(...this.generateEnhancementChanges(issue, analysis, file));
        break;
      default:
        changes.push(...this.generateGenericChanges(issue, analysis, file));
    }
    
    return {
      file: file.path,
      changes
    };
  }

  private generateBugfixChanges(issue: LinearIssue, analysis: any, file: CodeFile) {
    const changes = [];
    
    // TODO 주석 추가
    changes.push({
      type: 'add' as const,
      location: 'top',
      content: `// TODO: Fix ${issue.identifier} - ${issue.title}`,
      reason: `Added TODO comment for bug fix tracking`
    });
    
    // 에러 핸들링 개선
    if (file.language === 'typescript' || file.language === 'javascript') {
      changes.push({
        type: 'add' as const,
        location: 'function',
        content: `
  try {
    // TODO: Implement fix for ${issue.identifier}
    console.log('Applying fix for: ${issue.title}');
  } catch (error) {
    console.error('Error in ${issue.identifier} fix:', error);
  }`,
        reason: 'Added error handling for bug fix'
      });
    }
    
    return changes;
  }

  private generateFeatureChanges(issue: LinearIssue, analysis: any, file: CodeFile) {
    const changes = [];
    
    // 새 기능 주석 추가
    changes.push({
      type: 'add' as const,
      location: 'top',
      content: `// Feature: ${issue.identifier} - ${issue.title}`,
      reason: 'Added feature documentation'
    });
    
    // 기능 구현 스텁 추가
    if (file.language === 'typescript' || file.language === 'javascript') {
      changes.push({
        type: 'add' as const,
        location: 'end',
        content: `
// ${issue.identifier}: ${issue.title}
export function ${this.toCamelCase(issue.title)}() {
  // TODO: Implement ${issue.title}
  console.log('Executing feature: ${issue.title}');
  
  // Implementation based on Linear issue: ${issue.url}
  return {
    success: true,
    message: 'Feature ${issue.identifier} executed successfully'
  };
}`,
        reason: 'Added new feature implementation stub'
      });
    }
    
    return changes;
  }

  private generateEnhancementChanges(issue: LinearIssue, analysis: any, file: CodeFile) {
    const changes = [];
    
    // 개선사항 주석 추가
    changes.push({
      type: 'add' as const,
      location: 'top',
      content: `// Enhancement: ${issue.identifier} - ${issue.title}`,
      reason: 'Added enhancement documentation'
    });
    
    return changes;
  }

  private generateGenericChanges(issue: LinearIssue, analysis: any, file: CodeFile) {
    const changes = [];
    
    // 일반적인 주석 추가
    changes.push({
      type: 'add' as const,
      location: 'top',
      content: `// Linear Issue: ${issue.identifier} - ${issue.title}`,
      reason: 'Added Linear issue reference'
    });
    
    return changes;
  }

  private generateNewFiles(issue: LinearIssue, analysis: any, codeFiles: CodeFile[]): CodeModification[] {
    const newFiles: CodeModification[] = [];
    
    // 이슈 타입에 따라 새 파일 생성
    if (analysis.type === 'feature') {
      const featureName = this.toCamelCase(issue.title);
      
      newFiles.push({
        file: `src/features/${featureName}.ts`,
        changes: [{
          type: 'add',
          location: 'file',
          content: this.generateFeatureFile(issue, analysis),
          reason: 'Created new feature file'
        }]
      });
      
      newFiles.push({
        file: `src/features/${featureName}.test.ts`,
        changes: [{
          type: 'add',
          location: 'file',
          content: this.generateTestFile(issue, featureName),
          reason: 'Created test file for new feature'
        }]
      });
    }
    
    return newFiles;
  }

  private generateFeatureFile(issue: LinearIssue, analysis: any): string {
    const featureName = this.toCamelCase(issue.title);
    const className = this.toPascalCase(issue.title);
    
    return `/**
 * ${issue.title}
 * Linear Issue: ${issue.identifier}
 * ${issue.url}
 * 
 * Generated automatically based on Linear issue analysis
 */

export class ${className} {
  private issueId = '${issue.identifier}';
  private title = '${issue.title}';

  constructor() {
    console.log(\`Initializing \${this.title} (\${this.issueId})\`);
  }

  /**
   * Main execution method for ${issue.title}
   */
  public async execute(): Promise<{ success: boolean; message: string }> {
    try {
      console.log(\`Executing \${this.title}...\`);
      
      // TODO: Implement actual logic based on Linear issue requirements
      ${analysis.actions.slice(0, 3).map((action: string) => `// ${action}`).join('\n      ')}
      
      return {
        success: true,
        message: \`\${this.title} executed successfully\`
      };
    } catch (error) {
      console.error(\`Error executing \${this.title}:\`, error);
      return {
        success: false,
        message: \`Failed to execute \${this.title}: \${error}\`
      };
    }
  }

  /**
   * Get issue information
   */
  public getIssueInfo() {
    return {
      id: this.issueId,
      title: this.title,
      url: '${issue.url}',
      team: '${issue.team.key}',
      assignee: '${issue.assignee?.name || 'Unassigned'}'
    };
  }
}

export default ${className};
`;
  }

  private generateTestFile(issue: LinearIssue, featureName: string): string {
    const className = this.toPascalCase(issue.title);
    
    return `import ${className} from './${featureName}';

describe('${className}', () => {
  let feature: ${className};

  beforeEach(() => {
    feature = new ${className}();
  });

  it('should be created', () => {
    expect(feature).toBeDefined();
  });

  it('should have correct issue information', () => {
    const info = feature.getIssueInfo();
    expect(info.id).toBe('${issue.identifier}');
    expect(info.title).toBe('${issue.title}');
  });

  it('should execute successfully', async () => {
    const result = await feature.execute();
    expect(result.success).toBe(true);
    expect(result.message).toContain('executed successfully');
  });

  // TODO: Add more specific tests based on ${issue.identifier} requirements
});
`;
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
}
