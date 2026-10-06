'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS_WARN = 90
function daysUntil(d) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

const STATUSES = [
  { key:'expired', label:'หมดอายุ', dot:'#C0392B' },
  { key:'crit',  label:'วิกฤต',     dot:'var(--pink-dark)' },
  { key:'warn',  label:'ใกล้หมด',   dot:'var(--yellow-dark)' },
  { key:'ok',    label:'ปกติ',      dot:'var(--gd)' },
  { key:'noexp', label:'ไม่มี Exp', dot:'#B07A00' },
  { key:'zero',  label:'หมดสต็อก',  dot:'var(--muted)' },
]

function statusOf(r) {
  if (r.balance===0) return {key:'zero',label:'หมดสต็อก',cls:'pill-danger'}
  if (!r.expire) return {key:'noexp',label:'ไม่มี Exp',cls:'pill-warn'}
  const d = daysUntil(r.expire)
  if (d<0) return {key:'expired',label:'หมดอายุ '+(-d)+' วันก่อน',cls:'pill-expired'}
  if (d<=30) return {key:'crit',label:'วิกฤต '+d+'วัน',cls:'pill-danger'}
  if (d<=DAYS_WARN) return {key:'warn',label:'ใกล้หมด '+d+'วัน',cls:'pill-warn'}
  return {key:'ok',label:'ปกติ',cls:'pill-ok'}
}

function exportCSV(rows) {
  const headers = ['ประเภท','รายการ','Lot','Expire','คงเหลือ','หน่วย','ราคา/หน่วย','มูลค่าคงเหลือ','สถานะ']
  const lines = [headers.map(esc).join(',')]
  rows.forEach(r => {
    const st = statusOf(r).label
    const val = r.unit_price ? (r.balance * r.unit_price) : ''
    lines.push([r.type,r.item,r.lot||'',r.expire||'',r.balance,r.unit||'',r.unit_price||'',val,st].map(esc).join(','))
  })
  const blob = new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'})
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
  a.download='stock_items_'+new Date().toISOString().slice(0,10)+'.csv'; a.click()
}

