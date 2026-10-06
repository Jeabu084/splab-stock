'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FY_MONTHS = [10,11,12,1,2,3,4,5,6,7,8,9]
const MONTH_LABEL = {1:'ม.ค.',2:'ก.พ.',3:'มี.ค.',4:'เม.ย.',5:'พ.ค.',6:'มิ.ย.',7:'ก.ค.',8:'ส.ค.',9:'ก.ย.',10:'ต.ค.',11:'พ.ย.',12:'ธ.ค.'}

function fyDateRange(fy) {
  return { start: String(fy-1)+'-10-01', end: String(fy)+'-10-01' }
}

function currentFY() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 10 ? y + 1 : y
}

// ช่วงเดือนแรกของปีงบ (ต.ค.) ข้อมูลปีงบใหม่ยังน้อย ให้เปิดปีงบที่แล้วเป็นค่าเริ่มต้น
function defaultFY() {
  const cur = currentFY()
  return new Date().getMonth() + 1 === 10 ? cur - 1 : cur
}

// Supabase คืนได้สูงสุด 1000 แถวต่อ request จึงต้องดึงทีละหน้า
async function fetchIssues(start, end) {
  const all = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('issues')
      .select('type,item,date,qty')
      .gte('date', start)
      .lt('date', end)
      .order('date')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  return all
}

const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

function exportCSV(grouped, fy) {
  const headers = ['ประเภท','ชื่อน้ำยา', ...FY_MONTHS.map(m=>MONTH_LABEL[m]), 'รวมทั้งปี','เฉลี่ย/เดือน']
  const lines = [headers.map(esc).join(',')]
  grouped.forEach(group => {
    group.items.forEach(it => {
      lines.push([group.type, it.item, ...it.months, it.total, it.avg].map(esc).join(','))
    })
  })
  const blob = new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'usage_fy'+fy+'_'+new Date().toISOString().slice(0,10)+'.csv'
  a.click()
}

export default function TabUsage() {
  const [fy, setFy] = useState(defaultFY())
  const [fyList, setFyList] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(12)

  useEffect(() => { loadData(fy) }, [fy])

  async function loadData(fiscalYear) {
    setLoading(true)
    const { start, end } = fyDateRange(fiscalYear)

    const [{ data: master }, issues] = await Promise.all([
      supabase.from('master_items').select('type,item').eq('is_hidden',false).order('type').order('item'),
      fetchIssues(start, end),
    ])
    if (!master) { setLoading(false); return }

    const { data: fi } = await supabase.from('issues').select('date').order('date',{ascending:true}).limit(1)
    if (fi && fi.length) {
      const fd = new Date(fi[0].date)
      const fFY = fd.getMonth() >= 9 ? fd.getFullYear()+1 : fd.getFullYear()
      const cur = currentFY()
      const list = []
      for (let f = cur; f >= fFY; f--) list.push(f)
      setFyList(list.length ? list : [cur])
    } else {
      setFyList([currentFY()])
    }

    const now = new Date()
    const cur = currentFY()
    let el = 12
    if (fiscalYear === cur) {
      const s = new Date(String(fiscalYear-1)+'-10-01')
      el = Math.min(12, Math.max(1, Math.ceil((now.getTime() - s.getTime()) / (1000*60*60*24*30.44))))
    }
    setElapsed(el)

    const umap = {}
    issues.forEach(r => {
      const d = String(r.date).slice(0,10)
      if (d < start || d >= end) return
      const k = r.type+'||'+r.item
      const m = parseInt(d.slice(5,7), 10)
      if (!umap[k]) umap[k] = {}
      umap[k][m] = (umap[k][m]||0) + Number(r.qty)
    })

    const bt = {}
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const md = umap[k] || {}
      const months = FY_MONTHS.map(mn => md[mn] || 0)
      const total = months.reduce((s,v) => s+v, 0)
      const avg = Math.round((total/el)*10)/10
      if (!bt[m.type]) bt[m.type] = []
      bt[m.type].push({ item: m.item, months, total, avg })
    })

    setGrouped(Object.keys(bt).sort().map(type => ({ type, items: bt[type] })))
    setLoading(false)
  }

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-report-analytics" style={{ color:'#4A9B7F' }}></i> Usage</h2>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={fy} onChange={e=>setFy(Number(e.target.value))} style={{ fontSize:14, fontWeight:700, background:'#C9E4D8', color:'#4A9B7F', border:'none', padding:'10px 16px', width:'auto' }}>
              {fyList.map(f=><option key={f} value={f}>ปีงบ {f} (ต.ค.{f-1}-ก.ย.{f})</option>)}
            </select>
            <button className="btn btn-teal" onClick={()=>loadData(fy)}><i className="ti ti-refresh"></i> รีเฟรช</button>
            <button className="btn btn-purple" onClick={()=>exportCSV(grouped,fy)}><i className="ti ti-download"></i> Export CSV</button>
          </div>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
          ปีงบประมาณ ต.ค.-ก.ย. <span style={{ color:'#4A9B7F', fontWeight:700, marginLeft:8 }}>เฉลี่ย {elapsed} เดือน</span>
        </div>
        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            {grouped.map(group => (
              <div key={group.type}>
                <div className="ov-section-title">{group.type}</div>
                <table style={{ minWidth:1100 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth:160 }}>ชื่อน้ำยา</th>
                      {FY_MONTHS.map(m => <th key={m} style={{ textAlign:'center', minWidth:48 }}>{MONTH_LABEL[m]}</th>)}
                      <th style={{ textAlign:'center', background:'#C9E4D8', color:'#3D7E66' }}>รวม</th>
                      <th style={{ textAlign:'center', background:'#C9E4D8', color:'#3D7E66' }}>เฉลี่ย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((it, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight:600 }}>{it.item}</td>
                        {it.months.map((v,j) => (
                          <td key={j} style={{ textAlign:'center', color: v>0?'var(--text)':'var(--muted)', fontWeight: v>0?700:400 }}>
                            {v>0 ? v : '—'}
                          </td>
                        ))}
                        <td style={{ textAlign:'center', fontWeight:800, color:'#3D7E66', background:'#EFF8F3' }}>{it.total}</td>
                        <td style={{ textAlign:'center', fontWeight:800, color:'#3D7E66', background:'#EFF8F3' }}>{it.avg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {grouped.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}
      </div>
    </div>
  )
}