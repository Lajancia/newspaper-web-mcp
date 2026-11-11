# WebMCP 여정: 아이디어 → 개발 → 문제 → 우회 → 결론

> newspaper-web-mcp 개발 기록 (2026년 11월, 타라 × Hermes)
> 이 문서는 "WebMCP를 사용해본 과정"이 아니라 "WebMCP 규격 페이지를 만들고,
> 우회 경로로 구동해본 과정"의 정직한 기록이다.

---

## 1. 아이디어

**"TARA's Daily" — 에이전트가 채워주는 개인 신문.**

- 매일 아침 에이전트가 뉴스를 찾아서 판을 채운다. 유저는 그저 보면 된다.
- 핵심 제약: **백엔드 없음**. 서버는 정적 파일만 서빙하고, 데이터는 열린 탭의
  메모리에만 산다. 새로고침하면 백지 — 이건 버그가 아니라 설계다.
- 동기부여였던 표준: **WebMCP** (W3C 제안 표준, Google+Microsoft 공동 작성).
  페이지가 `modelContext`에 도구를 등록하면 에이전트가 DOM을 긁지 않고
  "함수 + 인자"로 페이지를 조작한다. 스크래핑 시대의 끝을 향한 규격.

페이지가 등록한 도구 5개:

| 도구 | 인자 | 역할 |
|---|---|---|
| `set_date` | `date` (YYYY-MM-DD) | 머리글 날짜 |
| `add_headline` | `title`(필수), `url`, `summary`, `source` | 헤드라인 |
| `add_story` | `title`, `body`(필수), `url`, `source` | 2열 기사 |
| `add_task` | `text`(필수), `due` | 할 일 사이드바 |
| `clear_paper` | — | 판 전체 비우기 |

모든 `execute()`는 async이고 `{ ok: true, ... }`를 반환한다. 렌더링 로직은
전부 도구 내부에 있고, 에이전트는 절대 DOM 수술(querySelector/innerHTML)을
하지 않는다 — 이게 WebMCP 계약의 본질이다.

## 2. 개발 과정

**스택**: Next.js App Router + Tailwind + shadcn/ui. 관심사 분리:
`src/lib/webmcp-register.ts` (도구 정의) / `src/lib/newspaper-store.ts`
(상태, useSyncExternalStore) / UI 컴포넌트 — 스킨을 갈아입어도 계약은 그대로.

**이중 등록 전략** (이 프로젝트의 가장 중요한 설계 결정):
- `navigator.modelContext.registerTool()` — 네이티브 WebMCP 경로.
  기능이 없는 브라우저에서는 피처 디텍트 후 조용히 스킵.
- `window.__NEWSPAPER_TOOLS__` 미러 레지스트리 — 같은 pass에서 항상 설치.
  CDP로 붙는 에이전트는 미러의 `execute()`를 직접 호출한다.

미러가 있기 때문에 플래그 없는 브라우저에서도 우회 경로가 작동하고,
네이티브 클라이언트가 등장하면 같은 도구가 그대로 노출된다.

## 3. 문제 봉착

### 3-1. "보이지 않는 곳에 채워진다"
첫 채움은 Hermes 자체 브라우저(헤드리스) 탭에서 성공했지만, 유저에게는
창이 없으니 아무리 성공해도 안 보였다.
→ **대원칙 확립: 유저가 볼 수 있는 브라우저에만 채운다.**

### 3-2. Hermes는 네이티브 WebMCP 클라이언트가 아니다
`chrome://flags/#enable-webmcp-testing`는 페이지 쪽 API만 켠다. 도구를
**소비하는** 클라이언트(ChatGPT Desktop, Brave Leo)가 없으면 브라우저는
등록된 도구를 아무에게도 전달하지 않는다. 2026년 11월 기준 주류 에이전트
클라이언트 중 `modelContext`를 소비하는 곳은 사실상 ChatGPT Desktop의
내장 브라우저가 유일하고, Chrome의 본격 소비자인 Gemini in Chrome은 미출시.

### 3-3. CDP 포트가 매번 달라진다
브리지가 살아있는 설계라 강제 종료 후 트랜스크립트 파싱으로 검증했지만,
`NEWSPAPER_CDP` → 보이는 디버그 포트 → 헤드리스 순으로 자동 탐지하는
래퍼로 해결. (탐지 순서를 처음에 반대로 써서 헤드리스를 먼저 잡아
"안 보이는 채움"이 재발했다 — 순서를 뒤집었다.)

