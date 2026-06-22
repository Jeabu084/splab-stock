'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function exportCSV(type, item, rows, lotRemain) {
  const lines = []
  lines.push('"Stock Card น้ำยา — SPLABSTOCK"')
  lines.push('"ประเภท","'+type+'"')
  lines.push('"รายการ","'+item+'"')
  lines.push('"วันที่พิมพ์","'+new Date().toLocaleDateString('th-TH')+'"')
  lines.push('')
  lines.push('"วันที่","รับ/เบิก","Lot","Expire","รับ","เบิก","คงเหลือ","ผู้บันทึก"')
  rows.forEach(r=>lines.push([r.date?.slice(0,10),r.action,r.lot,r.expire?.slice(0,10)||'',r.qty_in||'',r.qty_out||'',r.balance,r.user_name].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')))
  lines.push('')
  lines.push('"สรุปคงเหลือต่อ Lot"')
  lines.push('"Lot","Expire","คงเหลือ"')
  lotRemain.forEach(r=>lines.push([r.lot,r.expire||'',r.balance].map(v=>`"${String(v??'')}"`).join(',')))
  const blob = new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'})
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob)
  a.download='stockcard_'+item.replace(/[^a-zA-Zก-๙0-9]/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.csv'; a.click()
}

export default function TabHistory() {
  const [types, setTypes] = useState([])
  const [itemsByType, setItemsByType] = useState({})
  const [selType, setSelType] = useState('')
  const [selItem, setSelItem] = useState('')
  const [rows, setRows] = useState([])
  const [lotRemain, setLotRemain] = useState([])
  const [sumIn, setSumIn] = useState(0)
  const [sumOut, setSumOut] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('master_items').select('type,item').order('type').order('item').then(({data})=>{
      if (!data) return
      const map = {}
      data.forEach(r=>{ if (!map[r.type]) map[r.type]=[]; map[r.type].push(r.item) })
      setItemsByType(map); setTypes(Object.keys(map).sort())
    })
  }, [])

  async function load() {
    if (!selType||!selItem) return
    setLoading(true); setLoaded(false)
    const [ob,rc,is,bal] = await Promise.all([
      supabase.from('opening_balance').select('date,lot,expire,qty,user_name').eq('type',selType).eq('item',selItem),
      supabase.from('receipts').select('date,lot,expire,qty,user_name').eq('type',selType).eq('item',selItem),
      supabase.from('issues').select('date,lot,qty,user_name').eq('type',selType).eq('item',selItem),
      supabase.from('stock_balance').select('lot,expire,balance').eq('type',selType).eq('item',selItem).order('expire'),
    ])
    const combined = [
      ...(ob.data||[]).map(r=>({...r,action:'ยกมา',qty_in:r.qty,qty_out:0})),
      ...(rc.data||[]).map(r=>({...r,action:'รับ',qty_in:r.qty,qty_out:0})),
      ...(is.data||[]).map(r=>({...r,action:'เบิก',qty_in:0,qty_out:r.qty,expire:''})),
    ].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime())
    let bal2=0, sIn=0, sOut=0
    const result = combined.map(r=>{
      bal2 += r.qty_in-r.qty_out
      if (r.action!=='ยกมา') { if(r.qty_in) sIn+=r.qty_in; if(r.qty_out) sOut+=r.qty_out }
      return {...r,balance:bal2}
    })
    setRows(result); setSumIn(sIn); setSumOut(sOut)
    setLotRemain(bal.data||[])
    setLoading(false); setLoaded(true)
  }

  const lastBal = rows.length ? rows[rows.length-1].balance : 0

  return (
    <div>
      <div className="no-print card" style={{ marginBottom:16 }}>
        <h2><i className="ti ti-file-text" style={{ color:'var(--teal-dark)' }}></i> Stock Card น้ำยา</h2>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <select value={selType} onChange={(e)=>{setSelType(e.target.value);setSelItem('');setLoaded(false)}} style={{ width:'auto', minWidth:160 }}>
            <option value="">— เลือกประเภท —</option>
            {types.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select value={selItem} onChange={(e)=>{setSelItem(e.target.value);setLoaded(false)}} style={{ width:'auto', minWidth:200 }}>
            <option value="">— เลือกรายการ —</option>
            {(itemsByType[selType]||[]).map(i=><option key={i} value={i}>{i}</option>)}
          </select>
          <button className="btn btn-teal" onClick={load}><i className="ti ti-eye"></i> แสดง</button>
        </div>
      </div>

      {loaded && (
        <div className="card">
          <div style={{ marginBottom:18 }}>
            <div style={{ fontWeight:800, fontSize:20, color:'var(--text)' }}>Stock Card น้ำยา — SPLABSTOCK</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:10, fontSize:14 }}>
              <div><span style={{ color:'var(--muted)' }}>ประเภท: </span><b>{selType}</b></div>
              <div><span style={{ color:'var(--muted)' }}>รายการ: </span><b>{selItem}</b></div>
              <div><span style={{ color:'var(--muted)' }}>วันที่พิมพ์: </span><b>{new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</b></div>
              <div><span style={{ color:'var(--muted)' }}>คงเหลือปัจจุบัน: </span><b style={{ color:'var(--teal-dark)' }}>{lastBal} หน่วย</b></div>
            </div>
          </div>

          <div className="no-print" style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
            <button className="btn btn-purple" onClick={()=>exportCSV(selType,selItem,rows,lotRemain)}><i className="ti ti-download"></i> Export CSV</button>
            <button className="btn btn-outline" onClick={()=>window.print()}><i className="ti ti-printer"></i> Print</button>
          </div>

          <div style={{ overflowX:'auto', marginBottom:20 }}>
            <table>
              <thead>
                <tr>
                  {['วันที่','รับ/เบิก','Lot','Expire','รับ','เบิก','คงเหลือ','ผู้บันทึก'].map(h=><th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i} style={{ background: r.action==='เบิก' ? 'var(--yellow-bg)' : undefined }}>
                    <td>{String(r.date).slice(0,10)}</td>
                    <td style={{ fontWeight:700, color: r.action==='เบิก'?'#B07A00':r.action==='ยกมา'?'var(--muted)':'var(--pv)' }}>{r.action}</td>
                    <td>{r.lot}</td>
                    <td style={{ color:'var(--muted)' }}>{r.expire?String(r.expire).slice(0,10):'—'}</td>
                    <td style={{ color:'var(--gd)', fontWeight: r.qty_in?700:400 }}>{r.qty_in||''}</td>
                    <td style={{ color:'var(--pink-dark)', fontWeight: r.qty_out?700:400 }}>{r.qty_out||''}</td>
                    <td style={{ fontWeight:800 }}>{r.balance}</td>
                    <td style={{ color:'var(--muted)' }}>{r.user_name}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'var(--bg)' }}>
                  <td colSpan={4} style={{ fontWeight:700, textAlign:'right' }}>รวมรับ</td>
                  <td style={{ fontWeight:800, color:'var(--gd)' }}>{sumIn}</td>
                  <td colSpan={3}/>
                </tr>
                <tr style={{ background:'var(--bg)' }}>
                  <td colSpan={4} style={{ fontWeight:700, textAlign:'right' }}>รวมเบิก</td>
                  <td/>
                  <td style={{ fontWeight:800, color:'var(--pink-dark)' }}>{sumOut}</td>
                  <td colSpan={2}/>
                </tr>
                <tr style={{ background:'var(--pb)' }}>
                  <td colSpan={4} style={{ fontWeight:700, textAlign:'right' }}>คงเหลือสุดท้าย</td>
                  <td colSpan={2}/>
                  <td style={{ fontWeight:800, fontSize:16, color:'var(--pv)' }}>{lastBal}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ background:'var(--pb)', borderRadius:14, padding:'16px 18px' }}>
            <div style={{ fontWeight:800, fontSize:15, color:'var(--pv)', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <i className="ti ti-package"></i> คงเหลือต่อ Lot
            </div>
            {lotRemain.length===0 ? (
              <div style={{ fontSize:13, color:'var(--muted)' }}>ไม่มีคงเหลือ</div>
            ) : (
              <table>
                <thead>
                  <tr>{['Lot','Expire','คงเหลือ'].map(h=><th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lotRemain.map((r,i)=>(
                    <tr key={i}>
                      <td style={{ fontWeight:700 }}>{r.lot}</td>
                      <td style={{ color:'var(--muted)' }}>{r.expire||'—'}</td>
                      <td style={{ fontWeight:800, color:'var(--pv)' }}>{r.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!loaded && !loading && <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>เลือกประเภทและรายการ แล้วกด "แสดง"</div>}
      {loading && <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>กำลังโหลด...</div>}
    </div>
  )
}
