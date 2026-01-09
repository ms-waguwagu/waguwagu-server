# **WAGUWAGU**

<h2 align="center">🎮 Pacman Multiplayer Project</h2>
<p align="center">HTML5 Canvas + NestJS WebSocket 기반 실시간 멀티플레이 게임</p>


## 목차

- [프로젝트 소개](#프로젝트-소개)
- [프로젝트 구조](#프로젝트-구조)
- [실행 및 배포 방법](#실행-및-배포-방법)
- [프론트엔드 (Frontend)](#-프론트엔드-frontend)
- [백엔드 배포 (Backend Deployment)](#-백엔드-배포-backend-deployment)
- [서비스 주소 정보 (Domain Info)](#서비스-주소-정보-domain-info)
- [게임 서버 구조 개념](#게임-서버-구조-개념)


# 프로젝트 소개

본 프로젝트는 **고전 Pac-Man**을 기반으로 한
**5인 실시간 멀티플레이 온라인 게임**을 목표로 합니다.

- 프론트엔드: HTML Canvas 기반 Pac-Man 엔진 활용
- 백엔드: NestJS(WebSocket) 기반 실시간 게임 서버
- 서버가 모든 게임 상태를 관리하는 **Server Authoritative 구조**
- 향후 DB/리더보드/매칭/AI 봇까지 확장

---

# 프로젝트 구조

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
# 실행 및 배포 방법

## ▶ 프론트엔드 (Frontend)
로컬 테스트 시 `config.js`의 주소를 확인한 후 아래 명령어로 실행합니다.

```bash
cd frontend
npx http-server -p 5500
```

접속 주소:
- **운영 환경**: [https://www.waguwagu.cloud](https://www.mswagu.cloud)
- **로컬 환경**: [http://localhost:5500](http://localhost:5500)

---

## ▶ 백엔드 배포 (Backend Deployment)

본 프로젝트는 **Jenkins와 ArgoCD를 이용한 CI/CD 파이프라인**이 구축되어 있습니다. 

소스 코드를 수정하고 원격 저장소에 **Push**하면, Jenkins가 빌드를 수행하고 ArgoCD가 변경 사항을 감지하여 클러스터에 자동으로 배포합니다.

> [!IMPORTANT]
> 이 자동 배포 프로세스는 **AWS EKS 클러스터 내에 ArgoCD가 정상적으로 실행 중**인 상태에서만 동작합니다.

### 배포 절차
1. 로컬에서 기능 개발 및 커밋
2. 저장소로 **Push** 수행 시 자동 배포 시작
---
## 서비스 주소 정보 (Domain Info)

- **공식 홈페이지**: `https://www.waguwagu.cloud`
- **매칭/인증 API**: `https://matching.waguwagu.cloud`
- **게임 서버(유령)**: `*.game.waguwagu.cloud` (Agones를 통해 동적 할당)

---

# 게임 서버 구조 개념

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

