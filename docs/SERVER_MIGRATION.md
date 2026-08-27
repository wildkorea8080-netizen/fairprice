# 서버 이전 절차서 (VPS → 새 VPS, Coolify 유지)

대상: `https://fairprice.kr`
방식: 새 VPS에 Coolify를 설치하고 현재와 동일한 구성으로 이전. 데이터 전량 이관.
코드 변경: **없음.** 저장소는 그대로 두고 인프라만 옮긴다.

## 이번 이전 작업 정보

| 항목 | 값 |
| --- | --- |
| 구서버 (현재 운영) | `49.247.170.26` |
| 신서버 (이전 대상) | `115.68.222.86` |
| 신서버 상태 | 2026-08-26 기준 SSH(22)만 개방. Coolify 미설치 |
| 도메인 | `fairprice.kr` (변경 없음) |
| 구서버 Coolify | v3.12.36, `http://49.247.170.26:3000` (인터넷 노출됨) |
| 구서버 프록시 | `coolify-proxy` = `traefik:v2.8` |
| 구서버 DB | `fairprice-postgres` = **`postgres:16-alpine`** (Coolify 관리 아님, 독립 컨테이너) |
| 구서버 DB 외부 노출 | 없음 (5432 차단 확인) |
| 운영 중인 앱 커밋 | **`cbc52a5`** — `main`보다 4커밋 뒤처짐 |

### 구서버 컨테이너 목록 (2026-08-26)

```text
cmsrq8qbb0012nz9j23dh4po7   cmsrq8qbb0012nz9j23dh4po7:cbc52a5     Up 2 days
fairprice-postgres          postgres:16-alpine                    Up 12 days
coolify-proxy               traefik:v2.8                          Up 12 days
coolify                     ghcr.io/coollabsio/coolify:3.12.36    Up 12 days
coolify-fluentbit           ghcr.io/coollabsio/fluent-bit:1.0.0   Up 12 days
```

DB는 Coolify 리소스가 아니라 저장소 `compose.yaml`과 같은 방식의 독립 컨테이너다.
그래서 구서버 Coolify UI의 리소스 목록에 나타나지 않는다.

### 미배포 커밋 (이전 전 반드시 인지할 것)

운영 이미지 태그가 `cbc52a5`다. `main`에는 아래 4개가 더 있으나 **실서버에 반영된 적이 없다.**

```text
f32871e feat: show deal confidence progress
5c8c64d feat: prioritize unverified collection jobs
7f1fdf1 fix: prevent mobile chart label overlap
5b05852 feat: gate product pages for search indexing
```

신서버를 `main`으로 바로 배포하면 **서버 이전과 4커밋 배포가 동시에 일어난다.**
문제 발생 시 원인 구분이 불가능해진다. 신서버 첫 배포는 Coolify의 `Git commit` 필드에
`cbc52a5`를 고정해 구서버와 동일한 코드로 띄우고, 검증이 끝난 뒤 최신으로 올린다.

### 이전 전 기준값 (2026-08-26 05:46 UTC, `/api/health`)

복원 후 이 값과 비교한다. 크게 줄었다면 복원이 불완전한 것이다.

```json
"dealEngine": { "analyzedProducts": 1020, "dealEvents": 1075,
                "collecting": 1020, "reliable": 0, "activeDeals": 0 }
"automation": { "status": "SUCCESS", "fresh": true }
"checks": 전 항목 true
```

`reliable: 0`은 정상이다. 아직 관측 표본이 부족해 전 상품이 `COLLECTING` 단계다.
바로 이 때문에 **가격 이력을 반드시 그대로 가져가야 한다.** 날리면 신뢰도가 0에서 다시 시작한다.

### 구서버 DB 행 수 기준값 (2026-08-26, 덤프 직전)

복원 후 신서버에서 같은 쿼리를 돌려 **정확히 일치**해야 한다.

| products | histories | observations | users | migrations |
| ---: | ---: | ---: | ---: | ---: |
| 1022 | 3162 | 5457 | 3 | 13 |

측정 쿼리:

```sql
select (select count(*) from products) products,
       (select count(*) from product_price_histories) histories,
       (select count(*) from price_observations) observations,
       (select count(*) from users) users,
       (select count(*) from _prisma_migrations) migrations;
```

