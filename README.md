# 서울온라인학교 · 사이버폭력 예방 사이트

비난은 지우고, 배려는 남기고. — 학생 포스터 제출/투표가 가능한 캠페인 사이트.

## 구성
```
index.html        # 전체 페이지
css/style.css     # 글래스모피즘 스타일 (브랜드 #592280 / #4fada7)
js/config.js      # ⚙️ 설정값(여기만 채우면 됨)
js/app.js         # Supabase 연동 로직
```

## 실행
정적 사이트입니다. `index.html`을 브라우저로 열거나, 간단히:
```
python -m http.server 5500
```
후 http://localhost:5500 접속.

---

## 1. Supabase 설정

`js/config.js`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 채웁니다.
(Supabase 대시보드 → Project Settings → API)

### 테이블 SQL
> ⚠️ 주신 단일 테이블만으로는 **"작품당 좋아요 1회"**를 보장할 수 없어, 누가 무엇에 좋아요했는지 기록하는 `votes` 테이블을 추가합니다.

```sql
-- 학생 = 작품 (주신 스키마 기반, id/created_at/제약 추가)
create table if not exists students (
  id            bigint generated always as identity primary key,
  stu_id        text,          -- 학생 이름
  stu_school    text not null,
  stu_grade     int  not null,
  stu_class     int  not null,
  stu_num       int  not null,
  submit_img_link text,
  submit_exp    text,
  like_num      int  default 0,
  created_at    timestamptz default now(),
  unique (stu_school, stu_grade, stu_class, stu_num)   -- 중복 계정 방지
);

-- 좋아요(투표) 기록: 작품당 1회 보장
create table if not exists votes (
  id         bigint generated always as identity primary key,
  voter_id   bigint not null references students(id) on delete cascade,
  work_id    bigint not null references students(id) on delete cascade,
  created_at timestamptz default now(),
  unique (voter_id, work_id)
);

-- like_num 자동 동기화 트리거
create or replace function bump_like() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update students set like_num = like_num + 1 where id = new.work_id;
  elsif (tg_op = 'DELETE') then
    update students set like_num = greatest(like_num - 1, 0) where id = old.work_id;
  end if;
  return null;
end; $$ language plpgsql;

drop trigger if exists trg_bump_like on votes;
create trigger trg_bump_like after insert or delete on votes
  for each row execute function bump_like();
```

### RLS 정책 (학교 이벤트 수준 — 익명 키 허용)
```sql
alter table students enable row level security;
alter table votes    enable row level security;

create policy "read students"   on students for select using (true);
create policy "insert students" on students for insert with check (true);
create policy "update students" on students for update using (true) with check (true);

create policy "read votes"   on votes for select using (true);
create policy "insert votes" on votes for insert with check (true);
```
> 이 정책은 익명 사용자에게 넓게 허용됩니다. 학내 단기 이벤트엔 충분하지만, 더 엄격히 하려면 별도 인증 도입을 권장합니다(아래 "보안 참고").

---

## 2. 이미지 업로드용 Apps Script (학생이 만들면 됨)

`js/config.js`의 `APPSCRIPT_UPLOAD_URL`에 배포 URL을 넣으면 활성화됩니다.
(미설정 시 학생이 "이미지 링크"에 직접 붙여넣는 방식으로 동작)

프론트는 아래 형식으로 보냅니다:
```json
{ "filename": "poster.png", "mimeType": "image/png", "data": "<base64>" }
```
응답은 반드시 `{ "link": "https://..." }` 형식이어야 합니다.

### Apps Script 예시 (`Code.gs`)
```javascript
const FOLDER_ID = '여기에_구글드라이브_폴더ID';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const bytes = Utilities.base64Decode(body.data);
  const blob = Utilities.newBlob(bytes, body.mimeType, body.filename);
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // <img>로 바로 임베드되는 직접 링크
  const link = 'https://lh3.googleusercontent.com/d/' + file.getId();
  return ContentService.createTextOutput(JSON.stringify({ link: link }))
    .setMimeType(ContentService.MimeType.JSON);
}
```
배포: 우측 상단 **배포 → 새 배포 → 웹 앱**, 액세스 권한 "모든 사용자".

> CORS 참고: 브라우저에서 직접 POST 시 Apps Script가 리다이렉트되며 CORS 이슈가 날 수 있습니다. 그 경우 fetch에 `mode:'no-cors'`는 응답을 못 읽으므로, Apps Script 쪽에서 처리하거나 업로드 후 link를 별도로 받는 흐름이 필요할 수 있습니다. 링크 주시면 실제 응답에 맞춰 조정하겠습니다.

---

## 3. 보안 참고
- 현재 로그인은 비밀번호가 없는 **학교/학년/반/번호/이름** 식별 방식입니다. 같은 (학교·학년·반·번호)로는 계정이 하나만 생성되지만, 타인의 정보를 알면 대리 로그인이 가능합니다. 단기 학내 이벤트엔 일반적인 수준이며, 강화가 필요하면 알려주세요.
- `anon key`는 공개되어도 되는 키입니다(RLS로 보호). `service_role` 키는 절대 프론트에 넣지 마세요.
