# TypeScript 개발 규칙

## 코딩 스타일
- ES2022+ 문법 사용
- ESM 모듈 시스템 사용 (import/export)
- 엄격한 타입 체크 활성화
- 명시적 타입 선언 선호

## 파일 구조
- 기능별 디렉토리 구조 사용
- index.ts로 모듈 재내보내기
- 타입 정의는 types/ 디렉토리에 분리

## 네이밍 컨벤션
- 클래스: PascalCase
- 함수/변수: camelCase
- 상수: UPPER_SNAKE_CASE
- 인터페이스: PascalCase (I 접두사 없이)
- 타입: PascalCase

## 에러 처리
- 명시적 에러 타입 정의
- try-catch 블록에서 Error 타입 체크
- 로깅을 통한 에러 추적

## 비동기 처리
- async/await 선호
- Promise 체이닝 최소화
- 에러 전파 명시적 처리
