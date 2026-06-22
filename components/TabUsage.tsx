
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'

function exportCSV(grouped, year) {
  const headers = ['ประเภท','ชื่อน้ำยา', ...MONTHS, 'รวมทั้งปี','เฉลี่ย/เดือน']
  const lines = [headers.map(esc).join(',')]
  grouped.forEach(group => {
    group.items.forEach(it => {
      lines.push([group.type, it.item, ...it.months, it.total, it.avg].map(esc).join(','))
    })
  })
  const blob = new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'})
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'usage_'+year+'_'+new Date().toISOString().slice(0,10)+'.csv'
  a.click()
}

export default function TabUsage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData(year) }, [year])

  async function loadData(y) {
    setLoading(true)
    const [{ data: master }, { data: issues }] = await Promise.all([
      supabase.from('master_items').select('type,item').order('type').order('item'),
      supabase.from('issues').select('type,item,date,qty')
        .gte('date', y+'-01-01').lte('date', y+'-12-31'),
    ])
    if (!master) { setLoading(false); return }

    // find available years from earliest issue (fallback: current year only)
    const { data: allIssues } = await supabase.from('issues').select('date').order('date',{ascending:true}).limit(1)
    const minYear = allIssues && allIssues.length ? Number(String(allIssues[0].date).slice(0,4)) : new Date().getFullYear()
    const curYear = new Date().getFullYear()
    const yrs = []
    for (let yy = curYear; yy >= minYear; yy--) yrs.push(yy)
    setYears(yrs.length ? yrs : [curYear])

    // build usage map: type||item -> [12 months]
    const usageMap = {}
    ;(issues||[]).forEach(r => {
      const k = r.type+'||'+r.item
      const m = Number(String(r.date).slice(5,7)) - 1
      if (!usageMap[k]) usageMap[k] = Array(12).fill(0)
      usageMap[k][m] += Number(r.qty)
    })

    const byType = {}
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const months = usageMap[k] || Array(12).fill(0)
      const total = months.reduce((s,v)=>s+v,0)
      const avg = Math.round((total/12)*10)/10
      if (!byType[m.type]) byType[m.type] = []
      byType[m.type].push({ item:m.item, months, total, avg })
    })

    const result = Object.keys(byType).sort().map(type => ({
      type, items: byType[type],
    }))
    setGrouped(result)
    setLoading(false)
  }

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-report-analytics" style={{ color:'#4A9B7F' }}></i> Usage — การใช้งานรายเดือน</h2>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ fontSize:14, fontWeight:700, background:'#C9E4D8', color:'#4A9B7F', border:'none', padding:'10px 16px', width:'auto' }}>
              {years.map(y=><option key={y} value={y}>ปี {y}</option>)}
            </select>
            <button className="btn btn-teal" onClick={()=>loadData(year)}><i className="ti ti-refresh"></i> รีเฟรช</button>
            <button className="btn btn-purple" onClick={()=>exportCSV(grouped, year)}><i className="ti ti-download"></i> Export CSV</button>
          </div>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>แสดงจำนวนที่เบิกใช้แต่ละเดือน แยกตามประเภทน้ำยา</div>

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
                      {MONTHS.map(m => <th key={m} style={{ textAlign:'center', minWidth:48 }}>{m}</th>)}
                      <th style={{ textAlign:'center', background:'#C9E4D8', color:'#3D7E66' }}>รวมทั้งปี</th>
                      <th style={{ textAlign:'center', background:'#C9E4D8', color:'#3D7E66' }}>เฉลี่ย/เดือน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((it, idx) => (
                      <tr key={group.type+'-'+idx}>
                        <td style={{ fontWeight:600 }}>{it.item}</td>
                        {it.months.map((v,i) => (
                          <td key={i} style={{ textAlign:'center', color: v>0 ? 'var(--text)' : 'var(--muted)', fontWeight: v>0 ? 700 : 400 }}>
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
