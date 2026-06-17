# v0.2 변경사항 요약

브랜치: `feat/v0.2-improvements`
커밋: `645fec4`

다녀오시는 동안 3가지 구조적 개선 + Discord/Slack 알림 기능을 추가했습니다.
`reject-demo` 프로젝트에서 전체 사이클을 돌려서 모두 검증 완료했어요.

---

## 무엇이 바뀌었나

### 1. Developer가 notes.md를 먼저 읽는다

**파일:** `.claude/agents/developer.md`

이전엔 Developer가 매번 "콜드 스타트"였어요. 이전 호출에서 메모를 남겨도 다음 호출에서 읽지 않았습니다.

이제 Developer는 호출 시작 시 `notes.md`가 있으면 무조건 읽습니다. 예를 들어:
- "TASK-003 구현 전에 utils.py의 헬퍼 함수 확인할 것"
- "DB 스키마가 변경됨 — task-004에서 마이그레이션 필요"

이런 메모가 다음 Developer 호출까지 자동으로 이어집니다.

---

### 2. Reviewer가 라운드 히스토리를 보존한다

**파일:** `.claude/agents/reviewer.md`

이전엔 `review_result.md`를 매 라운드마다 덮어써서 Round 1의 거절 사유가 사라졌어요. Round 2 Reviewer는 "이전에 뭘 지적했는지" 알 수 없었습니다.

이제 Reviewer는 두 파일에 씁니다:

| 파일 | 방식 | 용도 |
|------|------|------|
| `review_result.md` | 덮어쓰기 | 메인 세션이 최신 판정을 읽음 |
| `review_history.md` | 추가(append) | 전체 라운드 히스토리 보존 |

Round 2 Reviewer가 `review_history.md`를 먼저 읽고 "Round 1에서 지적한 것들이 진짜 고쳐졌는가"를 확인합니다.

`reject-demo`에서 실제로 생성된 `review_history.md` 결과:
```
## Round 1 — REJECTED
  → 2개 테스트 누락 (test_integer_inputs, test_non_numeric_raises_type_error)

---

## Round 2 — APPROVED
  → 두 테스트 모두 추가됨, Round 1 지적사항 모두 해결
```

---

### 3. Tasks.md [done] 상태가 실제로 적용된다

**파일:** `CLAUDE.md`

이전엔 워크플로우 다이어그램에 `[done]`이 언급만 됐지 실제 규칙이 없었어요.

이제 CLAUDE.md에 명시:
> APPROVED → 메인 세션이 `tasks.md`에서 `[dev-done]` → `[done]` 업데이트 → 커밋

프로젝트 중단 후 재개할 때 `tasks.md`를 보면 정확히 어디서 멈췄는지 알 수 있습니다:
- `[ ]` = 아직 시작 안 함
- `[dev-done]` = 개발 완료, 리뷰 대기/진행 중
- `[done]` = APPROVED + 커밋 완료

---

### 4. Discord / Slack 알림

**새 파일들:**
- `scripts/notify.sh` — 웹훅 호출 스크립트
- `.env.example` — 웹훅 URL 설정 템플릿
- `.claude/rules/notifications.md` — 언제 어떻게 호출하는지 규칙

#### 지원 이벤트

| 이벤트 | 트리거 | 메시지 예시 |
|--------|--------|------------|
| `approved` | 태스크 APPROVED + 커밋 후 | `✅ [harness] TASK-002: pytest tests committed` |
| `rejected` | 리뷰어 REJECTED 판정 후 | `❌ [harness] TASK-002 Round 1: missing 2 test cases` |
| `blocked` | blockers.md 감지 | `🚧 [harness] TASK-003 is blocked: DB connection unavailable` |
| `escalated` | 3라운드 초과 | `⚠️ [harness] TASK-004: max rounds exceeded — needs human input` |
| `done` | 모든 태스크 [done] | `🎉 [harness] Project my-app: all tasks complete` |

#### 설정 방법

```bash
cp .env.example .env
# .env 파일을 열고 웹훅 URL 입력
```

**.env 파일:**
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

웹훅이 설정되지 않으면 스크립트가 조용히 종료됩니다 — 워크플로우를 절대 막지 않아요.

#### Discord 웹훅 만드는 법
1. Discord 서버 → 채널 설정 → **연동** → **웹훅**
2. **새 웹훅** → 이름 입력 (예: "harness-bot") → URL 복사
3. `.env`에 `DISCORD_WEBHOOK_URL=복사한URL` 입력

---

## 파일 구조 변화

```
클로드 하네스 v0.2
├── CLAUDE.md                          ← 워크플로우 다이어그램 업데이트, 알림 규칙 추가
├── .env.example                       ← 새 파일: 웹훅 URL 템플릿
├── .gitignore                         ← .env 추가
├── scripts/
│   └── notify.sh                      ← 새 파일: Discord/Slack 웹훅 스크립트
└── .claude/
    ├── agents/
    │   ├── developer.md               ← notes.md 먼저 읽는 규칙 추가
    │   └── reviewer.md                ← review_history.md append 규칙 추가
    └── rules/
        ├── workflow.md                ← 변경 없음
        └── notifications.md           ← 새 파일: 알림 트리거 규칙
```

---

## 검증 결과 (reject-demo 프로젝트)

v0.2 에이전트들로 TASK-002 전체 사이클을 돌렸습니다:

| 단계 | 결과 |
|------|------|
| Developer Round 1 (notes.md 없음 → graceful skip) | ✅ |
| Reviewer Round 1 → REJECTED + review_history.md 생성 | ✅ |
| notify.sh rejected 호출 (웹훅 없음 → 조용히 종료) | ✅ |
| Developer Round 2 | ✅ |
| Reviewer Round 2 → review_history.md에 read + append | ✅ |
| pytest 4/4 통과 | ✅ |
| tasks.md [done] 업데이트 | ✅ |
| notify.sh approved + done 호출 | ✅ |

---

## 다음 단계 (v0.3 후보)

- **per-task 브랜치**: `CLAUDE.md`에 이미 플레이스홀더 있음 — 실제 구현 가능
- **멀티-LLM**: Planner/Reviewer를 더 저렴한 모델로 교체 (비용 절감)
- **Discord 양방향**: Discord 명령 → 하네스 트리거 (봇 서버 필요)
- **웹 대시보드**: tasks.md 상태를 실시간 UI로 시각화
