# Claude Code 멀티 에이전트 하네스 — 스터디 가이드

이 문서는 지금까지 직접 만들고 실행해본 모든 내용을 학습 레퍼런스로 정리한 것입니다.

---

## 목차

1. [하네스란 무엇인가](#1-하네스란-무엇인가)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [에이전트 3종](#3-에이전트-3종)
4. [상태 파일 프로토콜](#4-상태-파일-프로토콜)
5. [플로우 3가지](#5-플로우-3가지)
   - 5-1. 해피패스 (hello-harness)
   - 5-2. REJECT 루프 (reject-demo)
   - 5-3. BLOCKED 시나리오 (blocker-demo)
6. [알림 시스템](#6-알림-시스템)
7. [Discord 봇 양방향 연동](#7-discord-봇-양방향-연동)
8. [토큰 비용 구조](#8-토큰-비용-구조)
9. [v0.1 vs v0.2 변경사항](#9-v01-vs-v02-변경사항)
10. [다음 단계 (v0.3 아이디어)](#10-다음-단계-v03-아이디어)

---

## 1. 하네스란 무엇인가

**하네스(Harness)** = Claude를 여러 역할로 나눠서 서로 협업하게 만드는 오케스트레이터.

```
사람이 요구사항 한 줄을 던지면
→ Planner가 태스크 목록을 만들고
→ Developer가 코드를 구현하고
→ Reviewer가 검토해서 승인/거절하고
→ 메인 세션이 git 커밋하고 알림을 보낸다
```

### 왜 에이전트를 나누나?

하나의 Claude 세션이 Planner + Developer + Reviewer를 다 하면:
- 컨텍스트가 오염됨 ("내가 만든 코드니까 좋은 코드겠지" 편향)
- 역할 경계가 없어서 scope creep 발생
- 한 역할이 실패해도 전체를 다시 돌려야 함

에이전트를 분리하면:
- 각자 명확한 책임을 가짐
- Reviewer가 Developer 코드를 독립적으로 평가
- 한 단계 실패 → 그 단계만 재시도

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  메인 세션 (너)                    │
│  - 오케스트레이션 (어떤 에이전트를 언제 부를지)        │
│  - git 커밋/브랜치 (에이전트는 git 불가)             │
│  - notify.sh 호출                                 │
│  - 블로커/에스컬레이션 판단                          │
└────────────┬────────────────────────────────────┘
             │ Agent 툴로 호출
   ┌──────────┼────────────┐
   ▼          ▼            ▼
[Planner] [Developer] [Reviewer]
   │          │            │
   └──────────┴────────────┘
          파일로만 소통
      projects/{name}/.state/
```

### 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **콜드 스타트** | 각 에이전트는 호출마다 새로 시작. 이전 대화 기억 없음 |
| **파일 기반 통신** | 에이전트끼리 직접 대화 ❌. 오직 `.state/` 파일로 소통 |
| **git은 메인만** | 서브 에이전트는 절대 git 명령 실행 불가 |
| **1태스크 1호출** | Developer는 호출 1번에 태스크 1개만 구현 |

---

## 3. 에이전트 3종

### Planner (`.claude/agents/planner.md`)

**역할:** 요구사항 → tasks.md 분해

**하는 것:**
- 요구사항을 읽고 독립적으로 실행 가능한 태스크로 쪼갬
- 각 태스크에 Goal / Files likely affected / Acceptance criteria 작성
- ≤3 파일 건드리는 크기로 유지

**하지 않는 것:**
- 코드 작성 ❌
- git 명령 ❌

**출력:** `projects/{project}/.state/tasks.md`

---

### Developer (`.claude/agents/developer.md`)

**역할:** 태스크 1개 구현

**하는 것 (순서대로):**
1. `notes.md` 있으면 먼저 읽기 (v0.2 추가)
2. `tasks.md`에서 할당된 태스크 찾기
3. 코드 구현
4. `review_request.md` 작성
5. `tasks.md` 상태 `[ ]` → `[dev-done]`
6. 막히면 `blockers.md` 작성 후 중단

**하지 않는 것:**
- git 명령 ❌
- 다른 태스크 건드리기 ❌ (다음 태스크 발견하면 notes.md에 메모만)

**출력:** 구현 파일 + `review_request.md`

---

### Reviewer (`.claude/agents/reviewer.md`)

**역할:** 코드 검토 → APPROVED / REJECTED

**하는 것 (순서대로):**
1. `review_request.md` 읽기
2. `review_history.md` 있으면 읽기 — 이전 라운드 지적사항 확인 (v0.2 추가)
3. 변경된 파일 읽기
4. 체크리스트 적용
5. `review_result.md` 덮어쓰기 (최신 판정)
6. `review_history.md` 추가(append) (전체 히스토리)

**체크리스트:**
- [ ] acceptance criteria 모두 충족?
- [ ] 명백한 버그 또는 놓친 엣지케이스?
- [ ] 코드가 주석 없이 읽기 쉬운가?
- [ ] 보안 이슈 (injection, 하드코딩된 시크릿 등)?
- [ ] 태스크 범위 이탈 없는가?

**하지 않는 것:**
- git 명령 ❌
- 코드 수정 ❌ (지적만 하고 수정은 Developer가)

---

## 4. 상태 파일 프로토콜

모든 에이전트 간 통신은 `projects/{project}/.state/` 파일로만 합니다.

```
projects/{project}/
├── {구현 파일들}
└── .state/
    ├── tasks.md          ← Planner 작성, Developer/메인세션 읽음
    ├── review_request.md ← Developer 작성, Reviewer 읽음
    ├── review_result.md  ← Reviewer 덮어쓰기, 메인세션 읽음
    ├── review_history.md ← Reviewer 추가(append), 다음 Reviewer 읽음
    ├── blockers.md       ← Developer 작성, 메인세션 읽고 에스컬레이션
    └── notes.md          ← Developer 작성, 다음 Developer 읽음
```

### 태스크 상태 흐름

```
[ ]          →  [dev-done]      →  [done]
아직 시작 안 함  개발 완료/리뷰 중   APPROVED + 커밋 완료
```

### 각 파일의 목적

| 파일 | 왜 존재하나 |
|------|------------|
| `tasks.md` | 에이전트끼리 "무엇을 해야 하는가" 공유 |
| `review_request.md` | Developer → Reviewer 핸드오프. "내가 이걸 바꿨고 이렇게 검증해라" |
| `review_result.md` | Reviewer → 메인세션 판정 전달. 메인세션이 APPROVED/REJECTED 읽음 |
| `review_history.md` | 라운드별 히스토리. Round 2 Reviewer가 "Round 1에서 뭘 지적했나" 확인 |
| `blockers.md` | Developer가 막혔을 때 사람에게 에스컬레이션하는 통로 |
| `notes.md` | Developer가 다음 호출에 남기는 메모. 컨텍스트 연속성 |

---

## 5. 플로우 3가지

### 5-1. 해피패스 (hello-harness)

모든 게 잘 되는 케이스. 가장 기본 흐름.

```
Planner → tasks.md 생성
    ↓
Developer → 구현 → review_request.md → [dev-done]
    ↓
Reviewer → review_result.md (APPROVED)
    ↓
메인세션 → tasks.md [done] → git commit → notify.sh approved
    ↓
다음 태스크로 이동
```

**실습 프로젝트:** `hello-harness`
- TASK-001: `add(a, b)` 함수 구현
- TASK-002: pytest 테스트 3개 작성
- 결과: 전부 Round 1 APPROVED

---

### 5-2. REJECT 루프 (reject-demo)

코드가 acceptance criteria를 못 만족해서 Reviewer가 거절하는 케이스.

```
Developer → 불완전한 구현 (에러 핸들링 없음)
    ↓
Reviewer → REJECTED (round 1)
    "ValueError 없음 / TypeError 없음"
    ↓
notify.sh rejected → Discord ❌ 알림
    ↓
Developer → rejection 읽고 수정 (round 2)
    ↓
Reviewer → APPROVED (round 2)
    review_history.md에 두 라운드 모두 기록
    ↓
메인세션 → [done] → commit → notify.sh approved
```

**최대 3라운드** — round 3에서도 REJECTED면 메인세션이 사용자에게 에스컬레이션하고 멈춤.

**실습 프로젝트:** `reject-demo`
- TASK-001: `divide(a, b)` — Round 1 REJECTED (에러 핸들링 없음) → Round 2 APPROVED
- TASK-002: pytest 4개 — Round 1 REJECTED (테스트 2개 누락) → Round 2 APPROVED

**REJECTED vs APPROVED 판단 기준:**
- Reviewer는 acceptance criteria를 체크리스트로 엄격하게 확인
- "동작은 하지만 요구사항 미충족" = REJECTED
- 코드 취향 차이 = Optional suggestions (거절 이유 아님)

---

### 5-3. BLOCKED 시나리오 (blocker-demo)

Developer가 코드를 쓰기 전에 막히는 케이스. REJECTED와 근본적으로 다름.

```
Developer → 구현 시도
    ↓ OPENWEATHER_API_KEY 없음 발견
Developer → 코드 한 줄도 안 쓰고 blockers.md 작성 후 중단
    ↓
메인세션 → blockers.md 읽음
    ↓
notify.sh blocked → Discord 🚧 알림
    ↓
[사람에게 에스컬레이션]
"API 키 없어요. .env에 OPENWEATHER_API_KEY 넣어주세요."
    ↓
사용자: .env에 키 추가
    ↓
사용자: "키 넣었어, 계속해줘" (이 대화창에서)
    ↓
메인세션 → Developer 재호출 (blockers.md 해결됨 확인)
    ↓
정상 흐름 재개 → APPROVED → [done]
```

**REJECTED vs BLOCKED 비교:**

| | REJECTED | BLOCKED |
|---|---|---|
| 누가 감지 | Reviewer | Developer |
| 시점 | 코드 작성 후 | 코드 작성 전 |
| 원인 | 품질/기준 미달 | 외부 의존성 없음 |
| 해결 | 다음 라운드 자동 재시도 | 사람이 직접 해결 후 재개 |
| 알림 | ❌ rejected | 🚧 blocked |

**Blocker가 발생하는 상황들:**
- API 키 / DB 접속 정보 없음
- 요구사항 모호 ("어떤 포맷으로 저장해야 하는지 불명확")
- 두 태스크가 순서 충돌 (TASK-003이 TASK-004 완료 필요)
- 외부 서비스 접근 불가

**실습 프로젝트:** `blocker-demo`
- TASK-001: `get_temperature(city)` — BLOCKED (API 키 없음) → 해결 후 APPROVED
- TASK-002: pytest 4개 (mock 사용) — Round 1 APPROVED

---

## 6. 알림 시스템

`scripts/notify.sh`가 Discord/Slack 웹훅으로 이벤트를 전송합니다.

### 설정

```bash
cp .env.example .env
# .env에 DISCORD_WEBHOOK_URL 또는 SLACK_WEBHOOK_URL 입력
```

웹훅이 없으면 조용히 종료 — 워크플로우를 절대 막지 않음.

### 이벤트 5종

| 이벤트 | 언제 | 이모지 | 예시 메시지 |
|--------|------|--------|-------------|
| `approved` | APPROVED + 커밋 후 | ✅ | `TASK-001: divide() 구현 완료` |
| `rejected` | REJECTED 판정 후 | ❌ | `TASK-002 Round 1: 테스트 2개 누락` |
| `blocked` | blockers.md 감지 | 🚧 | `TASK-001: API 키 없음` |
| `escalated` | 3라운드 초과 | ⚠️ | `TASK-003: 최대 라운드 초과` |
| `done` | 모든 태스크 [done] | 🎉 | `Project my-app: 모든 태스크 완료` |

### 사용법

```bash
# 메인 세션에서 직접 호출
./scripts/notify.sh approved "TASK-001: 구현 완료"
./scripts/notify.sh rejected "TASK-002 Round 1: 에러 핸들링 누락"
./scripts/notify.sh blocked  "TASK-003: DB 접속 정보 없음"
./scripts/notify.sh done     "Project my-app: 완료"
```

---

## 7. Discord 봇 양방향 연동

웹훅은 **단방향** (하네스 → Discord). 봇은 **양방향** (Discord ↔ 하네스).

### 구조

```
Discord 채널에서 입력:
  !run my-app TASK-001
        ↓
  bot.ts (로컬 실행 중)
        ↓  child_process
  claude --print "implement TASK-001..."
        ↓
  하네스 오케스트레이션
        ↓
  notify.sh → Discord 결과 알림
```

### 봇 명령어

| 명령어 | 설명 |
|--------|------|
| `!help` | 명령어 목록 |
| `!status <project>` | tasks.md 현재 상태 |
| `!plan <project> <요구사항>` | Planner 실행 |
| `!run <project> <TASK-XXX>` | 태스크 개발+리뷰 사이클 |

### 실행

```bash
pnpm install
pnpm dev   # ts-node로 실행 (개발)
# 또는
pnpm build && pnpm start  # 컴파일 후 실행 (운영)
```

자세한 설정: `DISCORD_SETUP.md` 참고

---

## 8. 토큰 비용 구조

### 왜 이렇게 많이 쓰이나?

각 에이전트는 **콜드 스타트** — 매번 CLAUDE.md, 에이전트 정의 파일, 상태 파일을 전부 새로 읽음. 약 12,000~18,000 토큰/호출.

### hello-harness 실측 (5호출)

| 호출 | 토큰 |
|------|------|
| Planner | ~13,647 |
| Developer (TASK-001) | ~14,441 |
| Reviewer (TASK-001) | ~14,224 |
| Developer (TASK-002) | ~14,748 |
| Reviewer (TASK-002) | ~15,839 |
| **합계** | **~72,899** |

### 비용 (claude-sonnet-4-6 기준)

| 규모 | 태스크 수 | 예상 비용 |
|------|-----------|-----------|
| 간단한 프로젝트 | 2태스크 | ~$0.40 |
| 소형 프로젝트 | 10태스크 | ~$2.00 |
| 중형 프로젝트 | 30태스크 | ~$6.00 |

**라운드마다 Developer + Reviewer 약 30,000 토큰 추가** — 3라운드 한도가 있는 이유.

### 절약 팁

- 에이전트 정의 파일을 간결하게 유지
- 상태 파일이 불필요하게 커지지 않도록 관리
- Planner/Reviewer는 더 저렴한 모델로 교체 가능 (v0.3 후보)

---

## 9. v0.1 vs v0.2 변경사항

### v0.1 (기초 scaffold)

- Planner / Developer / Reviewer 에이전트 정의
- CLAUDE.md 오케스트레이션 가이드
- `.state/` 파일 기반 통신 프로토콜
- git 커밋 컨벤션

### v0.2 (구조 개선 + 알림)

| 개선 | 파일 | 내용 |
|------|------|------|
| notes.md 읽기 | `developer.md` | 호출 시작 시 notes.md 먼저 읽어 컨텍스트 연속성 확보 |
| 라운드 히스토리 | `reviewer.md` | review_history.md에 모든 라운드 append — Round 2 Reviewer가 Round 1 지적사항 확인 가능 |
| [done] 상태 | `CLAUDE.md` | APPROVED 후 메인세션이 [dev-done] → [done] 업데이트 |
| 알림 스크립트 | `scripts/notify.sh` | Discord/Slack 웹훅 5개 이벤트 |
| 봇 | `bot.ts` | Discord에서 !run, !plan, !status 명령으로 하네스 제어 |

---

## 10. 다음 단계 (v0.3 아이디어)

### 즉시 가능한 것들

**per-task 브랜치**
```
TASK-001 시작 → git checkout -b task/001-add-function
APPROVED → PR → main 머지
```
CLAUDE.md에 이미 플레이스홀더 있음. 실제 구현 가능.

**멀티-LLM**
```
Planner   → Gemini Flash (저렴, 구조화 잘 함)
Developer → Claude Sonnet (코드 품질 중요)
Reviewer  → GPT-4o-mini (체크리스트 적용, 저렴)
```
비용 50% 이상 절감 가능. 단, 봇 설계 변경 필요.

### 중기 목표

**실제 프로젝트 투입**
- 여행사 앱 예약 API 모듈 (처음 언급한 목표)
- 10태스크짜리 프로젝트로 하네스 실전 검증

**웹 대시보드**
- tasks.md 상태를 실시간 UI로 시각화
- 각 태스크 클릭 → review_history.md 팝업

### 장기 목표

**Discord 양방향 고도화**
- 현재: `!run` → Claude Code CLI 호출
- 목표: 봇이 진행 상황을 실시간 스트리밍으로 Discord에 전송

---

## 빠른 참고 — 파일 위치

```
claude-code-harness/
├── CLAUDE.md                    ← 메인 오케스트레이션 규칙 (항상 여기 먼저)
├── STUDY_GUIDE.md               ← 이 파일
├── DISCORD_SETUP.md             ← Discord 봇 설정 가이드
├── V2_CHANGES.md                ← v0.2 변경사항 상세
├── bot.ts                       ← Discord 봇 소스
├── scripts/notify.sh            ← Discord/Slack 알림 스크립트
├── .env.example                 ← 환경변수 템플릿
├── .claude/
│   ├── agents/
│   │   ├── planner.md           ← Planner 에이전트 정의
│   │   ├── developer.md         ← Developer 에이전트 정의
│   │   └── reviewer.md          ← Reviewer 에이전트 정의
│   └── rules/
│       ├── workflow.md          ← 커밋 컨벤션, 태스크 범위 규칙
│       └── notifications.md     ← 알림 트리거 규칙
└── projects/                    ← gitignored. 실제 프로젝트 출력
    ├── hello-harness/           ← 해피패스 데모
    ├── reject-demo/             ← REJECT 루프 데모
    └── blocker-demo/            ← BLOCKED 시나리오 데모
```

---

## 핵심 요약 (한 페이지)

```
하네스 = Planner + Developer + Reviewer가 파일로 소통하는 시스템

플로우:
  요구사항 → Planner(tasks.md) → Developer(코드) → Reviewer(판정) → 커밋

3가지 결과:
  APPROVED  → [done] 표시 + 커밋 + ✅ 알림 + 다음 태스크
  REJECTED  → Developer 재시도 (최대 3라운드) + ❌ 알림
  BLOCKED   → 중단 + 🚧 알림 + 사람이 해결 후 "계속해줘"

에이전트 규칙:
  - git 명령은 메인세션만
  - 에이전트끼리 직접 대화 없음, 파일로만
  - Developer는 1호출 = 1태스크
  - Reviewer는 acceptance criteria를 체크리스트로 엄격하게

알림:
  ./scripts/notify.sh <event> "<message>"
  event: approved | rejected | blocked | escalated | done
```
