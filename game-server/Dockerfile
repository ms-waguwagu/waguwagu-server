# 1단계: 빌드 환경 (Build Stage)
FROM node:20-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 패키지 파일 복사 (캐시 활용을 위해 먼저 복사)
COPY package*.json ./

# 의존성 설치 
RUN npm install

# 모든 소스 코드 복사
COPY . .

# TypeScript 코드 빌드 (JavaScript로 컴파일)
RUN npm run build

# --------------------------------------------------

# 2단계: 실행 환경 (Production/Runtime Stage)
# 용량을 줄이기 위해 최소한의 환경 사용
FROM node:20-alpine AS production

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# package.json과 필요한 의존성만 복사
COPY package*.json ./
RUN npm install --omit=dev

# 빌드 단계에서 컴파일된 JS 파일과 환경 설정 파일 복사
COPY --from=builder /usr/src/app/dist ./dist

# 환경 변수 설정 (NestJS 기본 포트)
ENV PORT 3001

# 앱 실행 
CMD ["node", "dist/main.js"]
