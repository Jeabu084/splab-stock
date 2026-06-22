'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS_WARN = 90
function daysUntil(d) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
const thMonth = {
  '01':'ม.ค.','02':'ก.พ.','03':'มี.ค.','04':'เม.ย.',
  '05':'พ.ค.','06':'มิ.ย.','07':'ก.ค.','08':'ส.ค.',
  '09':'ก.ย.','10':'ต.ค.','11':'พ.ย.','12':'ธ.ค.',
}

export default function TabDashboard() {
  const [summary, setSummary] = useState([])
  const [usage, setUsage] = useState([])
  const [selItem, setSelItem] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthly, setMonthly] = useState([])
  const [topItems, setTopItems] = useState([])
  const [stockValue, setStockValue] = useState(0)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [s, m, rc, is, mi] = await Promise.all([
      supabase.from('stock_summary').select('*'),
      supabase.from('master_items').select('item,unit').order('item'),
      supabase.from('receipts').select('date,qty,type,item,unit_price'),
      supabase.from('issues').select('date,qty,item'),
      supabase.from('master_items').select('type,item'),
    ])
    const summaryData = s.data || []
    setSummary(summaryData)

    const allItems = [...new Set((m.data||[]).map(r=>r.item))]
    setItems(allItems)
    if (allItems.length>0) setSelItem(allItems[0])

    // มูลค่าสต็อกรวม (ใช้ราคาล่าสุดจาก receipts)
    const priceMap = {}
    ;(rc.data||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(r=>{
      const k = r.type+'||'+r.item
      if (r.unit_price!=null && priceMap[k]===undefined) priceMap[k]=Number(r.unit_price)
    })
    const miMap = {}
    ;(mi.data||[]).forEach(r=>{ miMap[r.item]=r.type })
    let totalVal = 0
    summaryData.forEach(r=>{
      const price = priceMap[r.type+'||'+r.item]
      if (price) totalVal += r.total_balance * price
    })
    setStockValue(totalVal)

    // กราฟรับ vs เบิก รายเดือน (6 เดือนล่าสุด)
    const recvMap = {}
    ;(rc.data||[]).forEach(r=>{
      const ym = String(r.date).slice(0,7)
      recvMap[ym] = (recvMap[ym]||0) + r.qty
    })
    const issMap = {}
    ;(is.data||[]).forEach(r=>{
      const ym = String(r.date).slice(0,7)
      issMap[ym] = (issMap[ym]||0) + r.qty
    })
    const allMonths = [...new Set([...Object.keys(recvMap), ...Object.keys(issMap)])].sort().slice(-6)
    setMonthly(allMonths.map(ym=>({ym, recv:recvMap[ym]||0, iss:issMap[ym]||0})))

    // top 5 น้ำยาที่เบิกมากสุด (รวมทุกช่วงเวลา)
    const itemUsage = {}
    ;(is.data||[]).forEach(r=>{ itemUsage[r.item] = (itemUsage[r.item]||0) + r.qty })
    const top = Object.entries(itemUsage).sort((a,b)=>b[1]-a[1]).slice(0,5)
    setTopItems(top)

    setLoading(false)
  }

  useEffect(() => {
    if (!selItem) return
    supabase.from('issues').select('date,qty').eq('item',selItem).then(({data})=>{
      if (!data) return
      const map = {}
      data.forEach(r=>{
        const ym = String(r.date).slice(0,7)
        map[ym] = (map[ym]||0)+r.qty
      })
      const sorted = Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6)
      setUsage(sorted.map(([ym,qty])=>({ym,qty})))
    })
  }, [selItem])

  const near = summary.filter(r=>r.nearest_expire&&daysUntil(r.nearest_expire)<=DAYS_WARN)
    .sort((a,b)=>daysUntil(a.nearest_expire)-daysUntil(b.nearest_expire))
  const outOfStock = summary.filter(r=>r.total_balance===0)
  const normal = summary.filter(r=>r.total_balance>0 && (!r.nearest_expire || daysUntil(r.nearest_expire)>DAYS_WARN))

  const maxU = Math.max(...usage.map(u=>u.qty),1)
  const avgU = usage.length ? Math.round(usage.reduce((s,u)=>s+u.qty,0)/usage.length) : 0
  const maxMonthly = Math.max(...monthly.flatMap(m=>[m.recv,m.iss]),1)
  const maxTop = Math.max(...topItems.map(t=>t[1]),1)

  if (loading) return <div style={{textAlign:'center',padding:64,color:'#9ca3af'}}>กำลังโหลด...</div>

  return (
    <div>
      {/* การ์ดสถานะรวม */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:12,marginBottom:20}}>
        {[
          {label:'รายการทั้งหมด',value:summary.length,color:'#7c6ff6',bg:'#f5f3ff',sub:'รายการ'},
          {label:'ปกติ',value:normal.length,color:'#16a34a',bg:'#f0fdf4',sub:'รายการ'},
          {label:'ใกล้หมดอายุ',value:near.length,color:'#d97706',bg:'#fefce8',sub:'ภายใน 90 วัน'},
          {label:'หมดสต็อก',value:outOfStock.length,color:'#dc2626',bg:'#fef2f2',sub:'รายการ'},
        ].map(m=>(
          <div key={m.label} style={{background:m.bg,borderRadius:14,padding:'16px 18px'}}>
            <div style={{fontSize:12,color:m.color,fontWeight:600,marginBottom:4}}>{m.label}</div>
            <div style={{fontSize:30,fontWeight:800,color:m.color}}>{m.value}</div>
            <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* มูลค่าสต็อก */}
      <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{fontWeight:700,fontSize:15,color:'#2f2c84'}}>💰 มูลค่าสต็อกคงเหลือรวม (ตามราคาล่าสุด)</div>
        <div style={{fontSize:24,fontWeight:800,color:'#4c3fbb'}}>{stockValue.toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        {/* น้ำยาใกล้หมดอายุ */}
        <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#2f2c84',marginBottom:12}}>
            ⚠️ น้ำยาใกล้หมดอายุ
            <span style={{marginLeft:8,background:'#fef2f2',color:'#dc2626',padding:'2px 8px',borderRadius:99,fontSize:12}}>{near.length} รายการ</span>
          </div>
          {near.slice(0,6).map((r,i)=>{
            const d = daysUntil(r.nearest_expire)
            return (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #f3f0ff'}}>
                <div style={{width:8,height:8,borderRadius:50,background:d<=30?'#dc2626':'#f59e0b',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{r.item}</div>
                  <div style={{fontSize:11,color:'#9ca3af'}}>Exp {r.nearest_expire} · เหลือ {d} วัน</div>
                </div>
              </div>
            )
          })}
          {near.length===0&&<div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:16}}>ไม่มีน้ำยาใกล้หมดอายุ 🎉</div>}
        </div>

        {/* หมดสต็อก */}
        <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#2f2c84',marginBottom:12}}>
            🚫 น้ำยาหมดสต็อก
            <span style={{marginLeft:8,background:'#fef2f2',color:'#dc2626',padding:'2px 8px',borderRadius:99,fontSize:12}}>{outOfStock.length} รายการ</span>
          </div>
          {outOfStock.slice(0,6).map((r,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #f3f0ff'}}>
              <div style={{width:8,height:8,borderRadius:50,background:'#dc2626',flexShrink:0}}/>
              <div style={{fontSize:13,fontWeight:500}}>{r.type} — {r.item}</div>
            </div>
          ))}
          {outOfStock.length===0&&<div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:16}}>ไม่มีน้ำยาหมดสต็อก 🎉</div>}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        {/* กราฟรับ vs เบิก รายเดือน */}
        <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#2f2c84',marginBottom:12}}>📦 กราฟรับ vs เบิก รายเดือน</div>
          {monthly.length>0 ? (
            <>
              <div style={{display:'flex',alignItems:'flex-end',gap:10,height:120}}>
                {monthly.map((m,i)=>{
                  const mm = m.ym.split('-')[1]
                  const hR = Math.round((m.recv/maxMonthly)*100)
                  const hI = Math.round((m.iss/maxMonthly)*100)
                  return (
                    <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{display:'flex',gap:3,alignItems:'flex-end',height:100,width:'100%',justifyContent:'center'}}>
                        <div style={{width:'40%',height:hR,background:'#16a34a',borderRadius:'3px 3px 0 0'}} title={'รับ '+m.recv}/>
                        <div style={{width:'40%',height:hI,background:'#dc2626',borderRadius:'3px 3px 0 0'}} title={'เบิก '+m.iss}/>
                      </div>
                      <div style={{fontSize:10,color:'#9ca3af'}}>{thMonth[mm]||mm}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',gap:16,marginTop:10,fontSize:12,color:'#6b7280'}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,background:'#16a34a',borderRadius:2}}/> รับ</div>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,background:'#dc2626',borderRadius:2}}/> เบิก</div>
              </div>
            </>
          ) : <div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:24}}>ยังไม่มีข้อมูล</div>}
        </div>

        {/* Top 5 น้ำยาที่ใช้มากสุด */}
        <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px'}}>
          <div style={{fontWeight:700,fontSize:15,color:'#2f2c84',marginBottom:12}}>🏆 Top 5 น้ำยาที่ใช้มากสุด (ตลอดเวลา)</div>
          {topItems.length>0 ? topItems.map(([item,qty],i)=>(
            <div key={i} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                <span style={{fontWeight:500}}>{i+1}. {item}</span>
                <span style={{fontWeight:700,color:'#7c6ff6'}}>{qty}</span>
              </div>
              <div style={{background:'#ede9fe',borderRadius:99,height:8,overflow:'hidden'}}>
                <div style={{width:(qty/maxTop*100)+'%',height:'100%',background:'#7c6ff6',borderRadius:99}}/>
              </div>
            </div>
          )) : <div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:24}}>ยังไม่มีข้อมูล</div>}
        </div>
      </div>

      {/* การใช้งานรายเดือนของรายการที่เลือก */}
      <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'18px 20px'}}>
        <div style={{fontWeight:700,fontSize:15,color:'#2f2c84',marginBottom:4}}>📈 การใช้งานรายเดือน (เลือกรายการ)</div>
        <select value={selItem} onChange={e=>setSelItem(e.target.value)}
          style={{fontSize:12,padding:'4px 8px',border:'1px solid #e5e7eb',borderRadius:8,marginBottom:12,color:'#7c6ff6',background:'#f5f3ff'}}>
          {items.map(i=><option key={i} value={i}>{i}</option>)}
        </select>
        {usage.length>0 ? (
          <>
            <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
              {usage.map((u,i)=>{
                const mm = u.ym.split('-')[1]
                const h = Math.round((u.qty/maxU)*90)
                return (
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{fontSize:10,color:'#6b7280',fontWeight:600}}>{u.qty}</div>
                    <div style={{width:'100%',height:h,background:'#7c6ff6',borderRadius:'4px 4px 0 0',opacity:i===usage.length-1?0.6:1}}/>
                    <div style={{fontSize:10,color:'#9ca3af'}}>{thMonth[mm]||mm}</div>
                  </div>
                )
              })}
            </div>
            <div style={{fontSize:12,color:'#9ca3af',marginTop:8}}>เฉลี่ย <b style={{color:'#374151'}}>{avgU} หน่วย/เดือน</b></div>
          </>
        ) : <div style={{fontSize:13,color:'#9ca3af',textAlign:'center',padding:24}}>ยังไม่มีข้อมูลการเบิก</div>}
      </div>
    </div>
  )
}
