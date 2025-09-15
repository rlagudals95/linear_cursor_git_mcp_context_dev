# Linear 통합 개발 규칙

## 브랜치 네이밍
- 형식: `{type}/{issue-id}-{slug}`
- 타입: feat, fix, chore, docs, refactor
- 예시: `feat/fe-1111-linear-git-mcp-cursor`

## 커밋 메시지
- 형식: `{type}({scope}): {description} (Linear: {issue-id})`
- 예시: `feat(frontend): add linear webhook handler (Linear: FE-1111)`

## PR 템플릿
- Linear 이슈 링크 필수 포함
- 체크리스트 포함
- 자동 생성 태그 추가

## 코드 구조
- Linear 타입 정의는 types/index.ts에
- Webhook 처리는 webhook/ 디렉토리에
- MCP 도구는 mcp/tools/ 디렉토리에

## 로깅
- Linear 이슈 ID 항상 포함
- 실행 단계별 상세 로깅
- 에러 발생 시 컨텍스트 정보 포함
