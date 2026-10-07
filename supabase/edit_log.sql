-- ประวัติการแก้ไข/ลบรายการรับ-เบิก (audit trail)
-- รันครั้งเดียวใน Supabase Dashboard → SQL Editor

create table if not exists edit_log (
  id          bigserial primary key,
  table_name  text not null,                 -- 'receipts' | 'issues'
  row_id      bigint not null,
  action      text not null check (action in ('update','delete')),
  before      jsonb not null,                -- ข้อมูลเดิมทั้งแถว (ใช้กู้คืนได้)
  after       jsonb,                         -- ข้อมูลใหม่ (null เมื่อลบ)
  reason      text not null,
  edited_by   text,
  edited_at   timestamptz not null default now()
);

create index if not exists edit_log_row_idx on edit_log (table_name, row_id);

-- แอปเพิ่มและอ่านประวัติได้ แต่แก้/ลบประวัติไม่ได้
alter table edit_log enable row level security;
create policy "anon read"   on edit_log for select using (true);
create policy "anon insert" on edit_log for insert with check (true);
