# 놀자판(여행) 착수 계획 · Deal Engine 구조 감사

작성일: 2026-08-31 · 기준: `main @ 67763d7` · 방법: 코드·스키마 직접 검증

읽기 좋은 판본: <https://claude.ai/code/artifact/dd41b8de-1a0a-4332-a7fd-8903e221415b>

`DEAL_ENGINE_DIRECTIVE.md`의 "여행 어댑터는 지금 구현하지 않는다" 원칙은 유효하다.
이 문서는 구현이 아니라 **언제·무엇을 만들지에 대한 결정**을 기록한다.

---

## 1. 감사 결과

지시서의 절대 원칙 6개와 STEP 1–10은 모두 달성됐다. 확인한 증거:

| 확인 항목 | 결과 |
| --- | --- |
| Core에 쿠팡 문자열 | **0건** (`src/modules/deal-engine/` 전수) |
| `src/modules/`의 `prisma.product` 참조 | **0건** |
| 포트 정의 | `ports/source-provider.ts`, `ports/affiliate-provider.ts` |
| 포트 구현 | `CoupangSourceProvider implements SourceProvider` 등 2종 |
| 점수 설정 | `DealScoreConfig`에 `vertical`·`experimentKey`·`weights`/`thresholds`(Json) |
| 엔티티 확장성 | `DealEntity @@unique([entityType, canonicalKey])`, `metadata Json?` |
| 오퍼 확장성 | `Offer @@unique([source, externalKey])`, `metadata Json?` |

### 결함 하나: 포트를 통과하는 트래픽이 0이다

`collectSourceOffers()`는 어디에서도 호출되지 않는다. 라이브 수집은
`collection-jobs.ts` → `lib/coupang/tracker.ts`(711줄, 12개 테이블에 기록)를 직접 탄다.

둘은 중복이 아니라 층이 다르다. 프로바이더는 **취득·매핑**만 하고,
**범용 저장**은 쿠팡 트래커 안에 쇼핑 전용 기록과 섞여 있다.
따라서 포트는 "구현 가능"만 타입으로 증명됐고 "충분함"은 미증명이다.

→ 놀자판에 가장 필요한 부품(범용 persister)이 정확히 이 빠진 조각이다.

---

## 2. 설계 핵심 — 통계 단위가 다르다

| | Fairprice | 놀자판 |
| --- | --- | --- |
| 엔티티 | 상품 1개 | **노선 1개** (`ICN-KIX`) |
| 관측 축 | 시간축 | **출발일축** |
| 질문 | "이 상품이 예전보다 싼가" | "이 노선이 평소보다 싼가" |
| 분포 확보 | 30일 × 20샘플 필요 | **1회 호출로 즉시** (month-matrix) |
| 규모 | 1,296개 | ~50개 |

`detectAndPersistOfferDeals`는 `history`를 **질의하지 않고 파라미터로 받는다.**
비교 기준을 어댑터가 정하므로 판정 엔진은 손대지 않는다.
그 결과 **놀자판은 첫날부터 RELIABLE 판정이 가능하다** — Fairprice의 최대 고통이 없다.

노선×출발일×귀국일 조합을 추적하지 않는다. 엔티티는 노선, 관측은 그 노선의 가격 분포다.

### 새로 만들 것은 셋뿐

1. **범용 저장 계층** — `SourceCollectionResult` → DealEntity/Offer/PriceObservation
2. **여행용 신뢰도 정책** — "20샘플·30일"이 아니라 분포 커버리지 기준
3. **Travel Source Provider + 피드 UI**

그 외(점수식, 탐지 이벤트 6종, 2단계 활성화, 스키마, 알림 3종, 파이프라인,
백업·모니터링·CI, 쿠팡 어필리에이트)는 전부 재사용한다. **스키마 마이그레이션 불요.**

---

## 3. 데이터 소스

**Amadeus Self-Service는 2026-07-17 종료됐다.** 신규 가입 불가, 기존 키 무효,
Enterprise는 IATA/ARC 인증 요구. 배제한다.

**Travelpayouts(Aviasales Data API)를 채택한다.**

- 호출당 과금이 아니라 커미션으로 수익화 — 초기 비용 ~0
- `/v2/prices/month-matrix`, `/v1/prices/cheap`이 정확히 노선 가격 분포를 준다
- 데이터 API와 제휴 프로그램이 한 계정

캐시된 검색 기반 가격이라 실시간 발권가가 아니다. **Fairprice의 "관측가" 표현 규칙을
그대로 적용한다** — 이미 푼 문제다.

### 수익 구조 (2026-08-31 조사 기준, 가입 시 재확인 필요)

| 수익원 | 요율 | 역할 |
| --- | ---: | --- |
| 항공권 | 낮음/없음 | 리드 제너레이터 |
| Klook eSIM | 20% | 결정 직후 전환 최고 |
| Agoda 숙소 | 최대 9.6% (쿠키 30일) | 핵심 |
| Klook 투어·호텔 | 6.5% | 핵심 |
| Klook 어트랙션·교통 | 5% | 보조 |
| 쿠팡파트너스 여행용품 | ~3% | **이미 연동됨** |

---

## 4. 착수 순서와 게이트

**지금 놀자판을 시작하지 않는다.** Fairprice의 핵심 루프(딜→노출→클릭→수수료)가
아직 한 번도 완주하지 않았다(활성 딜 2, RELIABLE 0, 정산 0원). 검증 안 된 패턴의 복제가 된다.

1. **(~9월 말) 라이브 수집을 포트로 통과시킨다.** 쿠팡 트래커에서 범용 저장 계층을 분리해
   `SourceProvider → collectSourceOffers → persister` 경로를 실제 트래픽으로 검증한다.
   놀자판용 부품을 Fairprice에서 값을 치르고 확보하는 작업이다.
2. **(~9월 말) 데이터 숙성 대기.** 손댈 것 없음. 9월 말 첫 RELIABLE 예상.
3. **(10월, 반나절) Travelpayouts 실측 1회.** 스크립트로 `ICN→KIX` month-matrix를 실제로
   받아 한국 출발 커버리지·KRW·가격 품질을 확인한다. 서비스 코드는 쓰지 않는다.
4. **(게이트 통과 후) 놀자판 착수.** 노선 50개로 시작.

> **착수 게이트: 쿠팡 파트너스 첫 수수료 정산.**
> 그 전까지는 3번까지만 진행한다.
