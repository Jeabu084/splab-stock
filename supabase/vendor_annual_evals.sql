-- แบบประเมินผู้ขายประจำปี (FM-LA-019)
-- รันครั้งเดียวใน Supabase Dashboard → SQL Editor

create table if not exists vendor_annual_evals (
  id                 bigserial primary key,
  vendor_id          bigint not null references vendors(id),
  fiscal_year        int    not null,               -- ปีงบ ค.ศ. เช่น 2026 = ต.ค.2025–ก.ย.2026
  s1  int check (s1  in (2,4,6,8,10)),
  s2  int check (s2  in (2,4,6,8,10)),
  s3  int check (s3  in (2,4,6,8,10)),
  s4  int check (s4  in (2,4,6,8,10)),
  s5  int check (s5  in (2,4,6,8,10)),
  s6  int check (s6  in (2,4,6,8,10)),
  s7  int check (s7  in (2,4,6,8,10)),
  s8  int check (s8  in (2,4,6,8,10)),
  s9  int check (s9  in (2,4,6,8,10)),
  s10 int check (s10 in (2,4,6,8,10)),
  total              int  not null,
  passed             boolean not null,
  suggestion         text,
  evaluator_name     text,
  evaluator_position text,
  signature          text,                          -- รูปลายเซ็น (data URL PNG)
  eval_date          date,
  created_by         text,
  updated_at         timestamptz not null default now(),
  unique (vendor_id, fiscal_year)
);

-- ให้แอปอ่าน/เขียนได้ด้วย anon key เหมือนตารางอื่นในระบบ
alter table vendor_annual_evals enable row level security;
create policy "anon read"   on vendor_annual_evals for select using (true);
create policy "anon insert" on vendor_annual_evals for insert with check (true);
create policy "anon update" on vendor_annual_evals for update using (true);
