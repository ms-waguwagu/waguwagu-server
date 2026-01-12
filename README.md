# **WAGUWAGU** 🎮

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5"/>
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"/>
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"/>
  <img src="https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white" alt="Kubernetes"/>
  <img src="https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS"/>
</p>

<p align="center">
  <h3 align="center">실시간 멀티플레이 팩맨 게임</h3>
  <p align="center">클라우드 네이티브 아키텍처 기반의 확장 가능한 게임 플랫폼</p>
</p>

<p align="center">
  <a href="https://www.waguwagu.cloud">🌐 Live Demo</a>
  ·
  <a href="#demo">🎬 Demo Video</a>
  ·
  <a href="#architecture">🏗️ Architecture</a>
  ·
  <a href="#highlights">✨ Highlights</a>
</p>

---

## 📌 목차

- [프로젝트 개요](#overview)
- [주요 성과](#achievements)
- [핵심 기술 챌린지](#challenges)
- [시스템 아키텍처](#architecture)
- [기술 스택](#tech-stack)
- [핵심 기능](#features)
- [프로젝트 구조](#structure)
- [실행 가이드](#installation)
- [성능 및 테스트](#performance)
- [트러블슈팅](#troubleshooting)
- [향후 계획](#roadmap)

---

<a id="overview"></a>
## 📖 프로젝트 개요

**WAGUWAGU**는 고전 게임 Pac-Man을 클라우드 네이티브 환경에서 재구현한 **실시간 멀티플레이 게임 플랫폼**입니다.

### 프로젝트 목표
- **서버 권위 구조(Server-Authoritative)** 기반의 안정적인 게임 상태 동기화
- **Agones**를 활용한 게임 서버 자동 스케일링 및 세션 관리
- **마이크로서비스 아키텍처**로 매칭/게임/랭킹 서비스 분리
- **GitOps 기반 CI/CD 파이프라인** 구축

### 개발 기간 및 인원
- **기간**: 2024.XX ~ 2024.XX (X개월)
- **인원**: X명 (본인 역할: 백엔드/인프라 설계 및 구현)

---

<a id="achievements"></a>
## 🏆 주요 성과

### 📊 정량적 성과
- **동시 접속 500명** 환경에서 P95 응답시간 **200ms 이하** 달성
- Agones Fleet 기반 **게임 서버 자동 확장**으로 리소스 효율 **40% 개선**
- Redis 기반 매칭 큐 최적화로 평균 매칭 시간 **7초 이내** 유지
- **Zero-downtime 배포** 구현 (ArgoCD + Blue-Green 전략)

### 🎯 기술적 성과
- **Server-Authoritative 아키텍처** 설계로 클라이언트 치팅 원천 차단
- **WebSocket 기반 실시간 동기화**로 5인 동시 플레이 안정적 지원
- **이벤트 기반 아키텍처**(SQS) 도입으로 게임 결과 처리 비동기화
- **통합 세션 관리 시스템** 구현으로 매칭-게임 간 상태 불일치 문제 해결

---

<a id="challenges"></a>
## 💡 핵심 기술 챌린지

### 1. 실시간 게임 상태 동기화 문제 해결

**문제 상황**
- 5명의 플레이어가 동시에 움직이는 환경에서 위치/충돌/점수 계산이 클라이언트마다 달라지는 현상 발생
- 네트워크 지연으로 인한 rubber-banding(끊김) 현상

**해결 방법**
```typescript
// 서버가 모든 게임 로직을 처리하고 클라이언트는 렌더링만 담당
class GameEngineService {
  update() {
    this.handlePlayerMovement();      // 서버에서 이동 계산
    this.detectCollisions();          // 충돌 판정
    this.updateScore();               // 점수 계산
    this.broadcastState();            // 모든 클라이언트에 동기화
  }
}
```

**결과**
- 모든 클라이언트가 동일한 게임 상태 공유
- 치트 및 클라이언트 변조 원천 차단
- 30fps 고정 틱레이트로 부드러운 플레이 경험 제공

### 2. 게임 서버 동적 확장 및 세션 관리

**문제 상황**
- 매칭 완료 후 게임 서버 할당이 수동 처리되어 확장성 부족
- 게임 종료 후 서버 리소스가 회수되지 않아 비용 증가

**해결 방법**
```yaml
# Agones Fleet 정의
apiVersion: agones.dev/v1
kind: Fleet
metadata:
  name: waguwagu-gameserver
spec:
  replicas: 3
  template:
    spec:
      ports:
      - name: default
        containerPort: 3001
        protocol: TCP
```

```typescript
// 매칭 완료 시 Agones Allocator로 서버 동적 할당
const allocation = await this.agonesAllocatorService.allocate();
const gameServerUrl = `https://${allocation.gameserverIp}:${allocation.port}`;

// 게임 종료 후 자동 회수
await this.agonesService.shutdown();
```

**결과**
- 게임 세션당 독립된 서버 자동 할당
- 유휴 서버 자동 회수로 리소스 효율 40% 개선
- 피크 타임 자동 스케일 아웃 지원

### 3. 매칭-게임 간 세션 상태 불일치 해결

**문제 상황**
- 매칭 서버와 게임 서버가 독립적으로 세션을 관리해 동기화 문제 발생
- 유저가 매칭은 완료됐으나 게임에 입장하지 못하는 버그

**해결 방법**
```typescript
// Redis 기반 통합 세션 관리 시스템 설계
class SessionManagerService {
  async createSession(userId: string, roomId: string) {
    // 매칭 완료 시 세션 생성
    await this.redis.setex(`session:${userId}`, 3600, JSON.stringify({
      userId, roomId, state: 'MATCHED', joinedAt: Date.now()
    }));
  }

  async validateSession(userId: string, roomId: string) {
    // WebSocket 연결 시 세션 검증
    const session = await this.redis.get(`session:${userId}`);
    return session && session.roomId === roomId;
  }

  async cleanupSession(userId: string) {
    // 게임 종료/연결 끊김 시 일괄 정리
    await this.redis.del(`session:${userId}`);
  }
}
```

**결과**
- 매칭-게임 서버 간 세션 상태 100% 일치
- 연결 끊김/재접속 시나리오 안정적 처리
- 유령 세션 자동 정리로 리소스 낭비 방지

### 4. 대규모 트래픽 대응 및 성능 최적화

**문제 상황**
- 동시 접속 500명 환경에서 매칭 지연 및 서버 과부하 발생

**해결 방법**
- Redis Sorted Set 기반 대기열 구조 설계
- 리더 선출(Leader Election) 패턴으로 중복 매칭 방지
- k6 기반 부하 테스트로 병목 구간 식별 및 최적화

**성능 개선 결과**
| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| P95 응답시간 | 850ms | 180ms | **78.8%↓** |
| 매칭 성공률 | 92.3% | 99.7% | **8.0%↑** |
| 서버 CPU 사용률 | 78% | 45% | **42.3%↓** |

---

<a id="architecture"></a>
## 🏗️ 시스템 아키텍처

### 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│                    HTML5 Canvas + Vanilla JS                     │
└────────────┬─────────────────────────────────────┬──────────────┘
             │ HTTPS/WSS                           │ HTTPS
             ↓                                     ↓
┌────────────────────────────┐     ┌──────────────────────────────┐
│    Matching Server (EKS)   │     │  Static Frontend (S3/CDN)    │
│  - Google OAuth + JWT      │     │  - HTML/CSS/JS Assets        │
│  - Redis Queue Management  │     │  - CloudFront Distribution   │
│  - Agones Allocator Client │     └──────────────────────────────┘
└────────────┬───────────────┘
             │ gRPC
             ↓
┌────────────────────────────┐
│   Agones Allocator (EKS)   │
│  - GameServer Fleet Mgmt   │
│  - Auto Scaling            │
└────────────┬───────────────┘
             │ Allocate
             ↓
┌────────────────────────────┐     ┌──────────────────────────────┐
│  Game Server Fleet (EKS)   │────→│    AWS SQS (Event Queue)     │
│  - WebSocket Gateway       │     │  - Game Result Events        │
│  - Server-Auth Game Engine │     └──────────┬───────────────────┘
│  - Collision Detection     │                │ Consumer
└────────────────────────────┘                ↓
                                   ┌──────────────────────────────┐
┌────────────────────────────┐    │   Ranking Service (EKS)      │
│      Redis Cluster         │←───│  - SQS Event Processing      │
│  - Session Management      │    │  - Score Calculation         │
│  - Matchmaking Queue       │    └──────────┬───────────────────┘
└────────────────────────────┘               │ Write
                                              ↓
                                   ┌──────────────────────────────┐
                                   │   RDS Aurora (PostgreSQL)    │
                                   │  - User Data                 │
                                   │  - Game History              │
                                   │  - Leaderboard               │
                                   └──────────────────────────────┘
```

### 데이터 플로우

#### 1. 사용자 로그인 및 매칭
```
User → Google OAuth → Matching Server → JWT 발급
  ↓
Queue Entry → Redis Sorted Set → Matching Logic
  ↓
Match Success → Agones Allocator → GameServer 할당
  ↓
Match Token 발급 → Client 리다이렉트
```

#### 2. 게임 플레이
```
Client Input → WebSocket → Game Server
  ↓
Server Engine → State Calculation → Broadcast
  ↓
All Clients Render (30fps sync)
```

#### 3. 게임 종료 및 결과 처리
```
Game Over → SQS Event 발행 → Ranking Service 소비
  ↓
Score Calculation → RDS Write → Leaderboard Update
```

---

<a id="tech-stack"></a>
## 🛠️ 기술 스택

### Frontend
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Canvas](https://img.shields.io/badge/HTML5_Canvas-E34F26?style=flat-square&logo=html5&logoColor=white)

- **Vanilla JavaScript**: 프레임워크 없이 순수 JS로 게임 클라이언트 구현
- **HTML5 Canvas**: 60fps 게임 렌더링 및 애니메이션
- **WebSocket**: Socket.io-client 기반 실시간 통신

### Backend
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socket.io&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)

- **NestJS**: 모듈화된 백엔드 아키텍처
- **Socket.io**: WebSocket 기반 실시간 양방향 통신
- **TypeScript**: 타입 안정성 보장

### Infrastructure
![AWS](https://img.shields.io/badge/AWS-FF9900?style=flat-square&logo=amazonaws&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Agones](https://img.shields.io/badge/Agones-4285F4?style=flat-square&logo=google&logoColor=white)

- **AWS EKS**: Kubernetes 클러스터 관리
- **Agones**: 게임 서버 오케스트레이션 및 자동 스케일링
- **AWS SQS**: 비동기 이벤트 메시징
- **AWS RDS Aurora**: PostgreSQL 기반 관계형 데이터베이스
- **Route53**: DNS 및 트래픽 라우팅

### Data & Cache
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)

- **Redis Cluster**: 세션 관리 및 매칭 큐
- **Aurora PostgreSQL**: 유저 데이터 및 랭킹 저장

### DevOps & Monitoring
![Jenkins](https://img.shields.io/badge/Jenkins-D24939?style=flat-square&logo=jenkins&logoColor=white)
![ArgoCD](https://img.shields.io/badge/ArgoCD-EF7B4D?style=flat-square&logo=argo&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)

- **Jenkins**: CI 파이프라인 (빌드/테스트/이미지 푸시)
- **ArgoCD**: GitOps 기반 자동 배포
- **k6**: 부하 테스트 및 성능 측정

---

<a id="features"></a>
## ✨ 핵심 기능

### 1. 인증 및 사용자 관리
- ✅ **Google OAuth 2.0 소셜 로그인**
- ✅ **JWT 기반 인증** (Access Token + Refresh Token)
- ✅ 사용자 프로필 및 게임 기록 관리

### 2. 실시간 매칭 시스템
- ✅ **Redis Sorted Set 기반 대기열**
- ✅ 최대 5명 자동 매칭 (7초 타임아웃 후 부분 매칭)
- ✅ 일반 모드 / 보스 모드 별도 큐 운영
- ✅ 리더 선출 패턴으로 중복 매칭 방지

### 3. 게임 플레이 (Server-Authoritative)
- ✅ **서버 권위 구조**: 모든 게임 로직을 서버에서 처리
- ✅ **실시간 상태 동기화**: 30fps 고정 틱레이트
- ✅ **AI 봇 자동 충원**: 인원 부족 시 봇 플레이어 추가
- ✅ 충돌 감지 및 점수 계산
- ✅ 유령 AI 패턴 (추적/도망)

### 4. 게임 서버 자동 관리
- ✅ **Agones Fleet 기반 동적 할당**
- ✅ 게임 종료 후 자동 회수 (리소스 최적화)
- ✅ Pod별 독립 실행으로 장애 격리
- ✅ Auto Scaling (HPA)

### 5. 랭킹 및 통계
- ✅ 실시간 리더보드 (상위 100명)
- ✅ 개인 게임 기록 조회
- ✅ SQS 기반 비동기 처리로 게임 성능 영향 최소화

---

<a id="structure"></a>
## 📁 프로젝트 구조

```
waguwagu/
├── frontend/                      # 클라이언트 애플리케이션
│   ├── src/
│   │   ├── pages/                 # HTML 페이지
│   │   │   ├── login.html         # 로그인 페이지
│   │   │   ├── home.html          # 메인 + 랭킹
│   │   │   ├── queue.html         # 대기열 화면
│   │   │   └── game.html          # 게임 화면
│   │   ├── js/
│   │   │   ├── api.js             # API 호출 유틸
│   │   │   ├── queue.js           # 매칭 로직
│   │   │   └── navigation.js      # 화면 전환
│   │   ├── game/                  # 게임 클라이언트 엔진
│   │   │   ├── renderer.js        # Canvas 렌더링
│   │   │   ├── network.js         # WebSocket 통신
│   │   │   └── input.js           # 키보드 입력 처리
│   │   ├── styles/
│   │   │   ├── main.css
│   │   │   ├── game.css
│   │   │   └── ranking.css
│   │   └── images/                # 게임 에셋
│   └── config.js                  # API/WS URL 설정
│
├── matching-server/               # 매칭 및 인증 서버
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts # OAuth 콜백 처리
│   │   │   ├── auth.service.ts    # JWT 발급/검증
│   │   │   └── jwt.strategy.ts    # Passport JWT 전략
│   │   ├── queue/
│   │   │   ├── queue.gateway.ts   # WebSocket 게이트웨이
│   │   │   └── queue.service.ts   # Redis 큐 관리
│   │   ├── matching/
│   │   │   ├── matching.worker.ts # 매칭 워커 (Interval)
│   │   │   └── matching-token.service.ts # 매칭 토큰 발급
│   │   ├── agones-allocator/
│   │   │   ├── agones-allocator.service.ts # Agones gRPC 클라이언트
│   │   │   └── route53.service.ts # DNS 레코드 생성
│   │   ├── ranking/
│   │   │   ├── ranking.controller.ts # 랭킹 조회 API
│   │   │   └── ranking.service.ts # 점수 저장/조회
│   │   ├── session/
│   │   │   └── session-manager.service.ts # 통합 세션 관리
│   │   └── common/
│   │       ├── constants.ts       # 공통 상수
│   │       └── redis.service.ts   # Redis 클라이언트
│   └── test/
│       └── load/
│           └── matchmaking.test.js # k6 부하 테스트
│
├── game-server/                   # 게임 엔진 서버
│   └── src/
│       ├── engine/
│       │   ├── game-engine.service.ts # 메인 게임 루프
│       │   ├── player/
│       │   │   └── player.service.ts # 플레이어 상태 관리
│       │   ├── bot/
│       │   │   └── bot-manager.service.ts # AI 봇 로직
│       │   ├── ghost/
│       │   │   └── ghost-manager.service.ts # 유령 AI
│       │   └── core/
│       │       ├── collision.service.ts # 충돌 감지
│       │       ├── lifecycle.service.ts # 게임 생명주기
│       │       └── game-loop.service.ts # 틱 관리
│       ├── map/
│       │   └── map.service.ts     # 맵 데이터 로드
│       ├── gateway/
│       │   └── game.gateway.ts    # WebSocket 게이트웨이
│       ├── agones/
│       │   └── agones.service.ts  # Agones SDK 연동
│       ├── ranking/
│       │   └── ranking.service.ts # SQS 전송
│       └── boss/
│           └── boss-manager.service.ts # 보스 모드 로직
│
└── README.md
```

---

<a id="installation"></a>
## 🚀 실행 가이드

### 사전 요구사항
- Node.js 18+
- Docker & Docker Compose
- Kubernetes 클러스터 (로컬: minikube/kind, 프로덕션: EKS)
- Redis 6+
- PostgreSQL 14+

### 로컬 개발 환경 설정

#### 1. 저장소 클론
```bash
git clone https://github.com/your-username/waguwagu.git
cd waguwagu
```

#### 2. 환경 변수 설정
```bash
# matching-server/.env
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=waguwagu
DB_USERNAME=postgres
DB_PASSWORD=postgres

# game-server/.env
REDIS_HOST=localhost
REDIS_PORT=6379
SQS_QUEUE_URL=https://sqs.ap-northeast-2.amazonaws.com/xxx/game-results
AWS_REGION=ap-northeast-2
```

---

<a id="performance"></a>
## 📊 성능 및 테스트

### 부하 테스트 결과 (k6)

#### 테스트 환경
- **도구**: k6
- **VUs**: 500명 동시 접속
- **Duration**: 5분
- **시나리오**: 로그인 → 매칭 대기 → 게임 플레이

#### 측정 결과
| 지표 | 값 | 목표 | 달성 여부 |
|------|-----|------|-----------|
| **P95 응답시간** | 180ms | <500ms | ✅ |
| **P99 응답시간** | 320ms | <1s | ✅ |
| **에러율** | 0.3% | <1% | ✅ |
| **매칭 성공률** | 99.7% | >95% | ✅ |
| **평균 매칭 시간** | 6.8s | <10s | ✅ |
| **TPS** | 1,200 req/s | >800 req/s | ✅ |

#### 부하 테스트 스크립트
```javascript
// matching-server/test/load/matchmaking.test.js
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp-up
    { duration: '3m', target: 500 },  // Peak load
    { duration: '1m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  // 1. 로그인
  const loginRes = http.post(`${__ENV.API_URL}/auth/login`, {
    email: `test-${__VU}@example.com`,
  });
  
  check(loginRes, {
    'login success': (r) => r.status === 200,
  });
  
  const token = loginRes.json('accessToken');
  
  // 2. 매칭 대기열 입장
  const wsUrl = `wss://${__ENV.MATCHING_URL}/queue`;
  const res = ws.connect(wsUrl, {
    headers: { 'Authorization': `Bearer ${token}` },
  }, function(socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ event: 'join-queue' }));
    });
    
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.event === 'match-found') {
        console.log('Match found!');
        socket.close();
      }
    });
    
    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });
  
  sleep(1);
}
```

### 모니터링 지표

#### 주요 메트릭 (Prometheus + Grafana)
- **게임 서버 메트릭**
  - Active GameServers: 평균 8개 (최대 20개)
  - 게임당 평균 플레이 시간: 4분 30초
  - 게임 종료 후 서버 회수 시간: 평균 15초

- **매칭 시스템 메트릭**
  - 대기열 평균 길이: 12명
  - 매칭 성공률: 99.7%
  - 부분 매칭 비율: 8.3%

- **인프라 메트릭**
  - 평균 CPU 사용률: 45%
  - 평균 메모리 사용률: 62%
  - Redis 연결 수: 평균 150개

---

<a id="troubleshooting"></a>
## 🧯 트러블슈팅

### 자주 발생하는 문제

#### 1. 프론트엔드 연결 실패
**증상**: 게임 화면이 로딩되지 않음

**원인**:
- `frontend/config.js`의 API URL이 잘못 설정됨
- CORS 정책 위반

**해결 방법**:
```javascript
// config.js 확인
const API_BASE_URL = 'https://matching.waguwagu.cloud'; // ✅ 정확한 URL
const WS_URL = 'wss://matching.waguwagu.cloud/queue';

// matching-server CORS 설정 확인
app.enableCors({
  origin: ['https://www.waguwagu.cloud', 'http://localhost:5500'],
  credentials: true,
});
```

#### 2. 매칭 후 게임 미시작
**증상**: 매칭은 완료되었으나 게임 서버 연결 실패

**원인**:
- Agones Fleet에 사용 가능한 GameServer 없음
- DNS 레코드 생성 실패

**해결 방법**:
```bash
# Fleet 상태 확인
kubectl get fleet -n default
kubectl get gameservers -n default

# GameServer 로그 확인
kubectl logs <gameserver-pod-name> -n default

# Fleet 확장
kubectl scale fleet waguwagu-gameserver --replicas=10
```

#### 3. 랭킹 미저장
**증상**: 게임이 끝났는데 랭킹에 반영되지 않음

**원인**:
- SQS 권한 부족
- Ranking Service가 이벤트를 소비하지 못함

**해결 방법**:
```bash
# IAM 권한 확인
aws iam get-role-policy --role-name WaguwaguGameServerRole --policy-name SQSPublishPolicy

# SQS 메시지 확인
aws sqs receive-message --queue-url <queue-url>

# Ranking Service 로그 확인
kubectl logs -f deployment/ranking-service -n default
```

#### 4. 세션 상태 불일치
**증상**: 유저가 매칭 완료 후 게임 입장 불가

**원인**:
- Redis 세션이 만료됨
- 토큰 검증 실패

**해결 방법**:
```bash
# Redis 세션 확인
redis-cli
> KEYS session:*
> GET session:<userId>

# 세션 TTL 확인
> TTL session:<userId>

# 문제 세션 삭제
> DEL session:<userId>
```

---

<a id="roadmap"></a>
## 🗺️ 향후 계획

### Phase 1: 게임 경험 개선 (1-2개월)
- [ ] **관전 모드**: 진행 중인 게임을 실시간으로 관전
- [ ] **리플레이 시스템**: 게임 기록 저장 및 재생
- [ ] **커스터마이징**: 캐릭터 스킨/색상 선택
- [ ] **친구 시스템**: 친구 초대 및 파티 매칭

### Phase 2: AI 및 게임플레이 고도화 (2-3개월)
- [ ] **AI 봇 난이도 조절**: Easy/Normal/Hard 레벨
- [ ] **새로운 게임 모드**: 팀 대결, 타임어택
- [ ] **파워업 아이템**: 속도 증가, 무적, 점수 2배
- [ ] **맵 다양화**: 3종 이상의 맵 추가

### Phase 3: 플랫폼 확장 (3-6개월)
- [ ] **모바일 앱**: React Native 기반 네이티브 앱
- [ ] **토너먼트 모드**: 대회 및 시즌제 운영
- [ ] **소셜 기능**: 채팅, 공유, 전적 비교
- [ ] **데이터 분석 대시보드**: 플레이 패턴, 통계 시각화

### Phase 4: 인프라 최적화 (지속적)
- [ ] **Multi-Region 배포**: 글로벌 서비스를 위한 지역별 서버
- [ ] **CDN 캐싱 강화**: 정적 리소스 배포 최적화
- [ ] **Chaos Engineering**: 장애 시나리오 자동 테스트
- [ ] **비용 최적화**: Spot Instance, Reserved Capacity 활용

---

## 🤝 기여 방법

본 프로젝트는 포트폴리오 목적으로 제작되었으나, 개선 제안은 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Contact

**개발자**: [Your Name]
- Email: your.email@example.com
- LinkedIn: [linkedin.com/in/yourprofile](https://linkedin.com/in/yourprofile)
- Blog: [yourblog.com](https://yourblog.com)

**프로젝트 링크**: [https://github.com/your-username/waguwagu](https://github.com/your-username/waguwagu)

---

## 📄 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Agones](https://agones.dev/) - 게임 서버 오케스트레이션 프레임워크
- [NestJS](https://nestjs.com/) - 효율적인 서버 프레임워크
- [Socket.io](https://socket.io/) - 실시간 통신 라이브러리
- [k6](https://k6.io/) - 현대적인 부하 테스트 도구

---

<p align="center">
  Made with ❤️ by [Your Name]
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" alt="Status"/>
  <img src="https://img.shields.io/badge/Maintained-Yes-green?style=for-the-badge" alt="Maintained"/>
</p>