`migrations = 13`이 핵심이다. 이 값이 복원되어야 앱 기동 시 `prisma migrate deploy`가
"이미 적용됨"으로 통과한다.

### 구서버 cron 실제 등록 내용 (2026-08-26)

`DEPLOYMENT.md`가 권장하는 3줄 구성이 아니라, **호스트 crontab에 1줄**만 있다.

```cron
*/30 * * * * docker exec cmsrq8qbb0012nz9j23dh4po7 npm run cron:pipeline >> /var/log/fairprice-cron.log 2>&1
```

주의할 점 두 가지:

1. **컨테이너 이름이 하드코딩되어 있다.** `cmsrq8qbb0012nz9j23dh4po7`은 Coolify가 부여한
   애플리케이션 UUID다. 신서버에서는 다른 값이 되므로 cron 줄을 그대로 복사하면 동작하지 않는다.
2. **컨테이너 안에서 공개 도메인을 호출한다.** `scripts/run-cron-pipeline.mjs`는
   `baseUrl`을 `NEXT_PUBLIC_APP_URL`(= `https://fairprice.kr`)에서 읽는다.
   즉 cron은 localhost가 아니라 **DNS가 가리키는 서버**를 때린다.

2번 때문에 순서 제약이 생긴다:

- **DNS 전환 전에 신서버 cron을 켜면 안 된다.** `fairprice.kr`이 아직 구서버를 가리키므로
  신서버 cron이 구서버를 수집시키고, 그 데이터는 이전 대상에서 누락된다.
- 신서버 cron은 **DNS 전환이 끝난 뒤에만** 등록한다.

### 신서버 구성 (2026-08-26 구축 완료분)

| 항목 | 값 |
| --- | --- |
| Coolify | v4.3.11, `http://115.68.222.86:8000` |
| 프록시 | `coolify-proxy` = `traefik:v3.6` (구서버는 v2.8) |
| 개방 포트 | 22 / 80 / 443 / 8000 |
| DB 컨테이너 | **`hgigvvupjaaywxlqjsvnltzp`** = `postgres:16-alpine` |
| DB 이름 / 사용자 | `fairprice` / `fairprice` |
| DB 외부 노출 | 없음 (Public access = Private) |

> `coolify-db`(`postgres:15-alpine`)는 Coolify 자체 내부 DB다. **절대 건드리지 말 것.**

**DB 복원 완료 (2026-08-26).** 구서버와 행 수 완전 일치:

```text
 products | histories | observations | users | migrations
     1022 |      3162 |         5457 |     3 |         13
```

### 덤프/복원 명령 (실제 사용한 것)

`docker exec`에 **`-t`를 붙이면 안 된다.** TTY가 개행을 변환해 바이너리 덤프가 깨진다.

```bash
# 구서버
docker exec fairprice-postgres pg_dump --format=custom --no-owner --no-acl   -U fairprice fairprice > ~/fairprice.dump
scp ~/fairprice.dump root@115.68.222.86:/root/

# 신서버
docker cp /root/fairprice.dump hgigvvupjaaywxlqjsvnltzp:/tmp/restore.dump
docker exec hgigvvupjaaywxlqjsvnltzp pg_restore --no-owner --no-acl   -U fairprice -d fairprice /tmp/restore.dump
docker exec hgigvvupjaaywxlqjsvnltzp rm /tmp/restore.dump
```

### 신서버 앱 생성 시 주의

- Coolify v4에는 v3의 `Nextjs` 빌드팩이 없다. **Nixpacks**를 쓰고 Install/Build/Start를 직접 지정한다.
- `package.json`에 `engines` 필드가 없어 Nixpacks가 기본 Node를 고른다.
  구서버 빌드 이미지가 `node:lts`였으므로 환경변수 `NIXPACKS_NODE_VERSION=22`로 맞춘다.
- `prisma/schema.prisma`의 datasource에는 `directUrl`이 없다.
  **`DATABASE_URL` 하나만 있으면 된다.** `.env.example`의 `DIRECT_URL`은 사용되지 않는 잔재다.

### ★ Nixpacks Node 버전 함정 (2026-08-26 실제로 겪음)