export default function TabItems() {
  const [rows, setRows] = useState([])
  const [types, setTypes] = useState([])
  const [typeFilter, setTypeFilter] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: master }, { data: bal }, { data: receipts }] = await Promise.all([
      supabase.from('master_items').select('type,item,unit').eq('is_hidden',false).order('type').order('item'),
      supabase.from('stock_balance').select('type,item,lot,expire,balance').order('type').order('item').order('expire'),
      supabase.from('receipts').select('type,item,unit,unit_price,date').order('date',{ascending:false}),
    ])
    if (!master) { setLoading(false); return }

    const priceMap = {}
    const unitMap = {}
    ;(receipts||[]).forEach(r => {
      const k = r.type+'||'+r.item
      if (r.unit_price != null && priceMap[k] === undefined) priceMap[k] = Number(r.unit_price)
      if (r.unit && unitMap[k] === undefined) unitMap[k] = r.unit
    })
    master.forEach(m => {
      const k = m.type+'||'+m.item
      if (unitMap[k] === undefined) unitMap[k] = m.unit || ''
    })

    const balMap = {}
    ;(bal||[]).forEach(r => {
      const k = r.type+'||'+r.item
      if (!balMap[k]) balMap[k]=[]
      balMap[k].push(r)
    })

    const result = []
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const unit = unitMap[k]||''
      const price = priceMap[k]
      const lots = balMap[k]||[]
      if (lots.length) lots.forEach(r=>result.push({...r,balance:Number(r.balance),unit,unit_price:price}))
      else result.push({type:m.type,item:m.item,lot:'',expire:'',balance:0,unit,unit_price:price})
    })
    setRows(result)
    setTypes([...new Set(master.map(r=>r.type))].sort())
    setLoading(false)
  }

  // กรองประเภท + ค้นหาก่อน เพื่อนับจำนวนแต่ละสถานะบนปุ่ม
  const baseRows = rows.filter(r => {
    if (typeFilter.length && !typeFilter.includes(r.type)) return false
    if (search && !r.item.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
  const statusCount = {}
  baseRows.forEach(r => { const k = statusOf(r).key; statusCount[k] = (statusCount[k]||0)+1 })
  const filtered = statusFilter.length ? baseRows.filter(r => statusFilter.includes(statusOf(r).key)) : baseRows

  // จัดกลุ่ม ประเภท → รายการ → Lot
  const typeGroups = []
  filtered.forEach(r => {
    let tg = typeGroups[typeGroups.length-1]
    if (!tg || tg.type!==r.type) { tg = { type:r.type, items:[] }; typeGroups.push(tg) }
    let ig = tg.items[tg.items.length-1]
    if (!ig || ig.item!==r.item) { ig = { item:r.item, unit:r.unit, unit_price:r.unit_price, total:0, lots:[] }; tg.items.push(ig) }
    ig.lots.push(r)
    ig.total += r.balance
  })

  const totalValue = filtered.reduce((s,r)=> s + (r.unit_price ? r.balance*r.unit_price : 0), 0)
  const money = (v) => v.toLocaleString('th-TH',{minimumFractionDigits:2})
  const toggle = (setter, v) => setter(f => f.includes(v) ? f.filter(x=>x!==v) : [...f, v])

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-list-details" style={{ color:'#B07A00' }}></i> รายการน้ำยาทั้งหมด</h2>
          <div className="pill pill-ok" style={{ fontSize:13, padding:'8px 16px' }}>
            มูลค่าคงเหลือรวม: {totalValue.toLocaleString('th-TH',{minimumFractionDigits:2})} บาท
          </div>
        </div>
        <div className="print-only" style={{ fontSize:10, color:'#555', marginBottom:6 }}>
          พิมพ์วันที่ {new Date().toLocaleDateString('th-TH',{ day:'numeric', month:'long', year:'numeric' })}
          {typeFilter.length>0 && ' · ประเภท: '+typeFilter.join(', ')}
          {search && ' · ค้นหา: '+search}
          {statusFilter.length>0 && ' · สถานะ: '+STATUSES.filter(s=>statusFilter.includes(s.key)).map(s=>s.label).join(', ')}
        </div>
        <div className="no-print" style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>ค้นหา กรองตามประเภท หรือ export ข้อมูลรายการน้ำยาทั้งหมด</div>

        <div className="no-print type-chips">
          <span className="chip-label">ประเภท</span>
          <button className={'type-chip'+(typeFilter.length===0?' on':'')} onClick={()=>setTypeFilter([])}>ทั้งหมด</button>
          {types.map(t=>(
            <button key={t} className={'type-chip'+(typeFilter.includes(t)?' on':'')} onClick={()=>toggle(setTypeFilter,t)}>
              {typeFilter.includes(t) && <i className="ti ti-check"></i>} {t}
            </button>
          ))}
        </div>

        <div className="no-print type-chips">
          <span className="chip-label">สถานะ</span>
          <button className={'type-chip'+(statusFilter.length===0?' on':'')} onClick={()=>setStatusFilter([])}>ทั้งหมด</button>
          {STATUSES.map(s=>(
            <button key={s.key} className={'type-chip'+(statusFilter.includes(s.key)?' on':'')} onClick={()=>toggle(setStatusFilter,s.key)}>
              <span className="chip-dot" style={{ background:s.dot }}></span>
              {s.label} <span className="chip-count">{statusCount[s.key]||0}</span>
            </button>
          ))}
        </div>

        <div className="no-print" style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหารายการ..." style={{ flex:1, minWidth:200 }}/>
        </div>

        <div className="no-print" style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <button className="btn btn-teal" onClick={loadData}><i className="ti ti-refresh"></i> รีเฟรช</button>
          <button className="btn btn-purple" onClick={()=>exportCSV(filtered)}><i className="ti ti-download"></i> Export CSV</button>
          <button className="btn btn-outline" onClick={()=>window.print()}><i className="ti ti-printer"></i> Print</button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="items-table">
              <thead>
                <tr>
                  {['รายการ','Lot','Expire','คงเหลือ','ราคา/หน่วย','มูลค่า','สถานะ'].map(h=>(
                    <th key={h} className={['ราคา/หน่วย','มูลค่า'].includes(h) ? 'col-money' : undefined} style={{ textAlign: ['คงเหลือ','ราคา/หน่วย','มูลค่า'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                  <th className="items-total">รวมคงเหลือ</th>
                </tr>
              </thead>
              {typeGroups.map(tg => (
                <tbody key={tg.type}>
                  <tr className="items-type-row">
                    <td colSpan={8}>{tg.type} <span>· {tg.items.length} รายการ</span></td>
                  </tr>
                  {tg.items.map(ig => ig.lots.map((r,li) => {
                    const st = statusOf(r)
                    const value = r.unit_price ? r.balance*r.unit_price : null
                    const first = li===0
                    return (
                      <tr key={ig.item+'-'+li} className={first ? 'items-first' : undefined}>
                        {first && (
                          <td rowSpan={ig.lots.length} style={{ verticalAlign:'top', fontWeight:700 }}>
                            {ig.item}
                            {ig.lots.length>1 && <div className="items-sub">{ig.lots.length} Lot</div>}
                          </td>
                        )}
                        <td>{r.lot||'—'}</td>
                        <td style={{ color:'var(--muted)' }}>{r.expire||'—'}</td>
                        <td style={{ textAlign:'right', fontWeight:800, color: r.balance===0?'var(--pink-dark)':'var(--text)' }}>
                          {r.balance} <span style={{ fontWeight:500, color:'var(--muted)', fontSize:12 }}>{r.unit}</span>
                        </td>
                        <td className="col-money" style={{ textAlign:'right', color:'var(--muted)' }}>{r.unit_price!=null ? money(r.unit_price) : '—'}</td>
                        <td className="col-money" style={{ textAlign:'right', fontWeight:700 }}>{value!=null ? money(value) : '—'}</td>
                        <td>{st && <span className={'pill '+st.cls}>{st.label}</span>}</td>
                        {first && (
                          <td rowSpan={ig.lots.length} className="items-total" style={{ color: ig.total===0?'var(--pink-dark)':undefined }}>
                            {ig.total} <span>{ig.unit}</span>
                          </td>
                        )}
                      </tr>
                    )
                  }))}
                </tbody>
              ))}
            </table>
            {filtered.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}
        <style>{`
          .items-table tbody tr.items-first td { border-top:1.5px solid rgba(0,0,0,0.09); }
          .items-table .items-type-row td { background:var(--yellow-bg); color:#B07A00; font-weight:800; font-size:14px; border-top:none; padding:8px 12px; }
          .items-table .items-type-row td span { font-weight:600; font-size:12px; opacity:.8; }
          .items-table .items-type-row:hover td { background:var(--yellow-bg); }
          .items-table .items-sub { font-size:12px; font-weight:500; color:var(--muted); margin-top:2px; }
          .items-table .items-total { text-align:right; vertical-align:middle; background:#EFF8F3; color:#3D7E66; font-weight:900; font-size:16px; border-left:2px solid #C9E4D8; white-space:nowrap; }
          .items-table th.items-total { font-size:13px; font-weight:800; background:#C9E4D8; }
          .items-table td.items-total span { font-size:12px; font-weight:600; color:var(--muted); }
          .items-table tr:hover td.items-total { background:#EFF8F3; }
          .type-chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
          .type-chip { display:inline-flex; align-items:center; gap:5px; border:1.5px solid var(--border); background:#fff; color:var(--muted); border-radius:99px; padding:8px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .15s; }
          .type-chip:hover { border-color:#B07A00; color:#B07A00; }
          .type-chip.on { background:#FFF6E0; border-color:#FFC247; color:#B07A00; }
          .type-chips { align-items:center; }
          .chip-label { font-size:13px; font-weight:800; color:var(--muted); min-width:52px; }
          .chip-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
          .chip-count { font-size:11px; font-weight:800; background:rgba(0,0,0,0.06); border-radius:99px; padding:1px 7px; margin-left:2px; }
          @media print {
            .items-table .items-type-row td { font-size:11px; padding:3px 6px; border-bottom:1px solid #ccc; }
            .items-table .items-type-row { break-after:avoid; }
            .items-table tbody tr.items-first td { border-top:1px solid #bbb; }
            .items-table .items-sub { font-size:9px; margin-top:0; }
            .items-table .items-total { font-size:12px; }
            .items-table .col-money { display:none; }
            .items-table td.items-total span { font-size:9px; }
          }
        `}</style>
      </div>
    </div>
  )
}
