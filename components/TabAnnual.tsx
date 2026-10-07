'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import TypeMultiSelect from '@/components/TypeMultiSelect'
import { useFY, fyRange, toBE } from '@/lib/fiscal'
import PrintButton from '@/components/PrintButton'

const MONTHS = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const MONTHS_S = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const FY_MONTHS = [10,11,12,1,2,3,4,5,6,7,8,9]
const pad = (n) => String(n).padStart(2,'0')

// ช่วงวันที่ของรายงาน: ทั้งปีงบ หรือเดือน m ของปีงบ fy  (end แบบ < ไม่รวม)
function periodOf(fy, month) {
  if (!month) {
    const { start, end } = fyRange(fy)
    return { start, end, lastDay: (fy)+'-09-30' }
  }
  const y = month >= 10 ? fy-1 : fy
  const start = y+'-'+pad(month)+'-01'
  const end = month===12 ? (y+1)+'-01-01' : y+'-'+pad(month+1)+'-01'
  const last = new Date(y, month, 0).getDate()
  return { start, end, lastDay: y+'-'+pad(month)+'-'+pad(last) }
}
const dShort = (iso) => { const [y,m,d] = iso.split('-').map(Number); return d+' '+MONTHS_S[m]+' '+String(y+543).slice(2) }
const dLong  = (iso) => { const [y,m,d] = iso.split('-').map(Number); return d+' '+MONTHS[m]+' '+(y+543) }
const todayISO = () => { const t = new Date(); return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()) }

const num = (v) => Number(v).toLocaleString('th-TH')
// เรียงแบบเดียวกับ order() ของฐานข้อมูล (ภาษาอังกฤษก่อนภาษาไทย) ให้ตรงกับหน้าอื่น
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

// Supabase คืนได้สูงสุด 1000 แถวต่อ request จึงต้องดึงทีละหน้า
async function fetchAll(table, cols, end) {
  const all = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(cols).lt('date', end).order('id').range(from, from+PAGE-1)
    if (error) throw new Error(table+': '+error.message)
    all.push(...data)
    if (data.length < PAGE) break
  }
  return all
}

