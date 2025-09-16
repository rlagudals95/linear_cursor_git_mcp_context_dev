import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { CodeModification } from './code-analyzer.js';

export class CodeModifier {
  private workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  async applyModifications(modifications: CodeModification[]): Promise<void> {
    logger.info('🔧 Applying code modifications', { 
      totalFiles: modifications.length,
      totalChanges: modifications.reduce((sum, mod) => sum + mod.changes.length, 0)
    });

    for (const modification of modifications) {
      await this.applyFileModification(modification);
    }

    logger.info('✅ All code modifications applied successfully');
  }

  private async applyFileModification(modification: CodeModification): Promise<void> {
    const filePath = path.join(this.workDir, modification.file);
    
    logger.info('📝 Modifying file', { 
      file: modification.file,
      changes: modification.changes.length 
    });

    try {
      // 파일이 존재하는지 확인
      let fileContent = '';
      let fileExists = false;
      
      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
        fileExists = true;
      } catch (error) {
        // 파일이 없으면 새로 생성
        fileExists = false;
      }

      // 각 변경사항 적용
      for (const change of modification.changes) {
        fileContent = await this.applyChange(fileContent, change, modification.file);
        
        logger.info('🔄 Applied change', {
          file: modification.file,
          type: change.type,
          location: change.location,
          reason: change.reason
        });
      }

      // 디렉토리 생성 (필요한 경우)
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // 파일 저장
      await fs.writeFile(filePath, fileContent, 'utf-8');
      
      logger.info('💾 File saved', { 
        file: modification.file,
        existed: fileExists,
        size: fileContent.length 
      });

    } catch (error) {
      logger.error('Failed to modify file', { 
        file: modification.file, 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  private async applyChange(
    content: string, 
    change: CodeModification['changes'][0], 
    filename: string
  ): Promise<string> {
    
    switch (change.type) {
      case 'add':
        return this.addContent(content, change, filename);
      case 'modify':
        return this.modifyContent(content, change);
      case 'delete':
        return this.deleteContent(content, change);
      default:
        logger.warn('Unknown change type', { type: change.type });
        return content;
    }
  }

  private addContent(
    content: string, 
    change: CodeModification['changes'][0], 
    filename: string
  ): string {
    
    switch (change.location) {
      case 'top':
        return change.content + '\n' + content;
        
      case 'end':
        return content + '\n' + change.content;
        
      case 'file':
        // 완전히 새로운 파일
        return change.content;
        
      case 'function':
        return this.addToFunction(content, change.content);
        
      case 'class':
        return this.addToClass(content, change.content);
        
      case 'imports':
        return this.addImport(content, change.content);
        
      default:
        // 특정 위치에 추가 (라인 번호 등)
        if (change.location.startsWith('line:')) {
          const lineNumber = parseInt(change.location.split(':')[1]);
          return this.addAtLine(content, change.content, lineNumber);
        }
        
        // 기본적으로 끝에 추가
        return content + '\n' + change.content;
    }
  }

  private modifyContent(content: string, change: CodeModification['changes'][0]): string {
    // 간단한 문자열 치환
    if (change.location.startsWith('replace:')) {
      const searchText = change.location.replace('replace:', '');
      return content.replace(searchText, change.content);
    }
    
    return content;
  }

  private deleteContent(content: string, change: CodeModification['changes'][0]): string {
    // 특정 텍스트 삭제
    return content.replace(change.content, '');
  }

  private addToFunction(content: string, newContent: string): string {
    // 첫 번째 함수를 찾아서 내용 추가
    const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{/;
    const match = content.match(functionRegex);
    
    if (match) {
      const insertIndex = content.indexOf(match[0]) + match[0].length;
      return content.slice(0, insertIndex) + '\n' + newContent + content.slice(insertIndex);
    }
    
    // 함수가 없으면 끝에 추가
    return content + '\n' + newContent;
  }

  private addToClass(content: string, newContent: string): string {
    // 첫 번째 클래스를 찾아서 내용 추가
    const classRegex = /class\s+\w+[^{]*\{/;
    const match = content.match(classRegex);
    
    if (match) {
      const insertIndex = content.indexOf(match[0]) + match[0].length;
      return content.slice(0, insertIndex) + '\n' + newContent + content.slice(insertIndex);
    }
    
    // 클래스가 없으면 끝에 추가
    return content + '\n' + newContent;
  }

  private addImport(content: string, importStatement: string): string {
    // 기존 import 문들 찾기
    const importRegex = /^import\s+.*$/gm;
    const imports = content.match(importRegex) || [];
    
    if (imports.length > 0) {
      // 마지막 import 문 뒤에 추가
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      
      return content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex);
    } else {
      // import 문이 없으면 맨 위에 추가
      return importStatement + '\n' + content;
    }
  }

  private addAtLine(content: string, newContent: string, lineNumber: number): string {
    const lines = content.split('\n');
    
    if (lineNumber <= lines.length) {
      lines.splice(lineNumber - 1, 0, newContent);
    } else {
      lines.push(newContent);
    }
    
    return lines.join('\n');
  }
}
