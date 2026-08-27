# Fairprice 현재 상태 (Claude Code 인수인계)

기준일: 2026-08-27 · 브랜치 `main` · 최신 커밋 `75b9a0b`
이전 작업 도구: Codex → **현재: Claude Code**

## 1. 서비스 개요

| 항목 | 값 |
| --- | --- |
| 운영 도메인 | `https://fairprice.kr` |
| 저장소 | `github.com/wildkorea8080-netizen/fairprice` |
| 운영 서버 | `115.68.222.86` (Coolify v4.3.11) — 2026-08-27 이전 완료 |
| 배포 | GitHub `main` 푸시 → **Coolify에서 Force Redeploy** (웹훅 없음, 수동) |
| 빌드 | 저장소 루트 `Dockerfile` (`node:22-slim`) |
| 수집 스케줄 | Coolify Scheduled Tasks — `npm run cron:pipeline`, `*/30 * * * *` |
| 런타임 | Next.js 16.2.9 (App Router) / React 19.2.4 / TypeScript |
| DB | PostgreSQL 16 + Prisma 7 (로컬은 Docker Compose) |
| 데이터 소스 | 쿠팡 파트너스 API (검색·골드박스·카테고리 베스트·딥링크) |
| 이메일 | Resend (미설정 시 dry-run) |
| 수익 | 쿠팡 파트너스 제휴 링크 + Google AdSense |

## 2. 아키텍처 지도

```text
src/
├─ app/                         Next.js App Router
│  ├─ (public)  /  /deals  /categories  /products/[slug]  /keywords/[keyword]
│  │            /alerts  /out/[slug](제휴 리다이렉트)  /feed.xml  /sitemap.xml
│  │            /robots.ts  /ads.txt  /privacy  /terms  /affiliate-disclosure
│  ├─ (auth)    /login  /signup  /forgot-password  /reset-password
│  ├─ admin/    products categories keywords discovery collection jobs
│  │            schedule notifications clicks deal-engine settings test
│  └─ api/
│     ├─ cron/  run-pipeline(통합) collect-products discover-keywords
│     │         process-collection-jobs evaluate-alerts send-notifications
│     └─ health/
│
├─ modules/                     ★ Deal Engine Core (Provider 비의존)
│  ├─ deal-engine/domain/       deal-score, deal-detection, data-confidence,
│  │                            entity, offer, price-snapshot, tracking-priority
│  ├─ deal-engine/application/  collect-source-offers
│  ├─ deal-engine/ports/        source-provider, affiliate-provider
│  └─ providers/coupang/        coupang-source, coupang-mapper, coupang-affiliate
│
├─ lib/                         Fairprice 애플리케이션 계층 (대부분 server-only)
│  ├─ 수집    collection-jobs, collection-rules, collection-job-selection,
│  │          cron-pipeline, tracking-policies, keyword-candidates
│  ├─ 쿠팡    coupang/{client,discovery,keyword-discovery,normalize,tracker,types}
│  ├─ 분석    deal-analytics, deal-detector, deal-products, deal-feed
│  ├─ 카탈로그 catalog/{unit-normalizer,title-similarity,diverse-products}
│  ├─ 알림    alert-evaluator, alert-delivery-policy, alert-matcher,
│  │          notification-sender, notifications, email
│  ├─ 인증    auth, users, passwords, password-reset
│  └─ SEO     seo/product-indexability, seo-jsonld, seo-keywords, adsense
│
└─ components/                  product-card, price-history-chart,
                                price-change-timeline, deal-filters, admin/*
```

### 자동화 파이프라인

```text
discover → click-keywords → collect → alerts → send
```

`GET /api/cron/run-pipeline` (헤더 `Authorization: Bearer <CRON_SECRET>`) 하나로 실행된다.
단계별 실행은 `?steps=alerts,send` 형태. 상세는 `DEPLOYMENT.md`.

### 데이터 계층 (3단)

| 테이블 | 역할 | 보존 |
| --- | --- | --- |
| `price_observations` | 모든 수집 시도(실패·품절·이상치 포함) | 90일 권장, 현재 자동 삭제 없음 |
| `product_price_histories` | 기존 화면 호환용 투영. 가격 변동 시 또는 UTC 하루 첫 관측 시 기록 | 유지 |
| `daily_price_aggregates` | offer × UTC 일자 1행 (open/close/low/high/median) | 영구, 장기 통계의 기준 |