Coolify v4의 Nixpacks 기본 nixpkgs 스냅샷(`ffeebf0acf...`, 2025-04)에는
**Prisma 7.8.0이 요구하는 Node가 하나도 없다.**

| `NIXPACKS_NODE_VERSION` | 실제 설치 버전 | Prisma 7 요구 `^20.19 \|\| ^22.12 \|\| >=24.0` |
| --- | --- | --- |
| 20 | 20.18.1 | ❌ |
| 22 | 22.11.0 | ❌ |
| 23 | 23.2.0 | ❌ |
| 24 | 패키지 없음 | — |

`npm ci`가 이 오류로 죽는다:

```text
Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+.
current: { node: 'v22.11.0' }
```

구서버(Coolify v3)는 Nixpacks가 아니라 `node:lts` 도커 이미지로 빌드했기 때문에
이 문제가 없었다.

**해결:** 환경변수로 nixpkgs 스냅샷을 최신으로 바꾼다. 코드 변경 불필요.

```text
NIXPACKS_NIXPKGS_ARCHIVE=ac62194c3917d5f474c1a844b6fd6da2db95077d
NIXPACKS_NODE_VERSION=22
```

이 조합이면 Node **22.20.0**이 설치된다(`nixos-25.05` 기준).
Node 24(24.11.1)도 가능하지만, 구서버가 `node:lts`(22.x)였으므로 22를 유지하는 편이
운영 환경과 가깝다.

**대비책:** 위 방법이 안 먹히면 `node:22-slim` 기반 Dockerfile을 추가하고
Build Pack을 `Dockerfile`로 바꾼다. 앱 코드는 건드리지 않으므로 동일 코드 배포 원칙은 유지된다.

**실제 결과:** `NIXPACKS_NIXPKGS_ARCHIVE`는 Coolify가 `--env`로 넘겨도 **무시된다**
(빌드 로그의 `COPY .nixpacks/nixpkgs-ffeebf0acf....nix`가 그대로였다).
따라서 대비책인 Dockerfile 방식이 유일한 해결책이었다.

### 채택된 빌드 방식 (Dockerfile)

저장소 루트에 `Dockerfile`과 `.dockerignore`를 추가했다.
배포 브랜치 `deploy/dockerfile-cbc52a5` = `cbc52a5` + Dockerfile 커밋 `525724f`.

Coolify 설정:

| 항목 | 값 |
| --- | --- |
| Branch | `deploy/dockerfile-cbc52a5` |
| Commit SHA | `525724f8fb7ea4a3ac7858fec0dde4350c65cb4a` |
| Build strategy | `Dockerfile` |
| Dockerfile location | `/Dockerfile` |
| Install/Build/Start command | Dockerfile 전략에서는 칸 자체가 사라진다 |

**빌드 성공 (2026-08-26, 3분 36초).** Node 22.23.2로 `npm ci` 통과.

### 신서버 검증 결과 (DNS 전환 전, sslip.io 경유)

`/api/health`가 구서버와 동일한 값을 반환했다.

```text
status ok / database true / productionServices true
analyzedProducts 1022 / dealEvents 1111 / mode production
```

페이지 응답: `/` `/deals` `/categories` `/login` `/robots.txt` `/sitemap.xml`
`/feed.xml` `/ads.txt` 모두 200, `/alerts` `/admin`은 307(로그인 리다이렉트).
홈 HTML 137KB, 사이트맵 URL 1,164개, 상품 이미지 URL도 구서버와 동일.

`automationFresh`만 `false`인데 cron을 꺼둔 상태라 정상이다.

### DNS 전환 (2026-08-26 완료)

`fairprice.kr`, `www` A 레코드를 `115.68.222.86`으로 변경.

**함정: 도메인을 추가한 뒤 반드시 재배포해야 한다.** Coolify는 Traefik 라벨을
컨테이너 생성 시점에 심기 때문에, 도메인만 추가하면 라우터가 생기지 않는다.
증상은 다음과 같았다.

```text
sslip.io        200   (컨테이너는 정상)
fairprice.kr:80 404   (Traefik에 라우터 없음)
fairprice.kr:443 503  + issuer=TRAEFIK DEFAULT CERT
```

