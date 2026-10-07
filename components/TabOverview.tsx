'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import PrintButton from '@/components/PrintButton'

const TYPE_COLORS = ['var(--pb)', 'var(--pink-light)', 'var(--yellow-bg)', 'var(--teal-bg)', 'var(--bb)', 'var(--gb)']
const DAYS_WARN = 90

// จำนวนวันจากวันนี้ถึงวันหมดอายุ (ติดลบ = หมดอายุแล้ว)
function daysLeft(exp) {
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((new Date(exp+'T00:00:00').getTime() - t.getTime()) / 86400000)
}

const ALERTS = [
  { key:'expired', label:'หมดอายุแล้ว',            icon:'ti-alert-octagon',  fg:'#fff',             bg:'#C0392B',        unit:'Lot' },
  { key:'near',    label:'ใกล้หมดอายุ ('+DAYS_WARN+' วัน)', icon:'ti-hourglass-low', fg:'#B07A00', bg:'var(--yellow-bg)', unit:'Lot' },
  { key:'low',     label:'เหลือน้อย (≤ ขั้นต่ำ)',   icon:'ti-trending-down',  fg:'#C2410C',          bg:'#FFEDD5',        unit:'รายการ' },
  { key:'zero',    label:'หมดสต็อก',               icon:'ti-package-off',    fg:'var(--pink-dark)', bg:'var(--pink-light)', unit:'รายการ' },
]

