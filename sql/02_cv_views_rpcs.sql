-- 갤러리용 공개 뷰 + 로그인/제출/좋아요 RPC
-- 적용 대상: quntum_physics_01 (zvdozshnwtfwthuotynb)

-- 갤러리용 공개 뷰: 개인정보(이름·학교·학년·반·번호)는 절대 나가지 않습니다.
create or replace view public.cv_works_public
with (security_invoker = off) as
select id, submit_img_link, submit_exp, like_num, created_at
  from public.cv_students
 where submit_img_link is not null
   and submit_img_link <> '';

grant select on public.cv_works_public to anon, authenticated;

comment on view public.cv_works_public is '갤러리 공개용. 작품 정보만 노출하며 개인정보 컬럼은 제외.';

-- 로그인 / 최초 등록. 성공 시 본인 확인용 token 을 발급합니다.
create or replace function public.cv_login_or_register(
  p_name text, p_school text, p_grade int, p_class int, p_num int
) returns table (id bigint, token uuid, name text)
language plpgsql security definer set search_path = public as $$
declare v public.cv_students%rowtype;
begin
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_school), '') = ''
     or p_grade is null or p_class is null or p_num is null then
    raise exception '모든 항목을 입력해 주세요.' using errcode = '22023';
  end if;

  select * into v from public.cv_students
   where stu_school = btrim(p_school)
     and stu_grade  = p_grade
     and stu_class  = p_class
     and stu_num    = p_num;

  if found then
    if v.stu_id is distinct from btrim(p_name) then
      raise exception '해당 학년·반·번호로 이미 등록된 계정이 있어요. 이름이 일치하지 않습니다.'
        using errcode = '28000';
    end if;
  else
    insert into public.cv_students (stu_id, stu_school, stu_grade, stu_class, stu_num)
    values (btrim(p_name), btrim(p_school), p_grade, p_class, p_num)
    returning * into v;
  end if;

  return query select v.id, v.token, v.stu_id;
end $$;

-- 작품 제출: 본인 token 이 맞을 때만 자기 행을 수정할 수 있습니다.
create or replace function public.cv_submit_work(
  p_id bigint, p_token uuid, p_link text, p_exp text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_link), '') = '' then
    raise exception '이미지 링크가 필요합니다.' using errcode = '22023';
  end if;

  update public.cv_students
     set submit_img_link = btrim(p_link),
         submit_exp      = p_exp
   where id = p_id and token = p_token;

  if not found then
    raise exception '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.' using errcode = '28000';
  end if;
end $$;

-- 좋아요: 본인 확인 + 작품당 1회. 갱신된 좋아요 수를 돌려줍니다.
create or replace function public.cv_like_work(
  p_voter bigint, p_token uuid, p_work bigint
) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not exists (
    select 1 from public.cv_students where id = p_voter and token = p_token
  ) then
    raise exception '로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.' using errcode = '28000';
  end if;

  insert into public.cv_votes (voter_id, work_id)
  values (p_voter, p_work)
  on conflict (voter_id, work_id) do nothing;

  if not found then
    raise exception '이미 좋아요한 작품이에요.' using errcode = '23505';
  end if;

  select like_num into v_count from public.cv_students where id = p_work;
  return coalesce(v_count, 0);
end $$;

-- 내가 좋아요한 작품 목록
create or replace function public.cv_my_votes(p_voter bigint, p_token uuid)
returns setof bigint
language sql security definer set search_path = public as $$
  select v.work_id
    from public.cv_votes v
   where v.voter_id = p_voter
     and exists (
       select 1 from public.cv_students s
        where s.id = p_voter and s.token = p_token
     );
$$;

grant execute on function public.cv_login_or_register(text, text, int, int, int) to anon, authenticated;
grant execute on function public.cv_submit_work(bigint, uuid, text, text)          to anon, authenticated;
grant execute on function public.cv_like_work(bigint, uuid, bigint)                to anon, authenticated;
grant execute on function public.cv_my_votes(bigint, uuid)                         to anon, authenticated;