`Actions → Deploy`로 재배포하면 이미지가 재사용되어 10초 만에 끝나고,
새 컨테이너에 라벨이 붙으면서 Let's Encrypt 발급도 자동으로 진행된다.

**또 하나의 함정:** 테스트용 sslip.io 도메인에 걸어둔 `Noindex`가 실도메인에
따라붙으면 `X-Robots-Tag: noindex`로 사이트 전체가 색인에서 빠진다.
`fairprice.kr`과 `www.fairprice.kr`은 반드시 `Indexable`로 둘 것.

**전환 후 검증 결과:**

```text
https://fairprice.kr            200
issuer=C=US, O=Let's Encrypt, CN=YR2  subject=CN=fairprice.kr
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Robots-Tag                    없음 (정상)
health                          ok / production / 1022 / 1111
```

**검증 시 주의:** 전환 직후에는 작업자 PC의 DNS 캐시가 구서버를 가리킬 수 있다.
`curl`에 `-w '%{remote_ip}'`를 붙여 **어느 서버에 붙었는지 반드시 확인**할 것.
확실히 신서버를 때리려면:

```bash
curl -sSI --resolve fairprice.kr:443:115.68.222.86 https://fairprice.kr/
```

### main 전환 및 미배포 4커밋 반영 (2026-08-27)

`525724f`(Dockerfile 커밋)를 `main`에 cherry-pick 해 `75b9a0b`을 만들고 푸시했다.
Coolify의 Branch를 `main`, Commit SHA를 `HEAD`로 바꿔 배포(2분 47초, 성공).

이 배포로 그동안 밀려 있던 4커밋이 함께 반영됐다. 스키마 변경은 없다.

**적용 확인:** `sitemap.xml`의 URL 수가 **1164 → 803**으로 줄었다.
`5b05852`(상품 색인 조건 강화)가 동작한 결과이며, 기준 미달 상품이 제외된 것이다.

> ⚠️ 색인 조건에 "최근 72시간 이내 가격 확인"이 있다.
> cron이 72시간 이상 멈추면 **모든 상품이 사이트맵에서 빠진다.**
> 이전 작업으로 수집을 멈춰둔 상태라면 72시간 안에 반드시 재개할 것.

### 신서버 cron은 Coolify Scheduled Tasks로 등록한다

구서버는 호스트 crontab에 컨테이너 이름을 하드코딩했다(`docker exec cmsrq8...`).
Coolify v4는 배포마다 컨테이너를 새로 만들기 때문에 이 방식은 배포 후 조용히 죽는다.

`Automation → Scheduled Tasks`에 등록한다.

| 항목 | 값 |
| --- | --- |
| Name | `cron-pipeline` |
| Command | `npm run cron:pipeline` |
| Frequency | `*/30 * * * *` |

재개 전에 밀린 알림을 먼저 확인한다(앱 Terminal):

```bash
node scripts/run-cron-pipeline.mjs --steps=alerts,send --sendDryRun=true
```

### 구서버 Coolify 애플리케이션 설정 (신서버에 동일하게 재현)

구서버 Coolify는 `http://49.247.170.26:3000` (Coolify v3.12.36).
아래 값은 2026-08-26에 구서버 Configuration 화면에서 그대로 옮겨 적은 것이다.

| 항목 | 값 |
| --- | --- |
| Name | `fairprice` |
| Git Source | Github Public |
| Git Repository | `wildkorea8080-netizen/fairprice/main` |
| Build Pack | **Nextjs** |
| Destination | Local Docker |
| URL (FQDN) | `https://fairprice.kr` |
| Generate SSL for www and non-www | 켜짐 |
| Enable HTTP/2 | 꺼짐 |
| Basic Auth | 꺼짐 |
| Build Image | `node:lts` |
| Deployment Image | `node:lts` |
| Deployment Type | `node` |
| Port | `3000` |
| Exposed Port | 비움 |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Start Command | `npm run start` |
| Base Directory | 기본값 `/` |
| Publish Directory | 기본값 `/` |

`npm run start`는 `package.json`에서 `npm run db:deploy && next start`로 정의되어 있다.
즉 **기동 시 `prisma migrate deploy`가 먼저 돈다.** 덤프 복원을 앱 배포보다 먼저 해야 하는 이유가 이것이다.