export default function TabOverview() {
  const [grouped, setGrouped] = useState([])
  const [alerts, setAlerts] = useState({ expired:[], near:[], low:[], zero:[] })
  const [openAlert, setOpenAlert] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoverKey, setHoverKey] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: master }, { data: bal }] = await Promise.all([
      supabase.from('master_items').select('type,item,unit,min_stock').eq('is_hidden',false).order('type').order('item'),
      supabase.from('stock_balance').select('type,item,lot,expire,balance').order('type').order('item').order('expire'),
    ])
    if (!master) { setLoading(false); return }

    const balMap = {}
    ;(bal||[]).forEach(r => {
      const k = r.type+'||'+r.item
      if (!balMap[k]) balMap[k]=[]
      balMap[k].push(r)
    })

    const al = { expired:[], near:[], low:[], zero:[] }
    const byType = {}
    master.forEach(m => {
      const k = m.type+'||'+m.item
      const lots = (balMap[k]||[]).filter(r => Number(r.balance) > 0)
      const total = lots.reduce((s,r)=>s+Number(r.balance),0)
      const min = Number(m.min_stock) || 0
      let status = null
      lots.forEach(l => {
        if (!l.expire) return
        const d = daysLeft(l.expire)
        const row = { type:m.type, item:m.item, unit:m.unit, lot:l.lot, expire:l.expire, balance:Number(l.balance), days:d }
        if (d < 0) { al.expired.push(row); status = 'expired' }
        else if (d <= DAYS_WARN) { al.near.push(row); status ||= 'near' }
      })
      if (total === 0) { al.zero.push({ type:m.type, item:m.item, unit:m.unit }); status = 'zero' }
      else if (min > 0 && total <= min) { al.low.push({ type:m.type, item:m.item, unit:m.unit, total, min }); status ||= 'low' }
      if (!byType[m.type]) byType[m.type] = []
      byType[m.type].push({ item:m.item, total, lots, status })
    })
    al.expired.sort((a,b)=>a.days-b.days)
    al.near.sort((a,b)=>a.days-b.days)

    setAlerts(al)
    setGrouped(Object.keys(byType).sort().map(type => ({ type, items: byType[type] })))
    setLoading(false)
  }

  const cur = ALERTS.find(a => a.key===openAlert)
  const list = openAlert ? alerts[openAlert] : []

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:10, flexWrap:'wrap' }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-layout-grid" style={{ color:'var(--gd)' }}></i> Overview — คงเหลือทั้งหมด</h2>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-teal no-print" onClick={loadData}><i className="ti ti-refresh"></i> รีเฟรช</button>
            <PrintButton fileName={'Overview_คงเหลือ_'+new Date().toISOString().slice(0,10)} />
          </div>
        </div>
        <div className="print-only" style={{ fontSize:10, color:'#555', marginBottom:6 }}>
          ยอด ณ วันที่ {new Date().toLocaleDateString('th-TH',{ day:'numeric', month:'long', year:'numeric' })}
        </div>
        <div className="no-print" style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>กดที่กล่องแจ้งเตือนเพื่อดูรายชื่อน้ำยา · วางเมาส์ที่การ์ดเพื่อดูรายละเอียดแยกตาม Lot</div>

        {!loading && (
          <div className="ov-alerts">
            {ALERTS.map(a => {
              const n = alerts[a.key].length
              const on = openAlert===a.key
              return (
                <button key={a.key} className={'ov-alert'+(on?' on':'')+(n===0?' none':'')} style={{ '--afg':a.fg, '--abg':a.bg } as any}
                        onClick={()=>setOpenAlert(on ? null : a.key)} disabled={n===0}>
                  <i className={'ti '+a.icon}></i>
                  <div>
                    <div className="ov-alert-n">{n} <span>{a.unit}</span></div>
                    <div className="ov-alert-l">{a.label}</div>
                  </div>
                  {n>0 && <i className={'ti ti-chevron-'+(on?'up':'down')+' ov-alert-chev no-print'}></i>}
                </button>
              )
            })}
          </div>
        )}

        {cur && list.length>0 && (
          <div className="ov-alert-panel" style={{ '--afg':cur.fg, '--abg':cur.bg } as any}>
            <div className="ov-alert-panel-h">
              <b><i className={'ti '+cur.icon}></i> {cur.label} — {list.length} {cur.unit}</b>
              <button className="no-print" onClick={()=>setOpenAlert(null)}><i className="ti ti-x"></i></button>
            </div>
            <table>
              <thead>
                {openAlert==='expired' || openAlert==='near'
                  ? <tr><th>ประเภท</th><th>รายการ</th><th>Lot</th><th>วันหมดอายุ</th><th>{openAlert==='expired'?'หมดมาแล้ว':'เหลืออีก'}</th><th style={{ textAlign:'right' }}>คงเหลือ</th></tr>
                  : openAlert==='low'
                  ? <tr><th>ประเภท</th><th>รายการ</th><th style={{ textAlign:'right' }}>คงเหลือ</th><th style={{ textAlign:'right' }}>ขั้นต่ำ</th></tr>
                  : <tr><th>ประเภท</th><th>รายการ</th><th>หน่วย</th></tr>}
              </thead>
              <tbody>
                {list.map((r,i) => (
                  openAlert==='expired' || openAlert==='near' ? (
                    <tr key={i}>
                      <td className="muted">{r.type}</td><td><b>{r.item}</b></td><td>{r.lot}</td><td>{r.expire}</td>
                      <td><b style={{ color: r.days<0 || r.days<=30 ? '#C0392B' : '#B07A00' }}>{Math.abs(r.days)} วัน</b></td>
                      <td style={{ textAlign:'right' }}><b>{r.balance}</b> <span className="muted">{r.unit}</span></td>
                    </tr>
                  ) : openAlert==='low' ? (
                    <tr key={i}>
                      <td className="muted">{r.type}</td><td><b>{r.item}</b></td>
                      <td style={{ textAlign:'right' }}><b style={{ color:'#C2410C' }}>{r.total}</b> <span className="muted">{r.unit}</span></td>
                      <td style={{ textAlign:'right' }} className="muted">{r.min}</td>
                    </tr>
                  ) : (
                    <tr key={i}><td className="muted">{r.type}</td><td><b>{r.item}</b></td><td className="muted">{r.unit||'—'}</td></tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <div>
            {grouped.map((group, gIdx) => (
              <div key={group.type} className="ov-group">
                <div className="ov-section-title">{group.type}</div>
                <div className="ov-grid">
                  {group.items.map((it, idx) => {
                    const cardKey = group.type+'-'+idx
                    return (
                      <div
                        key={cardKey}
                        className={'ov-card'+(it.status?' st-'+it.status:'')}
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

      <style>{`
        .ov-alerts { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
        .ov-alert { display:flex; align-items:center; gap:12px; text-align:left; border:1.5px solid transparent; background:var(--abg); color:var(--afg); border-radius:16px; padding:14px 16px; cursor:pointer; font-family:inherit; transition:all .15s; }
        .ov-alert > i:first-child { font-size:28px; }
        .ov-alert:hover:not(:disabled) { transform:translateY(-2px); box-shadow:var(--shadow-md); }
        .ov-alert.on { border-color:var(--afg); box-shadow:var(--shadow-md); }
        .ov-alert.none { opacity:.45; cursor:default; }
        .ov-alert-n { font-size:24px; font-weight:900; line-height:1.1; }
        .ov-alert-n span { font-size:13px; font-weight:700; }
        .ov-alert-l { font-size:13px; font-weight:700; }
        .ov-alert-chev { margin-left:auto; font-size:18px; }
        .ov-alert-panel { border:1.5px solid var(--afg); border-radius:16px; padding:12px 14px; margin-bottom:18px; }
        .ov-alert-panel-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; color:var(--text); }
        .ov-alert-panel-h b { display:flex; align-items:center; gap:6px; }
        .ov-alert-panel-h button { border:none; background:none; font-size:18px; cursor:pointer; color:var(--muted); }
        .ov-alert-panel .muted { color:var(--muted); }
        .ov-card.st-expired, .ov-card.st-zero { border-color:#E7A1A1; }
        .ov-card.st-near, .ov-card.st-low { border-color:#F3C77A; }
        @media (max-width:900px) { .ov-alerts { grid-template-columns:repeat(2,1fr); } }

        :where(html.pg-print) {
          .ov-alerts { grid-template-columns:repeat(4,1fr)!important; gap:6px; margin-bottom:8px; }
          .ov-alert { padding:6px 8px; border-radius:8px; gap:6px; }
          .ov-alert > i:first-child { font-size:16px; }
          .ov-alert-n { font-size:13px; }
          .ov-alert-n span, .ov-alert-l { font-size:9px; }
          .ov-alert.none { opacity:1; }
          .ov-alert-panel { border-radius:8px; padding:6px 8px; margin-bottom:10px; break-inside:auto; }
          .ov-grid { grid-template-columns:repeat(6,1fr); gap:4px; }
          .ov-card { padding:5px 4px; border-radius:6px; break-inside:avoid; }
          .ov-card-name { font-size:8.5px; min-height:0; margin-bottom:2px; }
          .ov-card-value { font-size:13px; }
          .ov-section-title { font-size:11px; margin:8px 0 4px; break-after:avoid; }
          .ov-tooltip { display:none; }
        }
      `}</style>
    </div>
  )
}
