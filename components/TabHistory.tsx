'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import EditMovement from '@/components/EditMovement'
import { useFY, fyRange, currentFY, toBE } from '@/lib/fiscal'
import PrintButton from '@/components/PrintButton'

// 2026-07-24 → 24 ก.ค. 69
const thDate = (d) => d ? new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('th-TH',{ day:'numeric', month:'short', year:'2-digit' }) : ''

function exportCSV(type: string, item: string, rows: any[], lotRemain: any[]) {
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
  const [allRows, setAllRows] = useState([])   // ทุกปี ใช้ตรวจยอด Lot ตอนแก้ไข
  const { fy } = useFY()
  const [lotRemain, setLotRemain] = useState([])
  const [sumIn, setSumIn] = useState(0)
  const [sumOut, setSumOut] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [editing, setEditing] = useState(null)   // { mode, row }
  const [notice, setNotice] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const u = getSession()
    setIsAdmin(u?.role==='admin'); setUserName(u?.full_name||'')
  }, [])

  useEffect(() => {
    supabase.from('master_items').select('type,item').eq('is_hidden',false).order('type').order('item').then(({data})=>{
      if (!data) return
      const map = {}
      data.forEach(r=>{ if (!map[r.type]) map[r.type]=[]; map[r.type].push(r.item) })
      setItemsByType(map); setTypes(Object.keys(map).sort())
    })
  }, [])

  async function load() {
    if (!selType||!selItem) return
    setLoading(true); setLoaded(false)
    const [ob,rc,is,bal,lg] = await Promise.all([
      supabase.from('opening_balance').select('id,date,lot,expire,qty,user_name').eq('type',selType).eq('item',selItem),
      supabase.from('receipts').select('id,date,lot,expire,qty,user_name,invoice_no,unit_price').eq('type',selType).eq('item',selItem),
      supabase.from('issues').select('id,date,lot,qty,user_name').eq('type',selType).eq('item',selItem),
      supabase.from('stock_balance').select('lot,expire,balance').eq('type',selType).eq('item',selItem).order('expire'),
      supabase.from('edit_log').select('*').eq('before->>type',selType).eq('before->>item',selItem).order('edited_at',{ascending:false}).limit(50),
    ])
    const order = { opening_balance:0, receipts:1, issues:2 }
    const combined = [
      ...(ob.data||[]).map(r=>({...r,src:'opening_balance',action:'ยกมา',qty_in:r.qty,qty_out:0})),
      ...(rc.data||[]).map(r=>({...r,src:'receipts',action:'รับ',qty_in:r.qty,qty_out:0})),
      ...(is.data||[]).map(r=>({...r,src:'issues',action:'เบิก',qty_in:0,qty_out:r.qty,expire:''})),
    ].sort((a,b)=>String(a.date).localeCompare(String(b.date)) || order[a.src]-order[b.src] || a.id-b.id)
    let bal2=0
    const result = combined.map(r=>{ bal2 += r.qty_in-r.qty_out; return {...r,balance:bal2} })

    // แสดงเฉพาะปีงบที่เลือก เริ่มด้วยยอดยกมา
    const { start, end } = fyRange(fy)
    const before = result.filter(r => String(r.date).slice(0,10) < start)
    const inYear = result.filter(r => { const d = String(r.date).slice(0,10); return d >= start && d < end })
    const carry = { src:'carry', action:'ยกมา', date:start, lot:'—', expire:'', qty_in:0, qty_out:0,
      balance: before.length ? before[before.length-1].balance : 0, user_name:'ยอดยกมาจากปีงบ '+(toBE(fy)-1) }
    let sIn=0, sOut=0
    inYear.forEach(r => { if (r.action!=='ยกมา') { sIn+=r.qty_in; sOut+=r.qty_out } })
    setAllRows(result)
    setRows([carry, ...inYear]); setSumIn(sIn); setSumOut(sOut)
    setLotRemain(bal.data||[])
    setLogs(lg.data||[])
    setLoading(false); setLoaded(true)
  }

  // เปลี่ยนปีงบจากหัวเว็บแล้วโหลดใหม่
  useEffect(() => { if (loaded) load() }, [fy])

  const lastBal = rows.length ? rows[rows.length-1].balance : 0
  const balLabel = fy < currentFY() ? 'คงเหลือ ณ สิ้นปีงบ '+toBE(fy) : 'คงเหลือปัจจุบัน'

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
        <div className="card sc-print">
          <div className="sc-head" style={{ marginBottom:18 }}>
            <div style={{ fontWeight:800, fontSize:20, color:'var(--text)' }}>Stock Card น้ำยา — SPLABSTOCK</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12, fontSize:15 }}>
              <div><span className="lbl">ประเภท: </span><b>{selType}</b></div>
              <div><span className="lbl">รายการ: </span><b>{selItem}</b></div>
              <div><span className="lbl">ปีงบประมาณ: </span><b>{toBE(fy)}</b> <span className="lbl" style={{ fontWeight:500, fontSize:12 }}>(1 ต.ค.{toBE(fy)-1} – 30 ก.ย.{toBE(fy)})</span></div>
              <div><span className="lbl">วันที่พิมพ์: </span><b>{new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})}</b></div>
              <div><span className="lbl">{balLabel}: </span><b style={{ color:'#2F6B55', fontSize:16 }}>{lastBal}</b></div>
            </div>
          </div>

          <div className="no-print" style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
            <button className="btn btn-purple" onClick={()=>exportCSV(selType,selItem,rows,lotRemain)}><i className="ti ti-download"></i> Export CSV</button>
            <PrintButton fileName={'StockCard_'+selItem+'_ปีงบ'+toBE(fy)} />
          </div>

          {notice && <div className={'pill no-print '+(notice.ok?'pill-ok':'pill-warn')} style={{ display:'block', padding:'10px 14px', fontSize:13, marginBottom:12 }}>{notice.text}</div>}

          <div className="sc-wrap" style={{ overflowX:'auto', marginBottom:20 }}>
            <table className="sc-table">
              <thead>
                <tr>
                  <th>วันที่</th><th>รายการ</th><th>Lot</th><th>วันหมดอายุ</th>
                  <th className="n">รับ</th><th className="n">เบิก</th><th className="n bal-h">คงเหลือ</th><th>ผู้บันทึก</th>
                  {isAdmin && <th className="no-print"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i} className={r.src==='carry' ? 'carry' : undefined}>
                    <td className="date">{thDate(r.date)}</td>
                    <td><span className={'act act-'+(r.action==='รับ'?'in':r.action==='เบิก'?'out':'ob')}>{r.action}</span></td>
                    <td>{r.lot}</td>
                    <td className="muted">{r.expire ? thDate(r.expire) : '—'}</td>
                    <td className="n in">{r.qty_in || ''}</td>
                    <td className="n out">{r.qty_out || ''}</td>
                    <td className="n bal">{r.balance}</td>
                    <td className="muted">{r.user_name}</td>
                    {isAdmin && (
                      <td className="no-print" style={{ whiteSpace:'nowrap', textAlign:'right' }}>
                        {(r.src==='receipts' || r.src==='issues') && <>
                          <button className="sc-edit" title="แก้ไข" onClick={()=>setEditing({ mode:'edit', row:r })}><i className="ti ti-pencil"></i></button>
                          <button className="sc-edit del" title="ลบ" onClick={()=>setEditing({ mode:'delete', row:r })}><i className="ti ti-trash"></i></button>
                        </>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="foot-label">รวมปีงบ {toBE(fy)}</td>
                  <td className="n in">{sumIn}</td>
                  <td className="n out">{sumOut}</td>
                  <td className="n bal">{lastBal}</td>
                  <td colSpan={isAdmin?2:1} className="muted">คงเหลือสุดท้าย</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="sc-lots">
            <div className="sc-lots-h">
              <i className="ti ti-package"></i> คงเหลือต่อ Lot (ปัจจุบัน)
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
                      <td style={{ fontWeight:800, color:'#3D7E66' }}>{r.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="sc-sign">
            <div><div className="sl"></div>ผู้จัดทำ<div style={{ marginTop:6, color:'#444' }}>วันที่ ......../......../........</div></div>
            <div><div className="sl"></div>ผู้ตรวจสอบ / หัวหน้างาน<div style={{ marginTop:6, color:'#444' }}>วันที่ ......../......../........</div></div>
          </div>

          {logs.length>0 && (
            <details className="no-print sc-logs">
              <summary><i className="ti ti-history"></i> ประวัติการแก้ไข/ลบ ({logs.length})</summary>
              <table>
                <thead><tr><th>เมื่อ</th><th>การกระทำ</th><th>ก่อน</th><th>หลัง</th><th>เหตุผล</th><th>โดย</th></tr></thead>
                <tbody>
                  {logs.map(l => {
                    const d = (x) => x ? [String(x.date).slice(0,10), 'Lot '+x.lot, (l.table_name==='issues'?'เบิก ':'รับ ')+x.qty].join(' · ') : '—'
                    return (
                      <tr key={l.id}>
                        <td>{new Date(l.edited_at).toLocaleString('th-TH',{ dateStyle:'short', timeStyle:'short' })}</td>
                        <td>{l.action==='delete' ? <span className="pill pill-danger">ลบ</span> : <span className="pill pill-warn">แก้ไข</span>}</td>
                        <td>{d(l.before)}</td>
                        <td>{d(l.after)}</td>
                        <td>{l.reason}</td>
                        <td>{l.edited_by||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {editing && (
        <EditMovement
          mode={editing.mode} row={editing.row} moves={allRows} userName={userName}
          onClose={()=>setEditing(null)}
          onSaved={(warn)=>{
            setNotice(warn ? { ok:false, text:warn } : { ok:true, text:(editing.mode==='delete'?'ลบ':'แก้ไข')+'รายการเรียบร้อย — ยอดคงเหลือคำนวณใหม่แล้ว' })
            setEditing(null); load()
          }}
        />
      )}

      <style>{`
        .sc-edit { border:1.5px solid var(--border); background:#fff; color:var(--pv); border-radius:8px; width:30px; height:30px; cursor:pointer; margin-left:4px; font-size:15px; display:inline-flex; align-items:center; justify-content:center; }
        .sc-edit:hover { background:var(--pb); }
        .sc-edit.del { color:var(--pink-dark); }
        .sc-edit.del:hover { background:var(--pink-light); }
        .sc-logs { margin-top:16px; background:var(--bg); border-radius:14px; padding:12px 16px; }
        .sc-logs summary { cursor:pointer; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px; }
        .sc-logs table { margin-top:10px; font-size:12px; }
        .sc-sign { display:none; }
        .sc-head .lbl { color:#4d5d66; font-weight:600; }
        .sc-table th { background:#C9E4D8; color:#3D7E66; font-weight:800; font-size:13px; border-bottom:none; white-space:nowrap; }
        .sc-table th:first-child { border-top-left-radius:10px; }
        .sc-table th:last-child { border-top-right-radius:10px; }
        .sc-table th.bal-h { background:#3D7E66; color:#fff; }
        .sc-table .n { text-align:right; white-space:nowrap; }
        .sc-table td { color:var(--text); }
        .sc-table td.date { white-space:nowrap; }
        .sc-table td.muted { color:#6b7c85; }
        .sc-table td.in { color:#3D7E66; font-weight:700; }
        .sc-table td.out { color:var(--pink-dark); font-weight:700; }
        .sc-table td.bal { background:#EFF8F3; color:#2F6B55; font-weight:900; font-size:14px; border-left:2px solid #C9E4D8; }
        .sc-table tr:hover td.bal { background:#EFF8F3; }
        .sc-table tr.carry td { background:#F7F9F8; color:#6b7c85; font-style:italic; }
        .sc-table tr.carry td.bal { background:#E4F2EA; font-style:normal; }
        .sc-table .act { display:inline-block; font-size:11.5px; font-weight:800; border-radius:99px; padding:2px 10px; }
        .sc-table .act-in  { background:#EFF8F3; color:#3D7E66; }
        .sc-table .act-out { background:var(--pink-light); color:var(--pink-dark); }
        .sc-table .act-ob  { background:#EEF1F3; color:#6b7c85; }
        .sc-table tfoot td { border-top:2px solid #C9E4D8; border-bottom:none; font-weight:800; padding-top:10px; padding-bottom:10px; }
        .sc-table tfoot td.foot-label { text-align:right; color:var(--text); }
        .sc-table tfoot td.bal { font-size:16px; }
        .sc-lots { border:1.5px solid #C9E4D8; border-radius:14px; padding:14px 16px; }
        .sc-lots-h { font-weight:800; font-size:15px; color:#3D7E66; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
        :where(html.pg-print) {
          .sc-print .sc-head { margin-bottom:8px!important; }
          .sc-print .sc-head > div:first-child { font-size:15pt!important; text-align:center; }
          .sc-print .sc-head > div:nth-child(2) { font-size:10pt!important; margin-top:6px!important; gap:2px 16px!important; }
          .sc-wrap { overflow:visible!important; margin-bottom:10px!important; }
          .sc-table thead { display:table-header-group; }
          .sc-table th { font-size:10pt; padding:4px 6px; border-radius:0!important; }
          .sc-table td { font-size:10pt; padding:3px 6px; border-bottom:1px solid #ddd; }
          .sc-table td.muted { color:#444; }
          .sc-table .act { font-size:8.5pt; padding:0 6px; }
          .sc-table tr { break-inside:avoid; }
          .sc-table tfoot td { font-size:10.5pt; border-top:1px solid #999; }
          .sc-lots { border-radius:0; padding:6px 8px; break-inside:avoid; }
          .sc-lots > div:first-child { font-size:11pt!important; margin-bottom:4px!important; }
          .sc-lots td, .sc-lots th { font-size:10pt; padding:3px 6px; }
          .sc-sign { display:flex; justify-content:space-around; margin-top:24px; font-size:10.5pt; text-align:center; break-inside:avoid; }
          .sc-sign .sl { width:60mm; border-bottom:1px dotted #000; height:14mm; margin-bottom:4px; }
        }
      `}</style>

      {!loaded && !loading && <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>เลือกประเภทและรายการ แล้วกด "แสดง"</div>}
      {loading && <div className="card" style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>กำลังโหลด...</div>}
    </div>
  )
}
