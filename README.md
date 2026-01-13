# **WAGUWAGU**

<h2 align="center">🎮 Pacman Multiplayer Project</h2>
<p align="center">HTML5 Canvas + NestJS WebSocket 기반 실시간 멀티플레이 게임</p>

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [사전 요구사항](#사전-요구사항)
- [프로젝트 구조](#프로젝트-구조)
- [실행 및 배포 방법](#실행-및-배포-방법)
  - [프론트엔드 (Frontend)](#프론트엔드-frontend)
  - [백엔드 배포 (Backend Deployment)](#백엔드-배포-backend-deployment)
- [서비스 주소 정보 (Domain Info)](#서비스-주소-정보-domain-info)
- [기술 스택 (Tech Stack)](#기술-스택-tech-stack)
- [시스템 아키텍처 (Architecture)](#시스템-아키텍처-architecture)
- [주요 설정 (Environment Variables)](#주요-설정-environment-variables)
- [게임 서버 구조 개념](#게임-서버-구조-개념)

---

## 사전 요구사항 (Prerequisites)

이 프로젝트를 로컬에서 실행하거나 배포하기 위해 다음 도구들이 필요합니다.

### 개발 도구
- **Node.js**: v20 (LTS 권장)
- **Docker**: 컨테이너 빌드 및 배포용
- **Redis**: 매칭 대기열 관리를 위해 필수
- **MySQL**: 랭킹 데이터 저장을 위한 DB

### 클라우드 및 인프라 (배포 시)
- **AWS CLI**: AWS 리소스 제어 및 권한 관리
- **Terraform / CloudFormation**: 인프라 프로비저닝 (IaC)
- **Kubernetes (kubectl)**: EKS 클러스터 관리
- **Helm**: Agones 및 필수 모듈 설치용

### 인증 정보
- **Google OAuth Client ID**: 구글 로그인 연동을 위해 필요

---

## 프로젝트 소개

본 프로젝트는 **고전 Pac-Man**을 기반으로 한
**5인 실시간 멀티플레이 온라인 게임**을 목표로 합니다.

- 프론트엔드: HTML Canvas 기반 Pac-Man 엔진 활용
- 백엔드: NestJS(WebSocket) 기반 실시간 게임 서버
- **Server Authoritative 구조**: 서버가 모든 게임 상태를 결정하여 변조 방지 및 동기화 최적화
- **자동화된 오케스트레이션**: Agones를 이용한 게임 서버 수명 주기 관리
- **지능형 매칭**: Redis Lua 스크립트를 이용한 원자적 매칭 및 부족 인원 봇 자동 충원

---

## 프로젝트 구조
```
waguwagu/
├── frontend/                 # 클라이언트 앱 (Vanilla JS, HTML, CSS)
│   ├── src/
│   │   ├── pages/            # HTML 페이지 (login, home, queue, game)
│   │   ├── js/               # 대기열 및 화면 전환 로직 JS
│   │   ├── game/             # 게임 렌더링(Canvas) 및 클라이언트 엔진
│   │   ├── styles/           # CSS 스타일 파일 (main, game, ranking)
│   │   └── images/           # 게임 에셋 (팩맨, 유령, 배경 이미지)
│   └── config.js             # 프런트엔드 전용 API/웹소켓 URL 설정
│
├── matching-server/          # 매칭 및 인증 서버 (NestJS)
│   ├── src/
│   │   ├── auth/             # Google OAuth 및 JWT 인증 로직
│   │   ├── queue/            # Redis 기반 대기열 처리 및 매칭 알고리즘
│   │   ├── matching/         # 매칭 성사 시 게임 서버 할당 및 통보 (Worker)
│   │   ├── agones-allocator/ # Agones SDK를 통한 게임 서버(Pod) 동적 할당
│   │   ├── ranking/          # 점수 저장 및 랭킹 조회 시스템
│   │   └── common/           # 공통 상수 및 유틸리티
│   └── test/load/            # k6 기반 부하 테스트 스크립트
│
├── game-server/              # 실제 게임 물리 엔진 서버 (NestJS)
│   └── src/
│       ├── engine/           # 팩맨 게임 물리, 충돌, 점수 계산 핵심 엔진
│       │   ├── player/       # 플레이어 상태 제어 및 스폰 관리
│       │   ├── bot/          # 봇 생성 및 경로 이동 관리
│       │   └── ghost/        # 유령 행동 패턴 관리
│       ├── map/              # 맵 데이터 파싱 및 지형 정보 관리
│       ├── gateway/          # 게임 내 실시간 조작을 위한 웹소켓 게이트웨이
│       ├── ranking/          # 게임 종료 시 결과 SQS 전송 로직
│       └── state/            # 게임 전체 상태(State Machine) 동기화
│   
└── package.json            # 프로젝트 전체 의존성 및 스크립트
```

---

## 실행 및 배포 방법

### 프론트엔드 (Frontend)

로컬 테스트 시 `config.js`의 주소를 확인한 후 아래 명령어로 실행합니다.
```bash
cd frontend
npx http-server -p 5500
```

**접속 주소:**
- **운영 환경**: [https://www.waguwagu.cloud](https://www.waguwagu.cloud)
- **로컬 환경**: [http://localhost:5500](http://localhost:5500)

---

### 백엔드 배포 (Backend Deployment)

본 프로젝트는 **Jenkins와 ArgoCD를 이용한 CI/CD 파이프라인**이 구축되어 있습니다. 

소스 코드를 수정하고 원격 저장소에 **Push**하면, Jenkins가 빌드를 수행하고 ArgoCD가 변경 사항을 감지하여 클러스터에 자동으로 배포합니다.

> [!IMPORTANT]
> 이 자동 배포 프로세스는 **AWS EKS 클러스터 내에 ArgoCD가 정상적으로 실행 중**인 상태에서만 동작합니다.

**배포 절차:**
1. 로컬에서 기능 개발 및 커밋
2. 저장소로 **Push** 수행 시 자동 배포 시작

---

## 서비스 주소 정보 (Domain Info)

- **공식 홈페이지**: `https://www.waguwagu.cloud`
- **매칭/인증 API**: `https://matching.waguwagu.cloud`
- **게임 서버**: `*.game.waguwagu.cloud` (Agones를 통해 동적 할당)

---

## 기술 스택 (Tech Stack)

| 분류 | 기술 |
| --- | --- |
| **Frontend** | Vanilla JS, HTML5 Canvas, CSS |
| **Backend** | NestJS (Authoritative Engine), Socket.io, JWT |
| **Infrastructure** | AWS EKS, Agones (Game Server Scaling), Route53 (Dynamic DNS) |
| **Data & Messaging** | Redis (Lua-based Queueing), AWS SQS (Result Pipe), RDS (Aurora) |
| **Security** | mTLS (Matching ↔ Agones), SSL (ACM), Secrets Manager |
| **Observability** | AWS X-Ray (Tracing), Prometheus, Grafana, Loki |
| **DevOps** | Jenkins, ArgoCD (GitOps), Terraform (IaC), Docker |

---

## 시스템 아키텍처 (Architecture)

본 프로젝트는 MSA(Microservice Architecture)와 클라우드 네이티브 기술을 결합하여 고가용성 게임 환경을 제공합니다.

1. **Matching Server**: 구글 로그인 연동 및 Redis 기반 대기열 관리. 매칭 성사 시 **Lua 스크립트**를 사용하여 원자적으로 참가자를 추출하며, **mTLS** 보안 통신을 통해 Agones에 서버 할당을 요청합니다.
2. **Game Server (Agones Fleet)**: 독립된 Pod에서 세션이 실행됩니다. **Route53 Dynamic DNS**를 통해 서버 IP를 `*.game.waguwagu.cloud` 형태의 도메인으로 자동 매핑하여 클라이언트의 보안 연결(WSS)을 지원합니다.
3. **Data Flow (SQS to DB)**: 게임 종료 시 결과 데이터는 SQS로 즉시 전송되어 유실을 방지합니다. 매칭 서버의 **RankingPollingService**가 이를 5초 주기로 소비(Consume)하여 Aurora DB에 안전하게 반영합니다.
4. **Observability**: **AWS X-Ray**를 통해 매칭 요청부터 서버 할당, 게임 종료까지의 전체 라이프사이클을 추적(Tracing)하여 성능 병목 지점을 시각화합니다.

---

## 주요 설정 (Environment Variables)

배포 시 다음 환경 변수 설정이 필요합니다.

- `ROUTE53_HOSTED_ZONE_ID`: 게임 서버 도메인 할당을 위한 AWS Zone ID
- `JWT_SECRET`: 유저 인증 및 매칭 토큰 발행을 위한 시크릿 키
- `MATCH_TOKEN_SECRET`: 매칭 서버와 게임 서버 간 신뢰를 위한 토큰 키
- `GAME_RESULT_QUEUE_URL`: 게임 결과 전송을 위한 SQS 엔드포인트
- `AGONES_CLIENT_CERT / KEY`: Agones Allocator 통신을 위한 mTLS 인증서

---

## Technical Highlights (주요 성과)

- **Atomic Matching**: Redis Lua 스크립트를 사용하여 대규모 접속 시에도 중복 매칭이나 경쟁 상태(Race Condition) 없는 정교한 큐잉 구현.
- **Dynamic Game Hosting**: Agones와 Route53을 연동하여, 새로운 게임 세션이 시작될 때마다 전용 서브도메인을 실시간으로 생성 및 할당.
- **Secure Communication**: 서버 간 통신(mTLS)과 클라이언트-서버 통신(WSS + Match Token) 전 과정에 보안 계층 적용.
- **Authoritative Physics**: 모든 연산을 서버에서 직접 수행하는 핵 방지 엔진.
- **Smart Bot System**: 매칭 인원 부족 시 자동으로 봇이 참전하여 게임 지연을 방지하고 유기적인 플레이 지원.

---

## 게임 서버 구조 개념
```
[Frontend Canvas] ← state sync ← [GameEngine (Server)]
        ↑                             ↓
        input → WebSocket → RoomManager
```

✔ 프론트는 입력(input)만 서버로 보냄

✔ 서버가 **모든 이동·충돌·점수 계산** 담당

✔ 서버가 계산한 GameState를 모든 클라이언트에 브로드캐스트

✔ 동일한 상태가 모든 플레이어에게 동기화됨

---
