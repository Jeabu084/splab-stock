-- สรุปประเมินผู้ขายประจำปี (รวมผลประเมินรายบิลในปีงบ)
-- รันใน Supabase Dashboard → SQL Editor
-- หมายเหตุ: drop ตารางเวอร์ชันแรก (ยังไม่มีข้อมูล) แล้วสร้างใหม่

drop table if exists vendor_annual_evals;

create table vendor_annual_evals (
  id                 bigserial primary key,
  vendor_id          bigint not null references vendors(id),
  fiscal_year        int    not null,               -- ปีงบ ค.ศ. เช่น 2026 = ต.ค.2025–ก.ย.2026
  bill_count         int    not null,               -- จำนวนบิลที่นำมาสรุป
  avg_delivery       numeric(3,2),                  -- ค่าเฉลี่ยรายหัวข้อ (1–5) ณ วันที่สรุป
  avg_leadtime       numeric(3,2),
  avg_expiry         numeric(3,2),
  avg_coldchain      numeric(3,2),
  avg_quality        numeric(3,2),
  avg_defect         numeric(3,2),
  avg_service        numeric(3,2),
  total_avg          numeric(4,2) not null,         -- เต็ม 35
  pct                numeric(5,2) not null,
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