Prisma 모델 41개. 핵심 축은
`ProductGroup / ProductVariant`(카탈로그) → `DealEntity / Offer`(Core 표준형) →
`DealEvent / Deal / DealScoreConfig / DealAnalysisSnapshot`(판정),
그리고 호환 레이어 `Product / ProductPriceHistory`.

## 3. 완료된 기능

- 쿠팡 파트너스 API 서명·검색·골드박스·카테고리 베스트·딥링크 변환
- 키워드 후보 발굴(쿠팡 + 제휴 클릭 신호) 및 신뢰 후보 자동 승격(최대 100 규칙)
- 영속 수집 잡 큐, 우선순위·재시도·중단된 실행 복구, 카테고리 라운드로빈 분산
- 적응형 추적 티어(`ProductTrackingPolicy`), 데이터 신뢰도(`DataConfidence`)
- Deal Score V1(설정 버전 관리 + 근거 스냅샷), Deal Detection 6종, Hot Deal 자동 생성/48시간 만료
- 상품 상세: 대화형 가격 그래프, 가격 변동 타임라인, 단위 가격 비교, 신뢰도 진행 표시
- 홈 피드 다양성 보정, 딜 필터, 카테고리·키워드 페이지
- 회원/관리자 인증(서명 쿠키), 비밀번호 재설정 메일, 관심 상품·키워드, 알림 규칙
- 이메일 알림 아웃박스 + Resend 발송, dry-run 지원
- 관리자 12개 화면(상품·수집·잡·스케줄·알림·클릭·Deal Engine·진단)
- `/api/health` 준비도 점검(DB, 쿠팡, cron 신선도, 가격추적 신선도, 이메일, 법적 고지)
- SEO: 사이트맵·RSS·JSON-LD·canonical, 신선도 기반 색인 적격성 판정
- AdSense `ads.txt`, 제휴 고지 페이지
- 백업/복구 스크립트, 프로덕션 환경변수 검증, 스모크 테스트, `verify:deploy`

## 4. 진행 중 — 미커밋 작업 (Codex가 남긴 것)

**알림 중복 방지 개선.** Codex가 도구 사용량 제한으로 빌드·푸시를 못 하고 중단했다.
**Claude Code에서 검증을 마쳤고 커밋 가능한 상태다.**

변경 파일:

```text
A  src/lib/alert-delivery-policy.ts          정책 순수 함수
A  scripts/test-alert-delivery-policy.mjs    단위 테스트
M  src/lib/alert-evaluator.ts                직전 관측 비교 + 쿨다운 적용
M  src/app/admin/notifications/actions.ts    쿨다운 제외 건수 전달
M  src/app/admin/notifications/page.tsx      쿨다운 제외 건수 표시
M  package.json                              test:alert-delivery-policy 등록
M  .env.example, .env.production.example     ALERT_COOLDOWN_HOURS=24
```

동작: 기존에는 알림 이력이 한 번이라도 있으면 영구 차단이었다.
이제 직전 가격 관측도 조건을 충족했으면 "중복"으로 건너뛰고,
조건 밖으로 나갔다가 다시 진입한 경우에만 재알림하며 기본 24시간 쿨다운을 적용한다.
`ALERT_COOLDOWN_HOURS`로 1~168시간 조정 가능.

설계 이력: 처음에는 `alert_match_states` 테이블을 추가하려 했으나 Prisma 재생성이 막혀
**DB 스키마 변경 없이** `product_price_histories`의 직전 관측값을 비교하는 방식으로 전환했다.
그 과정에서 남은 빈 마이그레이션 디렉터리
`prisma/migrations/20260824110000_alert_match_states/`는 Claude Code에서 삭제했다
(빈 디렉터리는 `prisma migrate deploy`를 실패시킨다).

검증 결과 (2026-08-26, Claude Code):

```text
npm run test:alert-delivery-policy   PASS
npx tsc --noEmit                     PASS
npm run lint                         PASS
npm run build                        PASS
```

→ 남은 일: 커밋 + `main` 푸시 + Coolify Force Redeploy.

## 5. 다음 우선순위 후보

Codex의 최근 작업 흐름은 "사용자 화면에 직접 효과가 큰 것부터"였다.
`IMPLEMENTATION_AUDIT.md`의 게이트 기준으로 남은 항목:

1. **알림 품질 마무리** — 수신거부는 구현됐다(`src/lib/alert-subscriptions.ts`,
   `/unsubscribe`, `List-Unsubscribe` 헤더). 남은 것은 알림 구독 확인(confirm) 흐름과
   발송 실패율 모니터링이다.
