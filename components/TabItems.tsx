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
      supabase.from('master_items').select('type,item,unit').order('type').order('item'),
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
      const lots = balMap[k]||[]
      const unit = unitMap[k]||''
      const price = priceMap[k]
      const total = lots.reduce((s,r)=>s+Number(r.balance),0)
      if (lots.length > 1) {
        result.push({type:m.type,item:m.item,lot:'(รวมทุก Lot)',expire:'',balance:total,unit,unit_price:price,isTotal:true})
        lots.forEach(r=>result.push({...r,unit,unit_price:price,isTotal:false}))
      } else if (lots.length===1) {
        result.push({...lots[0],unit,unit_price:price,isTotal:false})
      } else {
        result.push({type:m.type,item:m.item,lot:'',expire:'',balance:0,unit,unit_price:price,isTotal:false})
      }
    })
    setRows(result)
    setTypes([...new Set(master.map(r=>r.type))].sort())
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    if (!showZero && r.balance===0 && !r.isTotal) return false
    if (typeFilter && r.type!==typeFilter) return false
    if (search && !r.item.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function statusPill(r) {
    if (r.isTotal) return null
    if (r.balance===0) return {label:'หมดสต็อก',cls:'pill-danger'}
    if (!r.expire) return {label:'ไม่มี Exp',cls:'pill-warn'}
    const d = daysUntil(r.expire)
    if (d<=30) return {label:'วิกฤต '+d+'วัน',cls:'pill-danger'}
    if (d<=DAYS_WARN) return {label:'ใกล้หมด '+d+'วัน',cls:'pill-warn'}
    return {label:'ปกติ',cls:'pill-ok'}
  }

  const totalValue = filtered.filter(r=>!rows.some(x=>x.isTotal&&x.type===r.type&&x.item===r.item)||r.isTotal)
    .reduce((s,r)=> s + (r.unit_price ? r.balance*r.unit_price : 0), 0)

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-list-details" style={{ color:'#B07A00' }}></i> รายการน้ำยาทั้งหมด</h2>
          <div className="pill pill-ok" style={{ fontSize:13, padding:'8px 16px' }}>
            มูลค่าคงเหลือรวม: {totalValue.toLocaleString('th-TH',{minimumFractionDigits:2})} บาท
          </div>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>ค้นหา กรองตามประเภท หรือ export ข้อมูลรายการน้ำยาทั้งหมด</div>

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
            <table>
              <thead>
                <tr>
                  {['ประเภท','รายการ','Lot','Expire','คงเหลือ','หน่วย','ราคา/หน่วย','มูลค่า','สถานะ'].map(h=>(
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r,i)=>{
                  const st = statusPill(r)
                  const isSub = !r.isTotal && rows.some(x=>x.isTotal&&x.type===r.type&&x.item===r.item)
                  const value = r.unit_price ? r.balance*r.unit_price : null
                  return (
                    <tr key={i} style={{ background: r.isTotal ? 'var(--pb)' : r.balance===0 ? '#FFF8F8' : undefined }}>
                      <td>{!isSub?r.type:''}</td>
                      <td style={{ fontWeight: r.isTotal?800:600, color: r.isTotal?'var(--pv)':'var(--text)' }}>{!isSub?r.item:''}</td>
                      <td style={{ paddingLeft: isSub?28:undefined, color: r.isTotal?'var(--pv)':'var(--text)', fontStyle: r.isTotal?'italic':'normal' }}>{r.lot||'—'}</td>
                      <td style={{ color:'var(--muted)' }}>{r.expire||'—'}</td>
                      <td style={{ fontWeight:800, color: r.balance===0?'var(--pink-dark)':r.isTotal?'var(--pv)':'var(--text)' }}>{r.balance}</td>
                      <td style={{ color:'var(--muted)' }}>{!isSub?(r.unit||'—'):''}</td>
                      <td style={{ color:'var(--muted)' }}>{!isSub?(r.unit_price!=null?r.unit_price.toLocaleString('th-TH',{minimumFractionDigits:2}):'—'):''}</td>
                      <td style={{ fontWeight:700, color:'var(--pv)' }}>{value!=null?value.toLocaleString('th-TH',{minimumFractionDigits:2}):'—'}</td>
                      <td>{st && <span className={'pill '+st.cls}>{st.label}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}
      </div>
    </div>
  )
}
