-- 사이버폭력 예방 사이트용 테이블 (cv_ 접두사로 물리 프로젝트 테이블과 구분)
-- 적용 대상: quntum_physics_01 (zvdozshnwtfwthuotynb)

create table if not exists public.cv_students (
  id              bigint generated always as identity primary key,
  stu_id          text        not null,               -- 학생 이름
  stu_school      text        not null,
  stu_grade       int         not null,
  stu_class       int         not null,
  stu_num         int         not null,
  token           uuid        not null default gen_random_uuid(),  -- 본인 확인용 비밀값
  like_num        int         not null default 0,
  submit_img_link text,
  submit_exp      text,
  created_at      timestamptz not null default now(),
  constraint cv_students_identity_uniq unique (stu_school, stu_grade, stu_class, stu_num)
);

create table if not exists public.cv_votes (
  id         bigint generated always as identity primary key,
  voter_id   bigint      not null references public.cv_students(id) on delete cascade,
  work_id    bigint      not null references public.cv_students(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint cv_votes_voter_work_uniq unique (voter_id, work_id)
);

create index if not exists cv_students_submitted_idx
  on public.cv_students (like_num desc, id desc)
  where submit_img_link is not null;

create index if not exists cv_votes_work_idx on public.cv_votes (work_id);

-- 좋아요 수 자동 동기화 (기존 코드의 like_num 미갱신 버그를 DB 차원에서 해결)
create or replace function public.cv_sync_like_num()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.cv_students
       set like_num = like_num + 1
     where id = new.work_id;
  elsif (tg_op = 'DELETE') then
    update public.cv_students
       set like_num = greatest(like_num - 1, 0)
     where id = old.work_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_cv_votes_sync_like on public.cv_votes;
create trigger trg_cv_votes_sync_like
  after insert or delete on public.cv_votes
  for each row execute function public.cv_sync_like_num();

-- RLS: 정책을 하나도 두지 않아 익명 직접 접근을 전면 차단합니다.
-- 모든 읽기/쓰기는 02 파일의 뷰와 RPC 함수를 통해서만 이루어집니다.
alter table public.cv_students enable row level security;
alter table public.cv_votes    enable row level security;

revoke all on public.cv_students from anon, authenticated;
revoke all on public.cv_votes    from anon, authenticated;

comment on table public.cv_students is '사이버폭력 예방 캠페인 참여 학생 및 제출 작품. 개인정보 포함 - 익명 직접 조회 금지, cv_works_public 뷰 사용.';
comment on table public.cv_votes is '작품 좋아요 기록. 학생당 작품당 1회.';