`npm ci`를 쓰므로 `package-lock.json`이 저장소에 정확히 반영되어 있어야 한다.
(과거 `Pin emnapi packages for npm ci` 커밋이 이 문제로 들어갔다.)

---

## 0. 먼저 알아야 할 위험 3가지

| 위험 | 결과 | 대응 |
| --- | --- | --- |
| 구·신 서버 cron이 동시에 돈다 | **회원에게 알림 이메일이 두 번 발송된다.** 수집 잡도 중복 실행된다 | 컷오버 전에 구서버 cron을 먼저 정지 (2단계) |
| `FAIRPRICE_AUTH_SECRET`을 새로 만든다 | 세션 쿠키가 HMAC 서명이라 **전 회원이 로그아웃**된다 | 기존 값을 그대로 복사 (`src/lib/auth.ts` 참조) |
| DNS TTL이 길다 | 전환이 몇 시간씩 늘어지고 그동안 트래픽이 양쪽으로 갈린다 | 이전 최소 24시간 전에 TTL을 300초로 낮춘다 |

---

## 1. 사전 준비 (구서버, 이전 1~2일 전)

### 1-1. DNS TTL 낮추기

도메인 관리 콘솔에서 `fairprice.kr`과 `www`의 A 레코드 TTL을 **300초**로 변경한다.
최소 기존 TTL만큼 기다려야 효과가 생기므로 가장 먼저 한다.

### 1-2. 환경변수 원본 확보

Coolify 관리 화면 → Fairprice 애플리케이션 → Environment Variables에서 **전체 값을 그대로** 받아 둔다.
`.env.production.example`의 키가 전부 있어야 한다. 아래 값은 **반드시 동일하게 유지**한다.

```text
FAIRPRICE_AUTH_SECRET     바꾸면 전 회원 로그아웃
CRON_SECRET               바꾸면 스케줄러 등록을 전부 다시 해야 함
COUPANG_PARTNERS_*        재발급 시 수집 중단
RESEND_API_KEY, EMAIL_FROM
GOOGLE_ADSENSE_PUBLISHER_ID
NAVER_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION
```

`NEXT_PUBLIC_APP_URL`은 `https://fairprice.kr` 그대로 둔다(도메인이 안 바뀌므로).
`DATABASE_URL`만 새 서버 값으로 교체된다.

> 이 값들은 비밀이다. 저장소나 채팅에 붙여넣지 말고 비밀번호 관리자에 보관한다.

### 1-3. 새 VPS 준비

- Ubuntu 22.04/24.04 LTS, **최소 4GB RAM** 권장.
  `next.config.ts`가 `experimental.cpus: 1`로 빌드 메모리를 아끼고 있지만
  빌드는 `--max-old-space-size=4096`으로 돈다. 2GB면 빌드가 OOM으로 죽는다.
- 디스크는 현재 DB 크기의 3배 이상(덤프 + 복원 + 여유).
- Coolify 설치:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

- 방화벽에서 22, 80, 443, 8000(Coolify UI) 개방.

---

## 2. 구서버 정지 (컷오버 시작)

**여기서부터 서비스는 읽기 전용 상태로 둔다.** 수집이 멈춰도 사용자 피해는 없다.

1. Coolify 스케줄 작업(또는 호스트 `crontab -e`)에서 `run-pipeline` 관련 항목을 **전부 주석 처리**한다.
2. 진행 중인 파이프라인이 끝나기를 기다린다. `/admin/jobs`와 `/admin/schedule`에서
   실행 중인 잡이 없는지 확인한다. 최대 15분(`STALE_RUN_TIMEOUT_MS`)이면 정리된다.
3. `https://fairprice.kr/api/health`가 정상인지 확인한다.

---

## 3. 데이터 덤프 (구서버)

앱 컨테이너 안에서 저장소의 백업 스크립트를 쓰거나, Postgres 컨테이너에서 직접 뜬다.

```bash
# 앱 컨테이너 안에서 (.env.production의 DATABASE_URL 사용)
npm run db:backup
# -> backups/fairprice-<타임스탬프>.dump
```

또는 Postgres 컨테이너에서 직접:

