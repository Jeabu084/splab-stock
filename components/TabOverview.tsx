'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_COLORS = ['var(--pb)', 'var(--pink-light)', 'var(--yellow-bg)', 'var(--teal-bg)', 'var(--bb)', 'var(--gb)']

export default function TabOverview() {
  const [grouped, setGrouped] = useState([])
  const [loading, setLoading] = useState(true)
  const [hoverKey, setHoverKey] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: master }, { data: bal }] = await Promise.all([
      supabase.from('master_items').select('type,item').eq('is_hidden',false).order('type').order('item'),
      supabase.from('stock_balance').select('type,item,lot,expire,balance').order('type').order('item').order('expire'),
    ])
    if (!master) { setLoading(false); return }

    const balMap = {}
    ;(bal||[]).forEach(r => {
      const k = r.type+'||'+r.item
      if (!balMap[k]) balMap[k]=[]
      balMap[k].push(r)
    })

    const byType = {}
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const lots = (balMap[k]||[]).filter(r => Number(r.balance) > 0)
      const total = lots.reduce((s,r)=>s+Number(r.balance),0)
      if (!byType[m.type]) byType[m.type] = []
      byType[m.type].push({ item:m.item, total, lots })
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
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-layout-grid" style={{ color:'var(--gd)' }}></i> Overview — คงเหลือทั้งหมด</h2>
          <button className="btn btn-teal" onClick={loadData}><i className="ti ti-refresh"></i> รีเฟรช</button>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>วางเมาส์ที่การ์ดเพื่อดูรายละเอียดแยกตาม Lot</div>

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <div>
            {grouped.map((group, gIdx) => (
              <div key={group.type}>
                <div className="ov-section-title">{group.type}</div>
                <div className="ov-grid">
                  {group.items.map((it, idx) => {
                    const cardKey = group.type+'-'+idx
                    return (
                      <div
                        key={cardKey}
                        className="ov-card"
                        style={{ background: TYPE_COLORS[gIdx % TYPE_COLORS.length] }}
                        onMouseEnter={()=>setHoverKey(cardKey)}
                        onMouseLeave={()=>setHoverKey(null)}
                      >
                        <div className="ov-card-name">{it.item}</div>
                        <div className="ov-card-value" style={{ color: it.total===0 ? 'var(--pink-dark)' : 'var(--text)' }}>{it.total}</div>
                        {hoverKey===cardKey && (
                          <div className="ov-tooltip">
                            {it.lots.length===0 ? (
                              <div>ไม่มีคงเหลือ</div>
                            ) : it.lots.map((l,i)=>(
                              <div key={i} style={{ padding:'2px 0' }}>
                                Lot {l.lot} {l.expire?'· Exp '+l.expire:''} — {l.balance}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {grouped.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบรายการ</div>}
          </div>
        )}
      </div>
    </div>
  )
}