2. **운영 모니터링** — 실패율 측정은 구현됐다(`src/lib/operational-health.ts`,
   `/api/health`의 `reliability`, `/admin` 상단 카드). 남은 것은 **자동 통보**다.
   지금은 사람이 화면을 열어봐야 알 수 있다. `checks.reliabilityHealthy`를
   외부 모니터가 폴링하거나, 파이프라인이 저하를 감지했을 때 운영자에게
   메일을 보내는 방식이 후보다. 게이트 10.
3. **회귀 테스트 정비** — `npm test`가 `scripts/test-*.mjs`를 자동 탐색해 전부 돌리고,
   `.github/workflows/ci.yml`이 푸시마다 같은 검사를 반복한다. 다만 전부 **순수 함수**
   단위 테스트다. DB를 거치는 경로(수집 잡 처리, 알림 평가, 가격 관측 기록)와
   Deal Engine 통합 경로에는 여전히 테스트가 없다. 지시서 STEP 10은 미완이며,
   통합 테스트 기반은 갖춰졌다(`scripts/integration/`, `npm run test:integration`).
   현재는 알림 평가 경로 하나만 덮는다. 수집 잡 처리와 Deal Engine 통합 경로가 남았다.
4. **raw observation 정리 잡** — 90일 보존 정책이 문서에만 있고 구현되지 않았다.
   집계 커버리지 점검과 백업이 안정된 뒤에만 활성화할 것.
5. **검색/캐시** — 검색은 최대 120개 상품을 DB에서 읽어 메모리 문자열 필터링한다.
   상품 수가 늘면 병목. 캐시 계층 없음.
6. **콘텐츠 품질** — 상품명 정제, 카테고리 자동 매핑 정확도.

## 5-1. 백업 (2026-08-27 기준 미설정)

**신서버에는 아직 백업이 없다.** 구서버(`49.247.170.26`)가 2026-08-26 시점의
데이터를 갖고 있어 임시 안전망 역할을 하고 있을 뿐이다. 구서버를 폐기하기 전에
반드시 Coolify PostgreSQL 리소스의 Backups를 설정하고, 최소 한 번 복구를
검증해야 한다. 절차는 [`DEPLOYMENT.md`](../DEPLOYMENT.md)의
"Database Backup and Restore" 참조.

앱 쪽 Scheduled Task로 `npm run db:backup`을 거는 방식은 쓰지 않는다.
배포할 때마다 컨테이너가 새로 만들어지면서 백업 파일이 함께 사라진다.

## 6. 로컬 개발

```bash
npm run db:up          # Docker PostgreSQL 16
npm run db:check       # 접속 확인
npm run db:migrate     # 마이그레이션 적용
npm run dev            # http://localhost:3000
```

`.env.example`를 `.env.local`로 복사해 값을 채운다.
`.env.local`은 저장소에 커밋하지 않는다.

## 7. 알아둘 함정

- `npm run build`는 `scripts/build.mjs`를 거쳐 `prisma generate` 후 `next build`를 실행한다.
  Prisma 엔진 재생성에 네트워크가 필요하다.
- `next.config.ts`의 `experimental.cpus: 1`은 저사양 배포 환경 대응이다. 되돌리지 말 것.
- `FAIRPRICE_DEPLOYMENT_MODE=production`일 때만 HSTS 헤더가 붙는다.
- 모든 `/api/cron/*`는 `Authorization: Bearer <CRON_SECRET>`를 요구한다.
- Windows 환경이라 git이 CRLF 경고를 낸다. 정상이다.
- **푸시해도 자동 배포되지 않는다.** Coolify가 Public Git Repository 방식이라 웹훅이 없다.
  Force Redeploy를 눌러야 반영된다. 실제로 이 때문에 4커밋이 한동안 미배포로 남아 있었다.
- **상품 색인은 "최근 72시간 이내 가격 확인"을 요구한다**(`src/lib/seo/product-indexability.ts`).
  수집이 72시간 이상 멈추면 모든 상품이 `sitemap.xml`과 검색 색인에서 빠진다.
  점검 등으로 cron을 멈출 때는 이 시간을 넘기지 말 것.
- 빌드는 Nixpacks가 아니라 `Dockerfile`을 쓴다. 이유는 [`SERVER_MIGRATION.md`](SERVER_MIGRATION.md)의
  "Nixpacks Node 버전 함정" 참조 — Nixpacks 기본 스냅샷의 Node가 Prisma 7 요구 버전에 미달한다.