### 3-4. 게이트웨이의 스테일 브리지
Hermes 게이트웨이가 MCP 연결을 영구 유지해서, 수정 전 브리지(헤드리스
포트)가 계속 붙어 있었다. → **래퍼 수정 후엔 반드시 스테일 브리지 프로세스
kill.** 이 교훈은 모든 MCP 개발에 재사용 가능하다.

### 3-5. AppleScript 격리 월드
평소 크롬(디버그 포트 없음)을 목표 경로로 삼았을 때: AppleScript의
"JavaScript 실행" 기능은 격리 월드에서 돌아서 페이지 글로벌
(`__NEWSPAPER_TOOLS__`)이 안 보였다. CDP에선 보였던 것과 다르다.
→ 우회법: DOM에 `<script>` 태그 주입 → 메인 월드 실행 → 채우기 코드를
base64로 싣고(AppleScript 이스케이프 지옥 회피) → 결과를 `document.title`
로 보고 + 폴링. 전부 `{ok:true}`, 유저 탭에 "5건 게재됨" 렌더 확인.
전제 조건 3개: Apple Events JS 허용(완전 재시작 후 재체크), TCC 자동화
권한(-1743), 헤드리스 인스턴스 충돌 정리.

### 3-6. 도구 순서 함정
`clear_paper`가 날짜까지 초기화한다. `set_date`는 반드시 `clear_paper` **이후**에.

## 4. 우회 경로 총정리

| 경로 | 방식 | modelContext 사용 | 용도 |
|---|---|---|---|
| A. 미러 + CDP | Hermes 브라우저가 `__NEWSPAPER_TOOLS__`의 execute() 직접 호출 | ❌ | 개발/검증 |
| A2. MCP 브리지 | stdio JSON-RPC ↔ CDP 브리지를 Hermes MCP 서버로 등록 | ❌ | "뉴스퍼 채워줘" 한마디 |
| B. AppleScript 주입 | script-tag + base64 → 메인 월드 | ❌ | 유저의 평소 크롬 |
| (미래) 네이티브 | 브라우저가 도구를 중재 → 클라이언트 호출 | ✅ | 클라이언트 출시 후 |

공통점: **전부 페이지의 도구를 "실행"했을 뿐, 브라우저의 중재 파이프라인은
한 번도 통과하지 않았다.** 컨센트 UI, 도구 발견, 브라우저 권한 게이트 —
WebMCP 특유의 것은 아직 경험하지 못했다.

## 5. 결론

**페이지 쪽은 WebMCP, 클라이언트 쪽은 우회.** "WebMCP를 사용해본다"고
하기엔 이르고, "WebMCP 규격의 페이지를 만들어두고 다리로 구동해봤다"가
정확하다. 이건 실패가 아니라 시대가 아직 안 온 것 — 2026년 11월 현재:

- 브라우저: Chrome 149~156 origin trial (플래그), Edge trial, Firefox neutral,
  **Safari oppose**. API 위치가 `navigator.modelContext` → `document.modelContext`
  로 이동했고 Chrome 150부터 구버전 위치 deprecated — 이 페이지의 미해결
  코드 과제 1순위(피처 디텍트에 둘 다 잡기).
- 클라이언트: ChatGPT Desktop (내장 브라우저), Brave Leo (실험), Gemini in
  Chrome (미출시, 나오면 첫 대중 클라이언트).

**진짜 네이티브 테스트 경로** (README의 Testing natively 참조):
1. Model Context Tool Inspector 확장 — localhost에서 바로, API 키만으로
   브라우저 중재 경로 검증. 가장 빠른 "제대로 사용해보기".
2. ChatGPT Desktop — 실 URL 배포 후 end-to-end.
3. Brave Leo — 설치만으로, 실험 단계.

**이 구조가 남기는 것**: 페이지 계약은 클라이언트 생태계가 붙는 순간 그대로
작동한다. 지금까지의 브리지·AppleScript 다리는 그때 은퇴하면 되고, 다리가
남긴 함정 기록(스테일 브리지, 격리 월드, 헤드리스 채움)은 어떤
"브라우저 중재 페이지" 프로젝트에도 이월된다.