```bash
docker exec -t <postgres-container> \
  pg_dump --format=custom --no-owner --no-acl -U fairprice fairprice \
  > fairprice-$(date +%Y%m%d-%H%M).dump
```

`--no-owner --no-acl`은 새 서버의 DB 사용자명이 달라도 복원되게 한다.

덤프를 로컬 또는 새 서버로 옮기고 **크기가 0이 아닌지 반드시 확인**한다.

```bash
scp <구서버>:~/fairprice-*.dump ./
ls -lh fairprice-*.dump
```

> 이 덤프에는 회원 이메일과 비밀번호 해시가 들어 있다. 전송 후 임시 사본은 삭제한다.

---

## 4. 새 서버 구성

### 4-1. PostgreSQL 서비스 생성

Coolify에서 **PostgreSQL 16** 리소스를 새로 만든다.
로컬 `compose.yaml`과 같은 이미지 계열(`postgres:16`)을 쓴다.
생성 후 Coolify가 알려주는 **내부 연결 문자열**을 받아 둔다. 형태:

```text
postgresql://<user>:<password>@<coolify-내부-호스트>:5432/<db>
```

DB 포트를 외부에 노출하지 않는다. 앱과 DB는 Coolify 내부 네트워크로 통신한다.

### 4-2. 덤프 복원

**앱을 배포하기 전에** 복원한다. 순서가 중요하다.

```bash
# 덤프를 postgres 컨테이너로 복사
docker cp fairprice-<타임스탬프>.dump <postgres-container>:/tmp/restore.dump

# 복원
docker exec -t <postgres-container> \
  pg_restore --no-owner --no-acl -U <user> -d <db> /tmp/restore.dump

# 임시 파일 삭제
docker exec -t <postgres-container> rm /tmp/restore.dump
```

저장소 스크립트를 쓸 경우 안전장치가 있어 확인 인자가 필요하다:

```bash
npm run db:restore -- --file=./backups/fairprice-<타임스탬프>.dump --confirm=RESTORE
```

**복원 검증** — 아래가 모두 0보다 커야 한다:

```bash
docker exec -t <postgres-container> psql -U <user> -d <db> -c \
  "select
     (select count(*) from products) as products,
     (select count(*) from product_price_histories) as histories,
     (select count(*) from price_observations) as observations,
     (select count(*) from users) as users,
     (select count(*) from _prisma_migrations) as migrations;"
```

`_prisma_migrations`가 13행이면 정상이다(현재 마이그레이션 개수).
이 테이블이 함께 복원되기 때문에 앱 기동 시 `prisma migrate deploy`가
"이미 적용됨"으로 통과하고 데이터를 건드리지 않는다. **이것이 복원을 먼저 하는 이유다.**

### 4-3. 애플리케이션 배포

1. Coolify에서 새 애플리케이션 → GitHub 저장소
   `wildkorea8080-netizen/fairprice`, 브랜치 `main` 연결.
2. 빌드/실행 명령은 저장소 기본값을 쓴다.

```text
Build:  npm ci && npm run build
Start:  npm start
Port:   3000
```

`npm start`가 `prisma migrate deploy`를 먼저 실행한 뒤 `next start`를 띄운다.

3. 1-2에서 받아 둔 환경변수를 **전부** 등록하고, `DATABASE_URL`만 4-1의 내부 연결 문자열로 교체한다.
4. 배포 실행. 빌드 로그에서 `prisma generate`와 `next build`가 끝까지 가는지 본다.

### 4-4. 도메인 연결 전 검증

DNS를 아직 돌리지 않은 상태에서, Coolify가 임시로 주는 URL 또는 hosts 파일로 확인한다.

```bash
# 로컬에서 새 서버 IP를 직접 지정해 검증
npm run verify:deploy -- --skipBuild=true --baseUrl=http://<새서버IP>:3000
```

`/api/health`의 `checks.productionServices`가 통과하는지, `database` 항목이
정상인지 확인한다. 상품 수와 가격 이력이 구서버와 같은지 `/admin`에서도 본다.

---

## 5. DNS 전환

1. `fairprice.kr`과 `www`의 A 레코드를 새 서버 IP로 변경한다.
2. Coolify에서 도메인을 `https://fairprice.kr`로 설정하고 **Let's Encrypt 인증서를 발급**한다.
   DNS가 새 서버를 가리켜야 발급된다.
