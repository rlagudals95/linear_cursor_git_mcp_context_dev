# MCP 개발 규칙

## MCP 도구 구현
- 각 도구는 독립적인 클래스로 구현
- getToolDefinitions()와 executeTool() 메서드 필수
- JSON Schema로 입력 검증
- 명확한 에러 메시지 반환

## 도구 결과 형식
```typescript
interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
}
```

## 명령형 계획 구조
- 각 명령은 고유 ID 보유
- 실행 순서 보장
- 실패 시 롤백 가능한 구조
- 상세한 설명 포함

## 실행 원칙
- Idempotent 실행 보장
- 중요 명령 실패 시 전체 중단
- 모든 실행 단계 로깅
- 실행 결과 추적 가능

## 보안 고려사항
- 환경 변수로 민감 정보 관리
- 파일 시스템 접근 제한
- Git 작업 시 권한 확인
- API 토큰 안전한 저장
