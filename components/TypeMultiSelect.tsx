'use client'
import { useState, useEffect, useRef } from 'react'

// dropdown เลือกประเภทน้ำยาได้หลายอัน — value=[] หมายถึงทุกประเภท
export default function TypeMultiSelect({ types, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // ปิดเมื่อคลิกข้างนอก
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (t) => onChange(value.includes(t) ? value.filter(x=>x!==t) : [...value, t])

  return (
    <div className="type-dd" ref={ref}>
      <button className={'type-dd-btn'+(value.length?' on':'')} onClick={()=>setOpen(o=>!o)}>
        <span className="type-dd-text">
          {value.length===0 ? 'ทุกประเภท' : value.length===1 ? value[0] : value[0]+' +'+(value.length-1)}
        </span>
        <i className={'ti ti-chevron-'+(open?'up':'down')}></i>
      </button>
      {open && (
        <div className="type-dd-menu">
          <div className="type-dd-head">
            <span>เลือกได้หลายประเภท</span>
            {value.length>0 && <button onClick={()=>onChange([])}>ล้าง</button>}
          </div>
          {types.map(t=>{
            const on = value.includes(t)
            return (
              <div key={t} className={'type-dd-opt'+(on?' on':'')} onClick={()=>toggle(t)}>
                <span className="type-dd-box">{on && <i className="ti ti-check"></i>}</span>
                {t}
              </div>
            )
          })}
        </div>
      )}
      <style>{`
        .type-dd { position:relative; }
        .type-dd-btn { display:flex; align-items:center; justify-content:space-between; gap:10px; height:52px; min-width:220px; max-width:320px; padding:0 15px; background:var(--bg); border:1.5px solid var(--border); border-radius:12px; font-size:15px; font-weight:600; color:var(--text); cursor:pointer; font-family:inherit; }
        .type-dd-btn.on { background:#FFF6E0; border-color:#FFC247; color:#B07A00; font-weight:700; }
        .type-dd-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .type-dd-menu { position:absolute; top:calc(100% + 6px); left:0; z-index:50; background:#fff; border:1.5px solid var(--border); border-radius:14px; box-shadow:0 12px 32px rgba(0,0,0,0.14); padding:6px; min-width:300px; max-height:380px; overflow-y:auto; }
        .type-dd-head { display:flex; justify-content:space-between; align-items:center; padding:6px 10px 8px; font-size:12px; color:var(--muted); font-weight:600; }
        .type-dd-head button { border:none; background:none; color:var(--pink-dark); font-weight:800; font-size:12px; cursor:pointer; font-family:inherit; }
        .type-dd-opt { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:9px; font-size:14px; cursor:pointer; }
        .type-dd-opt:hover { background:var(--bg); }
        .type-dd-opt.on { font-weight:700; color:#B07A00; }
        .type-dd-box { width:18px; height:18px; border-radius:5px; border:1.5px solid #ccd5da; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:13px; }
        .type-dd-opt.on .type-dd-box { background:#FFC247; border-color:#FFC247; color:#fff; }
      `}</style>
    </div>
  )
}