3. 전파 확인:

```bash
nslookup fairprice.kr
curl -I https://fairprice.kr
```

`Strict-Transport-Security` 헤더가 있어야 한다(`FAIRPRICE_DEPLOYMENT_MODE=production`일 때만 붙는다).

---

## 6. cron 재등록 (새 서버)

Coolify 스케줄 작업 또는 호스트 crontab에 등록한다. `CRON_SECRET`을 유지했다면 명령은 구서버와 동일하다.

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://fairprice.kr/api/cron/run-pipeline?batchSize=5&clickKeywordLimit=10&sendDryRun=false"
*/10 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://fairprice.kr/api/cron/run-pipeline?steps=alerts,send"
0 */6 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://fairprice.kr/api/cron/run-pipeline?steps=discover,click-keywords&clickKeywordLimit=10"
```

**첫 실행은 `sendDryRun=true`로 한 번 돌려 본다.** 이전 중 알림이 밀려 있다가
한꺼번에 나가는지 `/admin/notifications`에서 먼저 확인하고, 이상 없으면 실발송으로 바꾼다.

---

## 7. 최종 검증

```bash
npm run verify:deploy -- --baseUrl=https://fairprice.kr --requireHsts=true
```

수동 확인 항목:

- [ ] `/` 딜 피드에 상품이 보이고, 가격 이력 그래프가 이전 데이터를 그린다
- [ ] `/products/<실제상품>` 상세에서 평균가·최저가·Deal Score가 이전과 동일
- [ ] 기존 회원 계정으로 로그인된다 (`FAIRPRICE_AUTH_SECRET` 유지 확인)
- [ ] `/admin` 로그인 및 12개 화면 정상
- [ ] `/out/<slug>` 제휴 리다이렉트가 쿠팡으로 정상 이동하고 클릭이 기록된다
- [ ] `/api/health`의 `automationFresh`, `priceTrackingFresh`가 cron 첫 실행 후 정상으로 바뀐다
- [ ] `/ads.txt`에 AdSense 게시자 ID가 나온다
- [ ] `/sitemap.xml`, `/robots.txt`, `/feed.xml` 정상
- [ ] `/admin/notifications`에서 테스트 이메일 발송 성공

---

## 8. 외부 서비스 점검

도메인이 그대로이므로 대부분 재설정이 필요 없다. 다만 확인한다.

| 서비스 | 확인 사항 |
| --- | --- |
| Resend | 도메인 인증은 DNS(SPF/DKIM) 기반이라 유지된다. **SPF에 구서버 IP를 직접 넣었다면** 새 IP로 교체 |
| 쿠팡 파트너스 | 파트너스 콘솔에 IP 제한을 걸어 뒀는지 확인. 걸었다면 새 서버 IP 추가 |
| Google Search Console / 네이버 서치어드바이저 | 도메인 소유 확인은 유지. 전환 후 사이트맵 재제출 권장 |
| Google AdSense | `ads.txt`가 새 서버에서도 응답하는지만 확인 |

---

## 9. 롤백

DNS를 되돌리면 된다. 구서버는 **최소 7일간 그대로 살려 둔다.**

1. A 레코드를 구서버 IP로 복구 (TTL 300초라 5분 내 복구).
2. 구서버 cron 주석을 해제.
3. 단, 새 서버에서 운영된 동안 쌓인 데이터(신규 회원, 수집 이력)는 유실된다.
   전환 후 오래 지났다면 새 서버에서 덤프를 떠 구서버로 복원해야 한다.

---

## 10. 구서버 정리 (전환 1~2주 후)

새 서버가 안정적으로 돌고 데이터가 정상 축적되는 것을 확인한 뒤에만 진행한다.

1. 구서버에서 최종 덤프를 떠 안전한 곳에 장기 보관한다.
2. Coolify 애플리케이션과 Postgres 리소스를 정지 → 삭제.
3. 남은 덤프 파일과 `.env.production` 사본을 삭제한다.
4. DNS TTL을 다시 3600초 이상으로 올린다.
5. 새 서버에 정기 백업을 등록한다 (`npm run db:backup`을 매일 cron으로).
