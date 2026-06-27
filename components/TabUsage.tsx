'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// ปีงบประมาณไทย: ต.ค.(m=10) → ก.ย.(m=9) ของปีถัดไป
// เรียงเดือน: 10,11,12,1,2,3,4,5,6,7,8,9
const FY_MONTHS = [10,11,12,1,2,3,4,5,6,7,8,9]
const MONTH_LABEL = {
  1:'ม.ค.',2:'ก.พ.',3:'มี.ค.',4:'เม.ย.',5:'พ.ค.',6:'มิ.ย.',
  7:'ก.ค.',8:'ส.ค.',9:'ก.ย.',10:'ต.ค.',11:'พ.ย.',12:'ธ.ค.'
}

// ปีงบ FY (เช่น 2569) = ต.ค. 2568 – ก.ย. 2569
function fyDateRange(fy) {
  return {
    start: `${fy-1}-10-01`,
    end:   `${fy}-09-30`,
  }
}

// ปีงบปัจจุบัน
function currentFY() {
  const now = new Date()
  const m = now.getMonth() + 1
  const y = now.getFullYear()
  return m >= 10 ? y + 1 : y
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
  a.download = `usage_fy${fy}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

export default function TabUsage() {
  const [fy, setFy] = useState(currentFY())
  const [fyList, setFyList] = useState([])
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthsElapsed, setMonthsElapsed] = useState(12)

  useEffect(() => { loadData(fy) }, [fy])

  async function loadData(fiscalYear) {
    setLoading(true)
    const { start, end } = fyDateRange(fiscalYear)

    const [{ data: master }, { data: issues }] = await Promise.all([
      supabase.from('master_items').select('type,item').order('type').order('item'),
      supabase.from('issues').select('type,item,date,qty').gte('date', start).lte('date', end),
    ])
    if (!master) { setLoading(false); return }

    // สร้าง fyList จากปีงบที่มีข้อมูล
    const { data: firstIssue } = await supabase.from('issues').select('date').order('date',{ascending:true}).limit(1)
    if (firstIssue && firstIssue.length > 0) {
      const firstDate = new Date(firstIssue[0].date)
      const firstFY = firstDate.getMonth() >= 9 ? firstDate.getFullYear()+1 : firstDate.getFullYear()
      const curFY = currentFY()
      const list = []
      for (let f = curFY; f >= firstFY; f--) list.push(f)
      setFyList(list.length ? list : [curFY])
    } else {
      setFyList([currentFY()])
    }

    // คำนวณจำนวนเดือนที่ผ่านมาในปีงบนี้
    const now = new Date()
    const curFY = currentFY()
    let elapsed = 12
    if (fiscalYear === curFY) {
      // นับตั้งแต่ ต.ค. ของปีก่อน ถึงเดือนปัจจุบัน
      const fyStart = new Date(`${fiscalYear-1}-10-01`)
      const diffMs = now - fyStart
      elapsed = Math.max(1, Math.ceil(diffMs / (1000*60*60*24*30.44)))
      elapsed = Math.min(elapsed, 12)
    }
    setMonthsElapsed(elapsed)

    // build usage map: key = type||item, value = {month: qty}
    const usageMap = {}
    ;(issues||[]).forEach(r => {
      const k = r.type+'||'+r.item
      const m = Number(String(r.date).slice(5,7))
      if (!usageMap[k]) usageMap[k] = {}
      usageMap[k][m] = (usageMap[k][m]||0) + Number(r.qty)
    })

    const byType = {}
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const monthData = usageMap[k] || {}
      // เรียงตาม FY_MONTHS: 10,11,12,1,2,...,9
      const months = FY_MONTHS.map(mn => monthData[mn] || 0)
      const total = months.reduce((s,v)=>s+v,0)
      const avg = Math.round((total/elapsed)*10)/10
      if (!byType[m.type]) byType[m.type] = []
      byType[m.type].push({ item:m.item, months, total, avg })
    })

    const result = Object.keys(byType).sort().map(type => ({ type, items: byType[type] }))
    setGrouped(result)
    setLoading(false)
  }

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-report-analytics" style={{ color:'#4A9B7F' }}></i> Usage — การใช้งานรายเดือน</h2>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={fy} onChange={e=>setFy(Number(e.target.value))} style={{ fontSize:14, fontWeight:700, background:'#C9E4D8', color:'#4A9B7F', border:'none', padding:'10px 16px', width:'auto' }}>
              {fyList.map(f=><option key={f} value={f}>ปีงบ {f} (ต.ค.{f-1}–ก.ย.{f})</option>)}
            </select>
            <button className="btn btn-teal" onClick={()=>loadData(fy)}><i className="ti ti-refresh"></i> รีเฟรช</button>
            <button className="btn btn-purple" onClick={()=>exportCSV(grouped, fy)}><i className="ti ti-download"></i> Export CSV</button>
          </div>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
          แสดงจำนวนที่เบิกใช้แต่ละเดือน แยกตามประเภทน้ำยา (ปีงบประมาณ ต.ค.–ก.ย.)
          <span style={{ color:'#4A9B7F', fontWeight:700, marginLeft:8 }}>
            · เฉลี่ยคำนวณจาก {monthsElapsed} เดือน
          </span>
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
