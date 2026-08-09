# 실시간 집계 설정 (Supabase)

관객 폰의 응답을 극장 스크린으로 실제로 흘려보내려면 이 설정이 필요하다.
**설정 전에는 무대에 «시뮬레이션 (Supabase 미설정)» 배지가 뜨고 가상 관객으로 동작한다.**

```
관객 폰 (/?p=1)  ──POST──▶  Supabase  ◀──1초 폴링──  극장 스크린 (/)
```

---

## 1단계 — Supabase 프로젝트 만들기 (직접 하셔야 합니다)

계정 생성은 대신 해드릴 수 없어 직접 진행해야 한다.

1. <https://supabase.com> 가입 (무료 플랜으로 충분)
2. **New project** → 이름·비밀번호·리전(**Northeast Asia (Seoul)** 권장) 입력 후 생성
3. 생성까지 1~2분 대기

---

## 2단계 — 테이블 만들기

좌측 메뉴 **SQL Editor** → **New query** 에 아래를 통째로 붙여넣고 **Run**.

```sql
-- 접속한 관객 (기기당 1행)
create table if not exists participants (
  device     text primary key,
  session    text not null default 'live',
  joined_at  timestamptz not null default now()
);

-- 관객이 제출한 응답
create table if not exists answers (
  id         bigserial primary key,
  device     text not null,
  session    text not null default 'live',
  qi         int,
  text       text,
  hit        boolean,
  created_at timestamptz not null default now()
);

create index if not exists answers_session_id_idx on answers (session, id);

-- 관객은 로그인하지 않으므로 익명(anon) 권한으로 읽고 쓴다.
alter table participants enable row level security;
alter table answers      enable row level security;

create policy "anon insert participants" on participants
  for insert to anon with check (true);
create policy "anon select participants" on participants
  for select to anon using (true);
create policy "anon update participants" on participants
  for update to anon using (true) with check (true);

create policy "anon insert answers" on answers
  for insert to anon with check (true);
create policy "anon select answers" on answers
  for select to anon using (true);
```

> `update` 정책은 관객이 새로고침했을 때 중복 집계되지 않도록
> `Prefer: resolution=merge-duplicates` 로 upsert 하기 위해 필요하다.

---

## 3단계 — 접속 정보를 코드에 넣기 (이미 완료됨)

이 저장소에는 아래 값이 이미 들어가 있다(`index.html` 상단).

```js
const SUPABASE_URL = "https://mxsxkktgsmaumeugripe.supabase.co";
const SUPABASE_KEY = "sb_publishable_...";
```

**Project Settings → API Keys** 에서 확인·교체할 수 있다.
새 프로젝트로 바꿀 때는 `Publishable key`(구 `anon` key)를 쓴다.

> **publishable key는 비밀이 아니다.** 브라우저에 노출되도록 설계된 공개용 키이며,
> 실제 권한은 2단계의 RLS 정책이 통제한다. 그래서 공개 저장소에 그대로 커밋한다.
> 반대로 `secret`(구 `service_role`) 키는 **절대** 넣으면 안 된다 — 그 키는
> 모든 보안 정책을 우회한다.

저장 후 배포하면 무대 하단 진행자 바에 **«집계 연결됨»** 이 초록색으로 뜬다.
2단계 SQL을 아직 실행하지 않았다면 **«집계 끊김 N회»** 가 빨간색으로 뜬다.

---

## 4단계 — 확인

1. 무대 화면 `/` 를 연다 → 진행자 바에 «집계 연결됨» 확인
2. 폰으로 QR을 찍는다 → 무대의 **접속** 숫자가 올라가는지 확인
3. 폰에서 문제를 푼다 → 무대의 **응답** 숫자와 게이지가 오르고 말풍선이 뜨는지 확인

---

## 공연 회차 분리

같은 배포본으로 여러 번 공연할 때, 이전 회차 데이터가 섞이지 않게 하려면
주소 뒤에 `?s=` 를 붙인다.

- 무대: `https://…/?s=0308밤`
- 관객: `https://…/?p=1&s=0308밤`

무대 화면의 QR은 **`s` 값을 자동으로 물려주지 않으므로**, 회차를 나눌 때는
관객용 QR을 별도로 만들거나 공연 전에 데이터를 비운다.

데이터 비우기 (SQL Editor):

```sql
delete from answers where session = 'live';
delete from participants where session = 'live';
```

---

## 진행자 조작 (무대 화면)

| 조작 | 동작 |
| --- | --- |
| 클릭 / Space | 작전 시작 → 순사 급습 → 작전 완료 → 리셋 (한 단계씩) |
| **1** | 의견 1건 — 게이지를 1%씩 올린다 (집계가 끊겼을 때 수동 진행) |
| **7** | 순사 급습 — 게이지를 70%로 떨어뜨리고 거기서 다시 상승 |
| **9** | 게이지를 90%로 고정 |
| **0** | 게이지 100% — 축포 + 1초 뒤 작전 완료 화면 (관객 폰도 같이) |
| **A** | 개입 해제 — 실집계 값으로 되돌림 |
| **H** | 진행자 바 숨기기 (프로젝션에 노출될 때) |

게이지는 평소 실집계를 따라 움직이며, 응답이 쌓일수록 상승폭이 줄어 90%에
수렴한다(관객이 30명이든 300명이든 거꾸로 가거나 멈추지 않는다).
연출상 필요한 순간에만 위 키로 직접 잡는다.

---

## 문제가 생기면

| 증상 | 원인·조치 |
| --- | --- |
| 진행자 바에 «집계 끊김 N회» | 네트워크 또는 키 오류. 브라우저 콘솔에서 실패 사유 확인 |
| 접속 수가 안 오름 | `participants` insert 정책 누락. 2단계 SQL 재실행 |
| 응답이 무대에 안 뜸 | `answers` select 정책 누락, 또는 `s`(회차) 값이 폰과 무대가 다름 |
| 관객 폰에서 아무 반응 없음 | 폰 콘솔에 «응답 전송 실패» 확인. 전송 실패해도 퀴즈 진행은 막지 않는다 |

> 폴링은 1초마다 **새 응답만 증분 조회**하고 총계를 다시 읽으므로,
> 일시적으로 실패해도 다음 폴링에서 스스로 복구된다.
