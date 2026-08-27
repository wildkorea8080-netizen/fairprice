<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Fairprice — agent working guide

Fairprice(`https://fairprice.kr`)는 쿠팡 상품 가격을 자동 수집·추적하고,
특가를 판정해 피드와 이메일 알림으로 전달하는 서비스다.
이 저장소는 동시에 **Deal Engine Core**의 첫 번째 검증 서비스다.

작업 전 반드시 읽을 문서:

| 문서 | 목적 |
| --- | --- |
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | 현재 상태, 아키텍처 지도, 다음 우선순위 |
| [`docs/DEAL_ENGINE_DIRECTIVE.md`](docs/DEAL_ENGINE_DIRECTIVE.md) | 변경 불가 아키텍처 원칙 (사용자 지시) |
| [`docs/IMPLEMENTATION_AUDIT.md`](docs/IMPLEMENTATION_AUDIT.md) | 도메인 경계와 단계별 완료 기준 |
| [`docs/deal-engine/`](docs/deal-engine/) | Deal Score / Deal Detection / 가격 이력 정책 |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | 배포·운영 절차 |
| [`docs/SERVER_MIGRATION.md`](docs/SERVER_MIGRATION.md) | 서버 이전 절차서 |

## 절대 원칙

`docs/DEAL_ENGINE_DIRECTIVE.md`가 최상위다. 요약하면:

- 기존 코드를 이유 없이 재작성하지 않는다. 재사용이 우선이다.
- Deal Score / Deal Detection은 LLM을 호출하지 않는다. 규칙 + 통계로만 계산한다.
- 점수 로직을 UI 컴포넌트에 넣지 않는다. `src/modules/deal-engine/domain/`에 둔다.
- 쿠팡 전용 로직을 Core에 직접 넣지 않는다. `src/modules/providers/coupang/`에 격리한다.
- 마이그레이션은 가산적(additive)으로 한다. 기존 컬럼·테이블을 지우지 않는다.
- 여행(Travel) 어댑터는 지금 구현하지 않는다. 확장 가능한 형태만 유지한다.

## 작업 방식

한 번에 큰 변경을 하지 않는다. 매 작업은 다음 순서를 따른다.

```text
현재 코드 분석 → 최소 변경 계획 → 구현 → 검증 → 커밋/푸시 → Coolify Force Redeploy
```

순수 로직을 새로 만들 때는 `src/lib/*.ts` 또는
`src/modules/deal-engine/domain/*.ts`에 DB 접근 없는 함수로 분리하고,
`scripts/test-*.mjs`에 `node:assert/strict` 단위 테스트를 추가한다.
파일 이름만 규칙에 맞으면 `npm test`가 자동으로 집어간다.
`src/lib/alert-delivery-policy.ts` + `scripts/test-alert-delivery-policy.mjs`가 표준 예시다.

DB에 접근하는 코드는 별도 파일로 분리한다
(`operational-health.ts`는 판정 로직, `reliability.ts`는 조회).
이렇게 나눠야 판정 로직을 DB 없이 테스트할 수 있다.

## 검증 게이트

커밋 전 아래를 모두 통과시킨다.

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

`npm test`는 `scripts/test-*.mjs`를 **자동으로 찾아서** 전부 실행한다.
새 테스트 파일을 만들면 등록 없이 게이트에 포함된다.
개별 실행은 이름 일부를 넘긴다.

```bash
npm test alert      # test-alert-delivery-policy.mjs만 실행
```

`node_modules`를 새로 설치한 뒤에는 **`npx prisma generate`를 먼저 실행한다.**
Prisma 7은 설치 시 클라이언트를 생성하지 않으며, 생성물이 없으면 타입체크가
모든 모델을 `any`로, enum을 "없는 export"로 보고한다. `npm run build`는
내부에서 generate를 실행하므로 빌드를 한 번 돌렸다면 이미 준비된 상태다.

푸시하면 `.github/workflows/ci.yml`이 같은 검사를 다시 돌린다.
다만 Coolify 배포는 수동이므로 **CI가 배포를 막아주지는 않는다.**
배포 전에 GitHub Actions가 초록인지 직접 확인한다.

배포된 도메인까지 검증할 때는:

```bash
npm run verify:deploy -- --baseUrl=https://fairprice.kr --requireHsts=true
```

## 코드 컨벤션

- 서버 전용 모듈은 첫 줄에 `import "server-only";`.
- 경로 별칭은 `@/*` → `src/*`.
- 객체 리터럴과 타입 필드는 알파벳순으로 정렬한다(기존 코드 전반의 규칙).
- 사용자 노출 문구는 한국어, 코드/식별자/주석은 영어.
- 관측된 가격과 판매자가 표기한 할인율을 문구에서 구분한다.
- DB 미설정 시 공개 페이지는 조용히 샘플 데이터로 넘어가지 않는다. 정직한 저하 상태를 보여준다.

## 데이터베이스

- Prisma 7 + PostgreSQL 16. 로컬은 Docker Compose(`npm run db:up`).
- `DATABASE_URL`은 `prisma.config.ts`가 읽는다.
- 스키마 변경 시 `npx prisma migrate dev --name <name>`으로 마이그레이션 파일을 만든다.
  **빈 마이그레이션 디렉터리를 남기지 말 것** — `migrate deploy`가 실패한다.
- 프로덕션은 `npm start`가 `prisma migrate deploy`를 먼저 실행한다.
