# Discord 봇 설정 가이드

하네스에 Discord 양방향 연동을 설정하는 순서입니다.  
완료하면 Discord 채널에서 `!run`, `!plan`, `!status` 명령으로 하네스를 직접 제어할 수 있습니다.

---

## 전체 흐름

```
1. Discord 봇 애플리케이션 생성  (Developer Portal)
2. 봇을 서버에 초대
3. 웹훅 URL 생성                 (알림 전송용)
4. .env 설정
5. 패키지 설치 및 실행
6. 테스트
```

---

## 1. Discord Developer Portal — 봇 생성

### 1-1. 애플리케이션 만들기

1. [discord.com/developers/applications](https://discord.com/developers/applications) 접속
2. 우측 상단 **New Application** 클릭
3. 이름 입력 (예: `harness-bot`) → **Create**

### 1-2. 봇 토큰 발급

1. 좌측 사이드바 **Bot** 클릭
2. **Reset Token** → **Yes, do it!**
3. 토큰 복사 → `.env`의 `DISCORD_BOT_TOKEN`에 붙여넣기

   > ⚠️ 토큰은 한 번만 표시됩니다. 바로 복사하세요.

### 1-3. Message Content Intent 활성화 (필수)

같은 **Bot** 페이지에서 아래로 스크롤:

- **Privileged Gateway Intents** 섹션
- **Message Content Intent** → 토글 ON
- 페이지 하단 **Save Changes**

> 이걸 켜지 않으면 봇이 메시지 내용을 읽지 못해서 명령이 동작하지 않습니다.

---

## 2. 봇을 서버에 초대

### 2-1. OAuth2 URL 생성

1. 좌측 사이드바 **OAuth2 → URL Generator**
2. **Scopes** 섹션에서 `bot` 체크
3. **Bot Permissions** 섹션에서 다음 체크:
   - `Send Messages`
   - `Read Message History`
4. 페이지 하단에 생성된 URL 복사

### 2-2. 초대

1. 복사한 URL을 브라우저에 붙여넣기
2. 봇을 초대할 서버 선택 → **계속하기** → **승인**

---

## 3. 웹훅 URL 생성 (알림 전송용)

봇이 결과를 특정 채널에 알림으로 보내려면 웹훅도 필요합니다.

1. Discord 서버에서 알림을 받을 채널 선택
2. 채널 이름 옆 **⚙️ 설정** → **연동** → **웹훅**
3. **새 웹훅** → 이름 입력 (예: `harness-notify`) → **웹훅 URL 복사**
4. `.env`의 `DISCORD_WEBHOOK_URL`에 붙여넣기

---

## 4. 채널 ID 복사

봇이 특정 채널에서만 명령을 듣도록 설정합니다.

### 4-1. 개발자 모드 활성화

1. Discord → **설정 (톱니바퀴)** → **고급**
2. **개발자 모드** → ON

### 4-2. 채널 ID 복사

1. 봇이 명령을 받을 채널 우클릭
2. **채널 ID 복사**
3. `.env`의 `DISCORD_CHANNEL_ID`에 붙여넣기

---

## 5. .env 설정

`.env.example`을 복사해서 `.env`를 만들고 채웁니다:

```bash
cp .env.example .env
```

`.env` 파일:

```env
# 알림 전송용 (notify.sh)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# 봇 토큰 (bot.ts)
DISCORD_BOT_TOKEN=MTxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 봇이 명령을 들을 채널 ID
DISCORD_CHANNEL_ID=1234567890123456789
```

---

## 6. 패키지 설치 및 실행

```bash
pnpm install

# 개발 모드로 바로 실행 (ts-node 사용)
pnpm dev

# 또는 빌드 후 실행
pnpm build
pnpm start
```

터미널에 이렇게 뜨면 성공:

```
✅ Bot online: harness-bot#1234
   Channel filter: 1234567890123456789
```

---

## 7. 테스트

### 알림 테스트 (notify.sh)

```bash
./scripts/notify.sh approved "테스트 알림"
```

Discord 채널에 `✅ [harness] 테스트 알림` 이 오면 정상.

### 봇 명령 테스트

봇을 초대한 서버의 지정 채널에서:

```
!help
```

봇이 명령어 목록을 응답하면 연동 완료.

---

## 사용 가능한 명령어

| 명령어 | 설명 | 예시 |
|--------|------|------|
| `!help` | 명령어 목록 | `!help` |
| `!status <project>` | tasks.md 현재 상태 조회 | `!status reject-demo` |
| `!plan <project> <요구사항>` | Planner 실행, tasks.md 생성 | `!plan my-app 예약 API 만들어줘` |
| `!run <project> <TASK-XXX>` | 해당 태스크 개발+리뷰 사이클 실행 | `!run my-app TASK-001` |

### `!run` 실행 시 흐름

```
Discord: !run reject-demo TASK-001
  ↓
봇: "🔄 TASK-001 시작 중..."
  ↓
claude --print 호출 → Developer → Reviewer
  ↓
notify.sh → Discord 알림
  ✅ TASK-001: divide() 구현 커밋 완료
  또는
  ❌ TASK-001 Round 1: 에러 핸들링 누락
  ↓
봇: "✅ 세션 종료 — Discord 알림 확인하세요"
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 봇이 메시지에 반응 없음 | Message Content Intent 꺼짐 | Developer Portal → Bot → Intent ON |
| 명령이 다른 채널에서도 동작 | `DISCORD_CHANNEL_ID` 미설정 | `.env`에 채널 ID 추가 |
| `claude: command not found` | Claude Code CLI 경로 문제 | `which claude` 확인 후 bot.ts의 spawn 경로 수정 |
| 봇 토큰 오류 | 토큰 만료 또는 오타 | Developer Portal에서 토큰 재발급 |
| 웹훅 알림 안 옴 | URL 오타 | `.env`의 `DISCORD_WEBHOOK_URL` 재확인 |