export default function TabAnnual() {
  const { fy } = useFY()
  const [raw, setRaw] = useState(null)        // { master, rc, is, ob } ทั้งหมดถึงสิ้นปีงบ
  const [month, setMonth] = useState(0)       // 0 = ทั้งปีงบ, 1–12 = รายเดือน
  const [typeFilter, setTypeFilter] = useState([])
  const [search, setSearch] = useState('')
  const [showIdle, setShowIdle] = useState(false)
  const [showHidden, setShowHidden] = useState(true)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [fy])

  async function load() {
    setLoading(true); setErr('')
    const { end } = fyRange(fy)
    try {
      const [{ data: master }, rc, is, ob] = await Promise.all([
        supabase.from('master_items').select('type,item,unit,is_hidden').order('type').order('item'),
        fetchAll('receipts', 'id,type,item,date,qty,unit', end),
        fetchAll('issues', 'id,type,item,date,qty', end),
        fetchAll('opening_balance', 'id,type,item,date,qty', end),
      ])
      setRaw({ master: master||[], rc, is, ob })
    } catch (e) {
      setErr('โหลดข้อมูลไม่สำเร็จ: '+e.message)
    }
    setLoading(false)
  }

  const period = periodOf(fy, month)

  // คำนวณยอดของช่วงที่เลือกจากข้อมูลที่โหลดไว้ (สลับเดือนได้ทันที ไม่ต้องโหลดใหม่)
  const rows = useMemo(() => {
    if (!raw) return []
    const { start, end } = period
    const map: Record<string, any> = {}
    const get = (type, item) => map[type+'||'+item] ||= { type, item, unit:'', unitDate:'', carry:0, rin:0, rout:0, hidden:false }
    raw.master.forEach(m => { const g = get(m.type, m.item); g.unit = m.unit || ''; g.hidden = !!m.is_hidden })
    // ยอดตั้งต้นระบบนับเป็นยอดยกมา (เหมือน Stock Card)
    raw.ob.forEach(r => { if (r.date < end) get(r.type, r.item).carry += Number(r.qty) })
    raw.rc.forEach(r => {
      const g = get(r.type, r.item)
      if (r.unit && r.date >= g.unitDate) { g.unit = r.unit; g.unitDate = r.date }
      if (r.date < start) g.carry += Number(r.qty)
      else if (r.date < end) g.rin += Number(r.qty)
    })
    raw.is.forEach(r => {
      const g = get(r.type, r.item)
      if (r.date < start) g.carry -= Number(r.qty)
      else if (r.date < end) g.rout += Number(r.qty)
    })
    const visible = new Set(raw.master.map(m => m.type+'||'+m.item))
    return Object.entries(map)
      .filter(([k]) => visible.has(k))
      .map(([,g]) => ({ ...g, end:g.carry+g.rin-g.rout }))
      .sort((a,b) => cmp(a.type,b.type) || cmp(a.item,b.item))
  }, [raw, period.start, period.end])
  const types = useMemo(() => [...new Set(rows.map(r=>r.type))], [rows])

  // เดือนในอนาคตยังไม่มีข้อมูล
  const today = todayISO()
  const monthOk = (m) => periodOf(fy, m).start <= today
  function pickMonthly() {
    const ok = FY_MONTHS.filter(monthOk)
    setMonth(ok.length ? ok[ok.length-1] : 10)
  }

  // น้ำยาที่เลิกใช้: แสดงเฉพาะปีที่ยังมีความเคลื่อนไหว
  const isActive = (r) => r.carry || r.rin || r.rout
  const hiddenCount = rows.filter(r => r.hidden && isActive(r)).length
  const filtered = rows.filter(r => {
    if (r.hidden && (!showHidden || !isActive(r))) return false
    if (typeFilter.length && !typeFilter.includes(r.type)) return false
    if (search && !r.item.toLowerCase().includes(search.toLowerCase())) return false
    if (!showIdle && !r.carry && !r.rin && !r.rout) return false
    return true
  })
  const groups = []
  filtered.forEach(r => {
    let g = groups[groups.length-1]
    if (!g || g.type!==r.type) { g = { type:r.type, items:[] }; groups.push(g) }
    g.items.push(r)
  })

  const fyBE = toBE(fy)
  const monthYearBE = month ? (month >= 10 ? fyBE-1 : fyBE) : 0
  const fileName = month ? 'สรุปคงเหลือประจำเดือน_'+MONTHS_S[month]+monthYearBE : 'สรุปสต็อกประจำปีงบ_'+fyBE
  const reportTitle = month
    ? 'รายงานสรุปยอดคงเหลือน้ำยาประจำเดือน '+MONTHS[month]+' '+monthYearBE
    : 'รายงานสรุปสต็อกน้ำยาประจำปีงบประมาณ '+fyBE
  const reportRange = 'ระหว่างวันที่ '+dLong(period.start)+' – '+dLong(period.lastDay)

  function exportCSV() {
    const lines = [['ประเภท','รายการ','หน่วยนับ','ยอดยกมา','รับ','เบิก','คงเหลือ','สถานะ'].map(esc).join(',')]
    filtered.forEach(r => lines.push([r.type, r.item, r.unit, r.carry, r.rin, r.rout, r.end, r.hidden ? 'เลิกใช้' : ''].map(esc).join(',')))
    const blob = new Blob(['﻿'+lines.join('\n')], { type:'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName+'.csv'
    a.click()
  }

  return (
    <div className="annual-stock">
      <div className="card">
        <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-calendar-stats" style={{ color:'#3D7E66' }}></i> สรุปยอดคงเหลือ</h2>
          <div className="period-pick">
            <span className="pp-fy">ปีงบ {fyBE}</span>
            <button className={!month ? 'on' : ''} onClick={()=>setMonth(0)}>ทั้งปีงบ</button>
            <button className={month ? 'on' : ''} onClick={()=>{ if (!month) pickMonthly() }}>รายเดือน</button>
            {!!month && (
              <select value={month} onChange={e=>setMonth(Number(e.target.value))}>
                {FY_MONTHS.map(m => (
                  <option key={m} value={m} disabled={!monthOk(m)}>{MONTHS[m]} {m>=10 ? fyBE-1 : fyBE}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="no-print" style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
          {dShort(period.start)} – {dShort(period.lastDay)} · คงเหลือ = ยอดยกมา + รับ − เบิก · ดูวันที่รับ/เบิกรายครั้งได้ที่หน้า Stock Card
        </div>

        {/* หัวรายงานตอนพิมพ์ */}
        <div className="print-only report-head">
          <div className="rh-title">{reportTitle}</div>
          <div className="rh-sub">{reportRange}{month ? ' (ปีงบประมาณ '+fyBE+')' : ''}</div>
          <div className="rh-meta">
            ประเภท: {typeFilter.length ? typeFilter.join(', ') : 'ทุกประเภท'}
            {search && ' · ค้นหา: '+search}
            {hiddenCount>0 && (showHidden ? ' · รวมน้ำยาที่เลิกใช้' : ' · ไม่รวมน้ำยาที่เลิกใช้')}
            {' · '}จำนวน {filtered.length} รายการ
          </div>
        </div>

        <div className="no-print" style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <TypeMultiSelect types={types} value={typeFilter} onChange={setTypeFilter} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหารายการ..." style={{ flex:1, minWidth:200 }}/>
        </div>
        <div className="no-print" style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <button className="btn btn-teal" onClick={load}><i className="ti ti-refresh"></i> รีเฟรช</button>
          <button className={'idle-chip'+(showIdle?' on':'')} onClick={()=>setShowIdle(v=>!v)}>
            {showIdle && <i className="ti ti-check"></i>} แสดงรายการที่ไม่มีความเคลื่อนไหว
          </button>
          {hiddenCount>0 && (
            <button className={'idle-chip'+(showHidden?' on':'')} onClick={()=>setShowHidden(v=>!v)}>
              {showHidden && <i className="ti ti-check"></i>} รวมน้ำยาที่เลิกใช้ ({hiddenCount})
            </button>
          )}
          <div style={{ flex:1 }}></div>
          <button className="btn btn-outline" onClick={exportCSV}><i className="ti ti-file-spreadsheet"></i> ดาวน์โหลด CSV</button>
          <PrintButton fileName={fileName} className="btn btn-purple" />
        </div>

        {err && <div className="pill pill-danger" style={{ display:'block', padding:'10px 14px', fontSize:12, marginBottom:12 }}>{err}</div>}

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <div className="as-wrap" style={{ overflowX:'auto' }}>
            <table className="as-table">
              <thead>
                <tr>
                  <th className="no-col">ที่</th>
                  <th>รายการ</th>
                  <th>หน่วยนับ</th>
                  <th className="n">ยอดยกมา<small>{dShort(period.start)}</small></th>
                  <th className="n">รับ</th>
                  <th className="n">เบิก</th>
                  <th className="n end-h">คงเหลือ<small>{dShort(period.lastDay)}</small></th>
                </tr>
              </thead>
              {groups.map(g => (
                <tbody key={g.type}>
                  <tr className="as-type"><td colSpan={7}>{g.type} <span>· {g.items.length} รายการ</span>{g.items.every(r=>r.hidden) && <em className="disc">เลิกใช้</em>}</td></tr>
                  {g.items.map((r,i) => (
                    <tr key={r.item}>
                      <td className="no-col">{i+1}</td>
                      <td className="item">{r.item}{r.hidden && !g.items.every(x=>x.hidden) && <em className="disc">เลิกใช้</em>}</td>
                      <td className="unit">{r.unit||'—'}</td>
                      <td className="n">{num(r.carry)}</td>
                      <td className="n in">{r.rin ? num(r.rin) : '—'}</td>
                      <td className="n out">{r.rout ? num(r.rout) : '—'}</td>
                      <td className={'n end'+(r.end<=0?' zero':'')}>{num(r.end)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            {filtered.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}

        {/* ลงชื่อท้ายรายงาน */}
        <div className="print-only report-sign">
          <div><div className="sl"></div>ผู้จัดทำรายงาน<div className="sd">วันที่ ......../......../........</div></div>
          <div><div className="sl"></div>ผู้ตรวจสอบ / หัวหน้างาน<div className="sd">วันที่ ......../......../........</div></div>
        </div>
      </div>

      <style>{`
        .annual-stock .idle-chip { display:inline-flex; align-items:center; gap:5px; border:1.5px solid var(--border); background:#fff; color:var(--muted); border-radius:99px; padding:10px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
        .annual-stock .idle-chip.on { background:#EFF8F3; border-color:#8FCBB0; color:#3D7E66; }

        .as-table th { background:#C9E4D8; color:#3D7E66; font-weight:800; font-size:13px; border-bottom:none; white-space:nowrap; }
        .as-table th:first-child { border-top-left-radius:10px; }
        .as-table th:last-child { border-top-right-radius:10px; }
        .as-table th.end-h { background:#3D7E66; color:#fff; }
        .as-table th small { display:block; font-size:10.5px; font-weight:600; opacity:.8; }
        .period-pick { display:flex; align-items:center; gap:4px; background:#EFF8F3; border:1.5px solid #C9E4D8; border-radius:14px; padding:4px; flex-wrap:wrap; }
        .period-pick .pp-fy { font-size:13px; font-weight:800; color:#3D7E66; padding:0 10px; }
        .period-pick button { border:none; background:none; border-radius:10px; padding:8px 14px; font-size:13px; font-weight:800; color:#3D7E66; cursor:pointer; font-family:inherit; }
        .period-pick button.on { background:#3D7E66; color:#fff; }
        .period-pick select { width:auto; height:36px; line-height:36px; font-size:14px; font-weight:700; color:#3D7E66; background-color:#fff; border-color:#C9E4D8; padding:0 34px 0 12px; }
        .as-table .n { text-align:right; white-space:nowrap; width:11%; }
        .as-table .no-col { width:40px; text-align:center; color:var(--muted); }
        .as-table .as-type td { background:var(--yellow-bg); color:#B07A00; font-weight:800; font-size:14px; padding:8px 12px; }
        .as-table .as-type td span { font-weight:600; font-size:12px; opacity:.8; }
        .as-table .as-type:hover td { background:var(--yellow-bg); }
        .as-table td.item { font-weight:700; }
        .disc { font-style:normal; display:inline-block; margin-left:8px; font-size:10.5px; font-weight:800; color:#6b7c85; background:#EEF1F3; border-radius:99px; padding:1px 8px; vertical-align:middle; }
        .as-table .unit { color:var(--muted); width:10%; }
        .as-table td.in { color:#3D7E66; font-weight:700; }
        .as-table td.out { color:var(--pink-dark); font-weight:700; }
        .as-table td.end { background:#EFF8F3; color:#3D7E66; font-weight:900; font-size:15px; border-left:2px solid #C9E4D8; }
        .as-table td.end.zero { color:var(--pink-dark); }
        .as-table tr:hover td.end { background:#EFF8F3; }

        .report-head { text-align:center; margin-bottom:10px; }
        .rh-title { font-size:17px; font-weight:800; }
        .rh-sub { font-size:13px; margin-top:2px; }
        .rh-meta { font-size:11px; color:#444; margin-top:4px; }
        .report-sign { display:none; }

        :where(html.pg-print) {
          .as-wrap { overflow:visible!important; }
          .as-table thead { display:table-header-group; }
          .as-table tbody { break-inside:auto; }
          .as-table tr { break-inside:avoid; }
          .as-table { border:1px solid #9bb; }
          .as-table th { font-size:11.5pt; padding:5px 8px; border-radius:0!important; border-bottom:1px solid #9bb; }
          .as-table td { font-size:11pt; padding:4px 8px; border-bottom:1px solid #d5dede; color:#000; }
          .as-table td.unit, .as-table .no-col { color:#333; }
          .as-table td.item { font-weight:600; }
          .as-table td.end { font-size:11.5pt; }
          .as-table .as-type td { font-size:11.5pt; padding:4px 8px; border-bottom:1px solid #d9c38a; }
          .as-table .as-type td span { font-size:10pt; }
          .as-table .as-type { break-after:avoid; }
          .rh-title { font-size:16pt; }
          .rh-sub { font-size:12pt; }
          .rh-meta { font-size:10pt; }
          .report-sign { display:flex; justify-content:space-around; margin-top:32px; font-size:11pt; text-align:center; break-inside:avoid; }
          .report-sign .sl { width:62mm; border-bottom:1px dotted #000; height:16mm; margin-bottom:4px; }
          .report-sign .sd { margin-top:6px; color:#444; }
        }
      `}</style>
    </div>
  )
}
