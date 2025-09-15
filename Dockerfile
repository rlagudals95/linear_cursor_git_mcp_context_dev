FROM node:22-alpine

WORKDIR /app

# 시스템 의존성 설치
RUN apk add --no-cache git

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 로그 및 워크스페이스 디렉토리 생성
RUN mkdir -p logs workspace

# 비root 사용자 생성
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 권한 설정
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
