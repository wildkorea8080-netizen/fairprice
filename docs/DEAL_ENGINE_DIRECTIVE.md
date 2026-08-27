# Deal Engine Core 지시서

출처: Codex 세션에서 사용자가 직접 내린 아키텍처 지시(원문 요약·정리).
이 문서는 **에이전트가 임의로 변경할 수 없다.** 사용자가 명시적으로 바꿀 때만 갱신한다.

## 1. 목표

Fairprice를 첫 번째 실제 서비스로 사용해 Deal Engine을 검증한다.

```text
가격 수집 → 가격 History → 가격 분석 → Deal Score → Deal Detection → Deal Feed → Alert
```

Fairprice는 검색 사이트가 아니라 **"오늘 뭐 싸졌지?"**에 답하는 Deal Discovery 서비스다.

## 2. 아키텍처

```text
Deal Engine Core
│
├── Price Collection
├── Price History
├── Price Statistics
├── Deal Detection
├── Deal Score
├── Deal Ranking
├── Affiliate Link
├── Alert
├── Analytics
│
├── Shopping Adapter
│   └── Coupang
│
└── Travel Adapter        (지금 구현하지 않음, 확장 가능성만 유지)
    ├── Flight
    ├── Hotel
    ├── Package
    └── Activity
```

Core는 데이터 출처를 몰라도 동작해야 한다. Core 입력은 표준화된
`Entity` / `Offer` / `PriceSnapshot` / `Deal` 형태를 사용한다.

현재 코드상 위치:

- Core 도메인: `src/modules/deal-engine/domain/`
- 포트(인터페이스): `src/modules/deal-engine/ports/`
- 쿠팡 어댑터: `src/modules/providers/coupang/`

## 3. 가격 히스토리

가격은 반드시 이력 형태로 저장한다. DB 폭증을 막기 위해 계층을 분리한다.

- raw price history 와 daily aggregate 분리
- 가격 변경 시 저장 / 하루 대표값 저장

채택된 3계층 구조와 보존 정책은 [`deal-engine/price-history-policy.md`](deal-engine/price-history-policy.md) 참조.

## 4. Deal Score V1

- **LLM으로 만들지 않는다.** 규칙 + 통계 기반, 100점 만점.

| 항목 | 배점 |
| --- | ---: |
| 최근 평균가격 대비 할인율 | 35 |
| 최근 최저가격 근접도 | 25 |
| 가격 하락 속도 | 15 |
| 과거 가격 분포 내 위치 | 15 |
| 상품/데이터 신뢰도 | 10 |

| 점수 | 밴드 |
| --- | --- |
| 0–59 | 일반 |
| 60–79 | 괜찮은 가격 |
| 80–89 | 특가 |
| 90–95 | 초특가 |
| 96–100 | 역대급 |

가중치는 하드코딩하지 않는다. config/DB에서 수정 가능해야 하고 추후 A/B 실험이 가능해야 한다.
구현: `deal_score_configs` 테이블 + [`deal-engine/deal-score-v1.md`](deal-engine/deal-score-v1.md).

## 5. Deal Detection

탐지 대상 이벤트:

- 최근 평균 대비 일정 비율 이상 하락
- 30일 최저가 갱신
- 90일 최저가 갱신
- 역대 최저가 근접
- 단기간 급락
- 일정 Deal Score 이상 (예: `DEAL_SCORE >= 90` → Hot Deal 후보)

중복 Hot Deal 생성 방지 로직이 필요하다.
구현: [`deal-engine/deal-detection.md`](deal-engine/deal-detection.md).

## 6. 메인 화면 방향

단순 상품 검색이 아니라 Deal Discovery Feed 성격을 강화한다.

```text
🔥 오늘의 HOT DEAL
🚨 가격 급락
💯 역대급 가격
📉 30일 최저가
🆕 방금 발견된 특가
```

## 7. Affiliate

Affiliate는 Deal Engine과 **분리**한다. `AffiliateProvider` 인터페이스:
`generateLink()` / `normalizeUrl()` / `trackClick()` / `getSource()`.

현재는 Coupang Provider만 구현한다. 향후 Trip.com, Agoda, Klook,
Travelpayouts 등을 쉽게 추가할 수 있어야 한다.
클릭 기록은 공통 Analytics에 남기고, 쿠팡 도메인 검증과 딥링크 생성만
`CoupangAffiliateProvider`가 담당한다.

## 8. 장기 계획 — Noljapan

`noljapan.com`(브랜드 의미: "놀자판")을 향후 여행 Deal Discovery 서비스로 전환한다.
벤치마크: HolidayPirates, Jack's Flight Club, Secret Flying.
검색 중심이 아니라 Feed 중심.

**현재 단계에서 Noljapan UI는 개발하지 않는다.** Deal Engine Core가 여행 데이터도
받을 수 있는 확장 구조만 유지한다.

## 9. 중요 원칙

### 절대 하지 말 것

- 현재 프로젝트를 이유 없이 처음부터 재작성
- Travel 기능의 과도한 선구현
- 모든 기능을 한 서비스/테이블에 억지로 넣기
- Deal Score를 LLM 호출에 의존
- 점수 로직을 UI 코드에 삽입
- 쿠팡 전용 로직을 Core에 직접 삽입

### 반드시 지킬 것

- 기존 코드 재사용 우선
- Core와 Provider 분리
- 가격 히스토리 확보
- Deal Score 산출 근거 저장
- 향후 A/B 테스트 가능한 구조
- Affiliate 확장 가능
- 쇼핑과 여행의 공통 기능만 Core에 포함

## 10. 작업 방식

한 번에 전체를 재작성하지 않는다. 각 단계마다:

```text
분석 → 변경 계획 → 최소 변경 구현 → 테스트 → 다음 단계
```

기존 기능을 깨뜨릴 가능성이 있는 변경은 먼저 영향 범위를 확인한다.

### STEP 진행 상황

| STEP | 내용 | 상태 |
| --- | --- | --- |
| 1 | 현재 코드 분석 | 완료 |
| 2 | 문제점 및 유지/변경 항목 보고 | 완료 (`IMPLEMENTATION_AUDIT.md`) |
| 3 | Deal Engine Core 아키텍처 제안 | 완료 |
| 4 | DB Schema 변경안 제안 | 완료 |
| 5 | 기존 코드를 깨지 않는 Core 분리 | 완료 (`src/modules/`) |
| 6 | Price History 정비 | 완료 (3계층) |
| 7 | Deal Score V1 구현 | 완료 (config 기반) |
| 8 | Deal Detection / Hot Deal 자동 생성 | 완료 |
| 9 | Fairprice 메인에 Deal Feed 적용 | 완료 |
| 10 | 테스트 및 회귀 테스트 | 진행 중 |
