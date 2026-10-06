'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS_WARN = 90
function daysUntil(d) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

function exportCSV(rows) {
  const headers = ['ประเภท','รายการ','Lot','Expire','คงเหลือ','หน่วย','ราคา/หน่วย','มูลค่าคงเหลือ','สถานะ']
  const lines = [headers.map(esc).join(',')]
  rows.forEach(r => {
    const st = !r.expire&&r.balance>0?'ไม่มี Exp':r.balance===0?'หมดสต็อก':daysUntil(r.expire)<=30?'วิกฤต':daysUntil(r.expire)<=DAYS_WARN?'ใกล้หมด':'ปกติ'
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
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showZero, setShowZero] = useState(true)

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

  const filtered = rows.filter(r => {
    if (!showZero && r.balance===0) return false
    if (typeFilter && r.type!==typeFilter) return false
    if (search && !r.item.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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

  function statusPill(r) {
    if (r.balance===0) return {label:'หมดสต็อก',cls:'pill-danger'}
    if (!r.expire) return {label:'ไม่มี Exp',cls:'pill-warn'}
    const d = daysUntil(r.expire)
    if (d<=30) return {label:'วิกฤต '+d+'วัน',cls:'pill-danger'}
    if (d<=DAYS_WARN) return {label:'ใกล้หมด '+d+'วัน',cls:'pill-warn'}
    return {label:'ปกติ',cls:'pill-ok'}
  }

  const totalValue = filtered.reduce((s,r)=> s + (r.unit_price ? r.balance*r.unit_price : 0), 0)
  const money = (v) => v.toLocaleString('th-TH',{minimumFractionDigits:2})

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
          {typeFilter && ' · ประเภท: '+typeFilter}
          {search && ' · ค้นหา: '+search}
          {!showZero && ' · ไม่รวมสต็อก 0'}
        </div>
        <div className="no-print" style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>ค้นหา กรองตามประเภท หรือ export ข้อมูลรายการน้ำยาทั้งหมด</div>

        <div className="no-print" style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ width:'auto', minWidth:160 }}>
            <option value="">ทุกประเภท</option>
            {types.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหารายการ..." style={{ flex:1, minWidth:200 }}/>
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, cursor:'pointer', whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={showZero} onChange={e=>setShowZero(e.target.checked)} style={{ width:'auto', height:'auto' }}/> แสดงสต็อก 0
          </label>
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
                    <th key={h} style={{ textAlign: ['คงเหลือ','ราคา/หน่วย','มูลค่า'].includes(h) ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              {typeGroups.map(tg => (
                <tbody key={tg.type}>
                  <tr className="items-type-row">
                    <td colSpan={7}>{tg.type} <span>· {tg.items.length} รายการ</span></td>
                  </tr>
                  {tg.items.map(ig => ig.lots.map((r,li) => {
                    const st = statusPill(r)
                    const value = r.unit_price ? r.balance*r.unit_price : null
                    const first = li===0
                    return (
                      <tr key={ig.item+'-'+li} className={first ? 'items-first' : undefined}>
                        {first && (
                          <td rowSpan={ig.lots.length} style={{ verticalAlign:'top' }}>
                            <div style={{ fontWeight:700 }}>{ig.item}</div>
                            {ig.lots.length>1 && (
                              <div className="items-sub">
                                {ig.lots.length} Lot · รวม <b style={{ color:'var(--text)' }}>{ig.total}</b> {ig.unit}
                              </div>
                            )}
                          </td>
                        )}
                        <td>{r.lot||'—'}</td>
                        <td style={{ color:'var(--muted)' }}>{r.expire||'—'}</td>
                        <td style={{ textAlign:'right', fontWeight:800, color: r.balance===0?'var(--pink-dark)':'var(--text)' }}>
                          {r.balance} <span style={{ fontWeight:500, color:'var(--muted)', fontSize:12 }}>{r.unit}</span>
                        </td>
                        <td style={{ textAlign:'right', color:'var(--muted)' }}>{r.unit_price!=null ? money(r.unit_price) : '—'}</td>
                        <td style={{ textAlign:'right', fontWeight:700 }}>{value!=null ? money(value) : '—'}</td>
                        <td>{st && <span className={'pill '+st.cls}>{st.label}</span>}</td>
                      </tr>
                    )
                  }))}
                </tbody>
              ))}
            </table>
            <style>{`
              .items-table tbody tr.items-first td { border-top:1.5px solid rgba(0,0,0,0.09); }
              .items-table .items-type-row td { background:var(--yellow-bg); color:#B07A00; font-weight:800; font-size:14px; border-top:none; padding:8px 12px; }
              .items-table .items-type-row td span { font-weight:600; font-size:12px; opacity:.8; }
              .items-table .items-type-row:hover td { background:var(--yellow-bg); }
              .items-table .items-sub { font-size:12px; color:var(--muted); margin-top:2px; }
              @media print {
                .items-table .items-type-row td { font-size:11px; padding:3px 6px; border-bottom:1px solid #ccc; }
                .items-table .items-type-row { break-after:avoid; }
                .items-table tbody tr.items-first td { border-top:1px solid #bbb; }
                .items-table .items-sub { font-size:9px; margin-top:0; }
              }
            `}</style>
            {filtered.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}
      </div>
    </div>
  )
}
