# MCP Context Processor

Linear + Git + MCP + Cursor를 이용한 컨텍스트 개발 파이프라인

## 🚀 개요

이 프로젝트는 Linear 티켓을 기반으로 자동화된 개발 워크플로우를 제공합니다:

1. **Linear 티켓 생성/업데이트** → Webhook 발송
2. **MCP + Cursor** → 구현/수정 (티켓 컨텍스트 기반)
3. **브랜치/커밋** → 자동 생성
4. **PR 생성** → GitHub에 자동 생성

## 🏗️ 아키텍처

```
Linear Webhook → Orchestrator
→ (MCP) linear.fetch(issue_id)
→ (MCP) repo.clone/checkout & branch.create
→ (MCP) code.apply_patch
→ (MCP) git.commit/push
→ (MCP) github.create_pr
→ Linear에 링크/상태 업데이트
```

## 📦 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp env.example .env
# .env 파일을 편집하여 필요한 값들을 설정하세요

# 빌드
npm run build

# 개발 모드 실행
npm run dev

# 프로덕션 실행
npm start
```

## 🔧 환경 설정

### 필수 환경 변수

```bash
# Linear API
LINEAR_API_KEY=your_linear_api_key
LINEAR_WEBHOOK_SECRET=your_webhook_secret

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Server
PORT=3008
NODE_ENV=development

# MCP
MCP_SERVER_PORT=3009
```

### Linear Webhook 설정

1. Linear 워크스페이스 설정에서 Webhooks 섹션으로 이동
2. 새 Webhook 추가: `https://your-domain.com/webhooks/linear`
3. 이벤트 선택: Issue 생성/업데이트
4. Secret 설정 (LINEAR_WEBHOOK_SECRET와 동일하게)

### GitHub 설정

1. GitHub Personal Access Token 생성
2. 필요한 권한: `repo`, `pull_requests`, `issues`
3. GITHUB_TOKEN 환경 변수에 설정

## 🎯 사용법

### 1. 서버 시작

```bash
npm run dev
```

### 2. Linear에서 이슈 생성

Linear에서 이슈를 생성하면 자동으로:
- 브랜치 생성
- 기본 코드 스캐폴딩
- 테스트 파일 생성
- 커밋 및 푸시
- PR 생성

### 3. Cursor에서 MCP 사용

```json
// mcp.json 설정
{
  "mcpServers": {
    "linear-context-processor": {
      "command": "node",
      "args": ["dist/mcp-server.js"],
      "env": {
        "LINEAR_API_KEY": "${LINEAR_API_KEY}",
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "GITHUB_OWNER": "${GITHUB_OWNER}",
        "GITHUB_REPO": "${GITHUB_REPO}"
      }
    }
  }
}
```

## 🛠️ MCP 도구

### Repository 도구
- `repo_clone`: 저장소 클론
- `repo_checkout`: 브랜치 체크아웃
- `branch_create`: 새 브랜치 생성
- `repo_apply_patch`: 코드 변경 적용

### Git 도구
- `git_status`: Git 상태 확인
- `git_add`: 파일 스테이징
- `git_commit`: 커밋 생성
- `git_push`: 원격 저장소에 푸시

### GitHub 도구
- `github_create_pr`: Pull Request 생성
- `github_update_pr`: PR 업데이트
- `github_add_labels`: 라벨 추가

### Test 도구
- `test_run`: 테스트 실행
- `lint_run`: 린팅 실행
- `build_run`: 빌드 실행

## 📋 명령형 계획 예시

```typescript
{
  "issueId": "FE-1111",
  "branchName": "feat/fe-1111-linear-git-mcp-cursor",
  "commands": [
    {
      "id": "create-branch",
      "type": "branch.create",
      "params": { "name": "feat/fe-1111-example", "from": "main" },
      "description": "브랜치 생성"
    },
    {
      "id": "apply-changes",
      "type": "repo.apply_patch",
      "params": { "files": [...] },
      "description": "코드 변경 적용"
    },
    {
      "id": "run-tests",
      "type": "test.run",
      "params": { "command": "npm test" },
      "description": "테스트 실행"
    },
    {
      "id": "commit-changes",
      "type": "git.commit",
      "params": { "message": "feat: implement feature (Linear: FE-1111)" },
      "description": "변경사항 커밋"
    },
    {
      "id": "push-branch",
      "type": "git.push",
      "params": { "branch": "feat/fe-1111-example", "setUpstream": true },
      "description": "브랜치 푸시"
    },
    {
      "id": "create-pr",
      "type": "github.pr.create",
      "params": { "title": "[FE-1111] Example Feature", "head": "feat/fe-1111-example" },
      "description": "PR 생성"
    }
  ]
}
```

## 🔒 보안 고려사항

- 모든 민감한 정보는 환경 변수로 관리
- GitHub App 권한 최소화
- Webhook 서명 검증
- 파일 시스템 접근 제한
- 실행 권한 제한

## 📊 모니터링

- Winston을 통한 구조화된 로깅
- Redis를 통한 작업 큐 모니터링
- 실행 상태 추적
- 에러 알림

## 🤝 기여

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 관련 링크

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Linear API Documentation](https://developers.linear.app/)
- [Cursor Documentation](https://docs.cursor.com/)
- [GitHub API Documentation](https://docs.github.com/en/rest)
