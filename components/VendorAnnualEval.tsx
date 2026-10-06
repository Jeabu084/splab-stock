'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const CRITERIA = [
  'คุณภาพน้ำยา/สินค้า/บริการ ได้มาตรฐานผ่านการรับรอง',
  'บนกล่องที่บรรจุผลิตภัณฑ์ มีรายละเอียดต่างๆ ระบุไว้อย่างชัดเจน',
  'รายการสั่งซื้อมีวันหมดอายุไม่น้อยกว่า 1 ปี ยกเว้นงานโลหิตวิทยา',
  'ใช้ปฏิบัติงานได้ตาม Specification ที่ผู้ขายได้ให้ไว้',
  'ส่งสินค้าถูกต้องตรงตามรายการสั่งซื้อเอกสารใบเสนอราคา/ใบส่ง ถูกต้องครบถ้วนตามที่ตกลงกันไว้',
  'ส่งมอบน้ำยา/สินค้า/บริการตามรายการสั่งภายในเวลาที่กำหนด',
  'การบรรจุสินค้าเพื่อไม่ให้เกิดความเสียหายระหว่างการขนส่งและอุณหภูมินำส่ง ถูกต้องตามกำหนดบนข้างกล่องบรรจุ',
  'สามารถส่งมอบสินค้าได้ในกรณีเร่งด่วน',
  'การบริการหลังการขาย',
  'ผู้แทนขายสามารถแก้ไขปัญหาของลูกค้า',
]
const SCALE = [
  { v:10, label:'มากที่สุด' },
  { v:8,  label:'มาก' },
  { v:6,  label:'ปานกลาง' },
  { v:4,  label:'พอใช้' },
  { v:2,  label:'ควรปรับปรุง' },
]
const PASS_SCORE = 80
const SKEYS = CRITERIA.map((_,i) => 's'+(i+1))

function currentFY() {
  const d = new Date()
  return d.getMonth()+1 >= 10 ? d.getFullYear()+1 : d.getFullYear()
}
// ต.ค.–ธ.ค. มักเป็นช่วงสรุปปีงบที่เพิ่งจบ
function defaultFY() {
  return new Date().getMonth()+1 >= 10 ? currentFY()-1 : currentFY()
}
const today = () => {
  const d = new Date()
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
const dmyBE = (s) => {
  if (!s) return ''
  const [y,m,d] = s.split('-').map(Number)
  return d+'/'+m+'/'+(y+543)
}

function SignaturePad({ value, onChange, disabled }) {
  const ref = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const c = ref.current
    const ctx = c.getContext('2d')
    ctx.clearRect(0,0,c.width,c.height)
    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img,0,0,c.width,c.height)
      img.src = value
    }
  }, [value])

  function pos(e) {
    const r = ref.current.getBoundingClientRect()
    return { x:(e.clientX-r.left)*(ref.current.width/r.width), y:(e.clientY-r.top)*(ref.current.height/r.height) }
  }
  function down(e) {
    if (disabled) return
    drawing.current = true
    ref.current.setPointerCapture(e.pointerId)
    const ctx = ref.current.getContext('2d')
    const p = pos(e)
    ctx.beginPath(); ctx.moveTo(p.x,p.y)
  }
  function move(e) {
    if (!drawing.current) return
    const ctx = ref.current.getContext('2d')
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a237e'
    const p = pos(e)
    ctx.lineTo(p.x,p.y); ctx.stroke()
  }
  function up() {
    if (!drawing.current) return
    drawing.current = false
    onChange(ref.current.toDataURL('image/png'))
  }

  return (
    <canvas
      ref={ref} width={600} height={180}
      className={'sig-pad'+(disabled?' disabled':'')+(value?' has-sig':'')}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
    />
  )
}

const EMPTY_FORM = { scores:{}, suggestion:'', evaluator_name:'', pos1:'', pos2:'', signature:'', eval_date:today() }

export default function VendorAnnualEval({ isAdmin, userName }) {
  const [fy, setFy] = useState(defaultFY())
  const [vendors, setVendors] = useState([])
  const [evals, setEvals] = useState({})
  const [billRef, setBillRef] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const fyList = []
  for (let f = currentFY(); f >= currentFY()-4; f--) fyList.push(f)

  useEffect(() => { load() }, [fy])

  // ตอนเปิดฟอร์ม ให้สั่งพิมพ์ออกมาเฉพาะแผ่น A4
  useEffect(() => {
    if (!open) return
    document.body.classList.add('print-annual')
    return () => document.body.classList.remove('print-annual')
  }, [open])

  async function load() {
    setLoading(true); setLoadErr('')
    const start = (fy-1)+'-10-01', end = fy+'-10-01'
    const [{ data: v }, { data: ev, error: evErr }, { data: bills }] = await Promise.all([
      supabase.from('vendors').select('id,name').eq('is_active',true).order('name'),
      supabase.from('vendor_annual_evals').select('*').eq('fiscal_year',fy),
      supabase.from('vendor_scores').select('vendor_id,score_delivery,score_leadtime,score_expiry,score_coldchain,score_quality,score_defect,score_service').gte('date',start).lt('date',end),
    ])
    if (evErr) setLoadErr('ยังไม่พบตาราง vendor_annual_evals — กรุณารันไฟล์ supabase/vendor_annual_evals.sql ใน Supabase SQL Editor ก่อน ('+evErr.message+')')
    setVendors(v||[])
    const em = {}
    ;(ev||[]).forEach(r => { em[r.vendor_id] = r })
    setEvals(em)
    const bm = {}
    ;(bills||[]).forEach(b => {
      const s = ['score_delivery','score_leadtime','score_expiry','score_coldchain','score_quality','score_defect','score_service'].reduce((t,k)=>t+(Number(b[k])||0),0)
      if (!bm[b.vendor_id]) bm[b.vendor_id] = { n:0, sum:0 }
      bm[b.vendor_id].n++; bm[b.vendor_id].sum += s
    })
    setBillRef(bm)
    setLoading(false)
  }

  function openForm(v) {
    const e = evals[v.id]
    if (e) {
      const [pos1='', pos2=''] = (e.evaluator_position||'').split('\n')
      setForm({
        scores: Object.fromEntries(SKEYS.map(k => [k, e[k]])),
        suggestion: e.suggestion||'', evaluator_name: e.evaluator_name||'',
        pos1, pos2, signature: e.signature||'', eval_date: e.eval_date||today(),
      })
    } else {
      setForm({ ...EMPTY_FORM, eval_date: today() })
    }
    setMsg(null)
    setOpen(v)
  }

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }))
  const total = SKEYS.reduce((s,k) => s+(form.scores[k]||0), 0)
  const allScored = SKEYS.every(k => form.scores[k])
  const passed = total >= PASS_SCORE

  async function save() {
    if (!allScored) { setMsg({ ok:false, text:'กรุณาให้คะแนนให้ครบทั้ง 10 ข้อ' }); return }
    if (!form.evaluator_name.trim()) { setMsg({ ok:false, text:'กรุณากรอกชื่อผู้ประเมิน' }); return }
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('vendor_annual_evals').upsert({
      vendor_id: open.id, fiscal_year: fy, ...form.scores, total, passed,
      suggestion: form.suggestion || null,
      evaluator_name: form.evaluator_name.trim(),
      evaluator_position: [form.pos1, form.pos2].map(s=>s.trim()).filter(Boolean).join('\n') || null,
      signature: form.signature || null,
      eval_date: form.eval_date || null,
      created_by: userName || null,
      updated_at: new Date().toISOString(),
    }, { onConflict:'vendor_id,fiscal_year' })
    setSaving(false)
    if (error) { setMsg({ ok:false, text:'บันทึกไม่สำเร็จ: '+error.message }); return }
    setMsg({ ok:true, text:'บันทึกสรุปประเมินเรียบร้อย — '+total+' คะแนน ('+(passed?'ผ่าน':'ไม่ผ่าน')+')' })
    load()
  }

  const ro = !isAdmin

  return (
    <div className="card" style={{ marginTop:16 }}>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10, marginBottom:6 }}>
        <h2 style={{ marginBottom:0 }}><i className="ti ti-file-certificate" style={{ color:'var(--bd)' }}></i> สรุปประเมินผู้ขายประจำปี</h2>
        <select value={fy} onChange={e=>setFy(Number(e.target.value))} style={{ width:'auto', fontWeight:700, color:'var(--bd)', background:'var(--bb)', border:'none' }}>
          {fyList.map(f => <option key={f} value={f}>ปีงบประมาณ {f+543}</option>)}
        </select>
      </div>
      <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>
        แบบ FM-LA-019 · 10 ข้อ ข้อละ 10 คะแนน · ผ่านเมื่อได้ {PASS_SCORE} คะแนนขึ้นไป
        {!isAdmin && ' · บันทึกสรุปได้เฉพาะ Admin (หัวหน้างาน)'}
      </div>

      {loadErr && <div className="pill pill-danger" style={{ display:'block', padding:'10px 14px', fontSize:12, marginBottom:12 }}>{loadErr}</div>}

      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead>
              <tr><th>ผู้ขาย</th><th>อ้างอิงการประเมินรายบิล</th><th style={{ textAlign:'center' }}>คะแนนประจำปี</th><th>ผล</th><th></th></tr>
            </thead>
            <tbody>
              {vendors.map(v => {
                const e = evals[v.id]
                const b = billRef[v.id]
                return (
                  <tr key={v.id}>
                    <td style={{ fontWeight:700 }}>{v.name}</td>
                    <td style={{ fontSize:12, color:'var(--muted)' }}>
                      {b ? b.n+' บิล · เฉลี่ย '+Math.round(b.sum/(b.n*35)*100)+'%' : '—'}
                    </td>
                    <td style={{ textAlign:'center', fontWeight:800 }}>{e ? e.total+' / 100' : '—'}</td>
                    <td>
                      {e ? <span className={'pill '+(e.passed?'pill-ok':'pill-danger')}>{e.passed?'ผ่าน':'ไม่ผ่าน'}</span>
                         : <span className="pill" style={{ background:'var(--bg)', color:'var(--muted)' }}>ยังไม่ประเมิน</span>}
                    </td>
                    <td style={{ textAlign:'right' }}>
                      <button className={'btn '+(e?'btn-outline':'btn-purple')} style={{ padding:'8px 16px', fontSize:12 }} onClick={()=>openForm(v)}>
                        <i className={'ti '+(e?'ti-file-text':'ti-pencil')}></i> {e ? 'ดู / พิมพ์' : (isAdmin ? 'ประเมิน' : 'ดูแบบฟอร์ม')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {vendors.length===0 && <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่พบผู้ขาย</div>}
        </div>
      )}

      {open && (
        <div className="annual-overlay" onClick={()=>setOpen(null)}>
          <div className="annual-wrap" onClick={e=>e.stopPropagation()}>
            <div className="annual-toolbar no-print">
              <div style={{ fontWeight:800, color:'var(--text)' }}>{open.name} · ปีงบ {fy+543}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {isAdmin && (
                  <button className="btn btn-purple" onClick={save} disabled={saving}>
                    <i className="ti ti-signature"></i> {saving ? 'กำลังบันทึก...' : 'สรุปประเมินโดยหัวหน้างาน'}
                  </button>
                )}
                <button className="btn btn-teal" onClick={()=>window.print()}><i className="ti ti-printer"></i> พิมพ์ A4</button>
                <button className="btn btn-outline" onClick={()=>setOpen(null)}><i className="ti ti-x"></i> ปิด</button>
              </div>
            </div>
            {msg && <div className={'pill no-print '+(msg.ok?'pill-ok':'pill-danger')} style={{ display:'block', padding:'10px 14px', fontSize:13, marginBottom:10 }}>{msg.text}</div>}
            {isAdmin && <div className="no-print annual-hint">คลิกช่องคะแนนเพื่อติ๊ก ✓ · กรอกข้อเสนอแนะ ชื่อ ตำแหน่ง และเซ็นในกรอบลายเซ็นได้เลย</div>}

            <div className="a4-sheet">
              <div className="a4-meta">
                <span>ฉบับที่A</span><span>แก้ไขครั้งที่0</span>
                <span style={{ textAlign:'right' }}>FM-LA-019<br/>วันที่ประกาศใช้ 1 ธ.ค.2565</span>
              </div>
              <div className="a4-title">แบบประเมินผู้ขาย เวชภัณฑ์น้ำยาทางห้องปฏิบัติการ</div>
              <div className="a4-title">ปีงบประมาณ <span className="a4-fill">{fy+543}</span></div>
              <div className="a4-company"><b>ชื่อบริษัท :</b> <span className="a4-fill wide">{open.name}</span></div>

              <table className="a4-table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="crit-h">รายการประเมิน</th>
                    <th colSpan={5}>ระดับคะแนน / ความพึงพอใจ</th>
                  </tr>
                  <tr>
                    {SCALE.map(s => <th key={s.v} className="scale-h">{s.v}<br/><span>{s.label}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {CRITERIA.map((c,i) => {
                    const k = SKEYS[i]
                    return (
                      <tr key={k}>
                        <td className="crit">{i+1}. {c}</td>
                        {SCALE.map(s => (
                          <td key={s.v} className={'cell'+(ro?'':' clickable')+(form.scores[k]===s.v?' on':'')}
                              onClick={()=>!ro && setForm(f=>({ ...f, scores:{ ...f.scores, [k]:s.v } }))}>
                            {form.scores[k]===s.v ? '✓' : ''}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="a4-summary">
                <div><b>รวมคะแนนที่ได้</b> <span className="a4-fill">{allScored ? total : (total || '')}</span> <b>คะแนน</b></div>
                <div><b>เกณฑ์การประเมินผ่าน {PASS_SCORE} คะแนนขึ้นไป</b></div>
                <div className="a4-result">
                  <b>สรุปการประเมิน</b>
                  <span className="a4-box">{allScored && passed ? '✓' : ''}</span> ผ่าน
                  <span className="a4-box" style={{ marginLeft:48 }}>{allScored && !passed ? '✓' : ''}</span> ไม่ผ่าน
                </div>
              </div>

              <div className="a4-suggest">
                <div>ข้อเสนอแนะ</div>
                <textarea className="a4-lines" rows={2} value={form.suggestion} readOnly={ro} onChange={e=>set('suggestion',e.target.value)} />
              </div>

              <div className="a4-sign">
                <div className="sig-row">
                  ผู้ประเมิน
                  <div className="sig-area">
                    {ro
                      ? (form.signature ? <img src={form.signature} alt="ลายเซ็น" /> : null)
                      : <SignaturePad value={form.signature} onChange={v=>set('signature',v)} disabled={ro} />}
                    <div className="sig-line"></div>
                  </div>
                </div>
                {!ro && form.signature && <button className="sig-clear no-print" onClick={()=>set('signature','')}>ล้างลายเซ็น</button>}
                <div>( <input className="a4-input" style={{ width:'60mm' }} placeholder="ชื่อ-นามสกุล หัวหน้างาน" value={form.evaluator_name} readOnly={ro} onChange={e=>set('evaluator_name',e.target.value)} /> )</div>
                <div><input className="a4-input center" style={{ width:'62mm' }} placeholder="ตำแหน่ง" value={form.pos1} readOnly={ro} onChange={e=>set('pos1',e.target.value)} /></div>
                <div><input className="a4-input center" style={{ width:'62mm' }} placeholder="ตำแหน่ง (บรรทัดที่ 2)" value={form.pos2} readOnly={ro} onChange={e=>set('pos2',e.target.value)} /></div>
                <div>
                  ว/ด/ป
                  {ro
                    ? <span className="a4-fill">{dmyBE(form.eval_date)}</span>
                    : <>
                        <span className="a4-fill print-only-inline">{dmyBE(form.eval_date)}</span>
                        <input type="date" className="a4-input no-print" style={{ width:'40mm' }} value={form.eval_date} onChange={e=>set('eval_date',e.target.value)} />
                      </>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .annual-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:100; overflow-y:auto; padding:24px 12px; }
        .annual-wrap { max-width:210mm; margin:0 auto; }
        .annual-toolbar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#fff; border-radius:16px; padding:12px 16px; margin-bottom:10px; }
        .annual-hint { color:#fff; font-size:13px; margin:0 4px 10px; opacity:.9; }

        .a4-sheet { background:#fff; width:210mm; max-width:100%; min-height:297mm; margin:0 auto; padding:14mm 18mm; box-shadow:0 10px 40px rgba(0,0,0,0.3); color:#000; font-size:15px; line-height:1.55; overflow-x:auto; }
        .a4-sheet, .a4-sheet * { font-family:'Sarabun','Noto Sans Thai',sans-serif; }
        .a4-meta { display:grid; grid-template-columns:1fr 1fr 1fr; font-size:12px; margin-bottom:14px; }
        .a4-meta span:nth-child(2) { text-align:center; align-self:end; }
        .a4-meta span:first-child { align-self:end; }
        .a4-title { text-align:center; font-weight:700; font-size:17px; }
        .a4-company { margin:6px 0 14px; font-size:16px; }
        .a4-fill { display:inline-block; min-width:40mm; border-bottom:1px dotted #000; text-align:center; font-weight:600; padding:0 6px; }
        .a4-fill.wide { min-width:110mm; text-align:left; }

        .a4-sheet table.a4-table { width:100%; border-collapse:collapse; font-size:14px; }
        .a4-sheet .a4-table th, .a4-sheet .a4-table td { border:1px solid #000; padding:4px 6px; color:#000; background:#fff; font-weight:400; }
        .a4-sheet .a4-table th { text-align:center; font-weight:700; vertical-align:middle; }
        .a4-sheet .a4-table th.crit-h { width:58%; }
        .a4-sheet .a4-table th.scale-h { font-weight:400; font-size:13px; line-height:1.3; width:8.4%; }
        .a4-sheet .a4-table th.scale-h span { font-size:12px; }
        .a4-sheet .a4-table td.crit { line-height:1.5; }
        .a4-sheet .a4-table td.cell { text-align:center; font-size:20px; font-weight:700; color:#1a237e; }
        .a4-sheet .a4-table td.cell.clickable { cursor:pointer; }
        .a4-sheet .a4-table td.cell.clickable:hover { background:#EAF1FE; }
        .a4-sheet .a4-table td.cell.on { background:#EAF1FE; }
        .a4-sheet .a4-table tr:hover td { background:inherit; }

        .a4-summary { margin:18px 0 0 12mm; display:flex; flex-direction:column; gap:4px; font-size:15px; }
        .a4-summary .a4-fill { min-width:22mm; }
        .a4-result { display:flex; align-items:center; gap:10px; }
        .a4-result b { margin-right:24px; }
        .a4-box { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border:1.5px solid #000; border-radius:4px; font-weight:700; color:#1a237e; }

        .a4-suggest { margin-top:20px; font-size:15px; }
        .a4-sheet textarea.a4-lines { width:100%; height:68px; min-height:0; border:none; border-radius:0; resize:none; padding:0 2px; font-size:15px; line-height:34px; color:#000; overflow:hidden;
          background:transparent repeating-linear-gradient(to bottom, transparent 0 33px, #000 33px 34px); }
        .a4-sheet textarea.a4-lines:focus { background-color:#f7faff; }

        .a4-sign { margin:26px 0 0 auto; width:85mm; text-align:center; display:flex; flex-direction:column; gap:4px; font-size:15px; }
        .sig-row { display:flex; align-items:flex-end; gap:6px; }
        .sig-area { position:relative; flex:1; height:22mm; }
        .sig-area img, .sig-pad { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
        .sig-pad { touch-action:none; cursor:crosshair; border:1.5px dashed #9fb3c8; border-radius:6px; background:#fbfdff; }
        .sig-pad.has-sig { border-color:transparent; background:transparent; }
        .sig-pad:hover { border-color:#5B97E8; }
        .sig-line { position:absolute; left:0; right:0; bottom:3px; border-bottom:1px dotted #000; pointer-events:none; }
        .sig-clear { align-self:flex-end; border:none; background:none; color:var(--pink-dark); font-size:12px; font-weight:700; cursor:pointer; }
        .a4-sheet input.a4-input { height:auto; line-height:1.5; width:auto; display:inline-block; background:transparent; border:none; border-bottom:1px dotted #000; border-radius:0; padding:0 4px; font-size:15px; color:#000; text-align:center; }
        .a4-sheet input.a4-input:focus { background:#f7faff; }
        .a4-sheet input.a4-input::placeholder { color:#b0bec5; }
        .print-only-inline { display:none; }

        @media print {
          body.print-annual .vendor-root > *:not(.vendor-annual-host) { display:none!important; }
          body.print-annual .vendor-annual-host > .card > *:not(.annual-overlay) { display:none!important; }
          body.print-annual .vendor-annual-host > .card { padding:0; margin:0; box-shadow:none; }
          body.print-annual .annual-overlay { position:static; background:none; padding:0; overflow:visible; }
          body.print-annual .annual-wrap { max-width:none; }
          body.print-annual .a4-sheet { width:auto; min-height:0; padding:0; box-shadow:none; overflow:visible; }
          body.print-annual .a4-sheet .a4-table th, body.print-annual .a4-sheet .a4-table td { padding:3px 5px; font-size:13px; }
          body.print-annual .a4-sheet .a4-table td.cell { font-size:16px; }
          body.print-annual .a4-sheet .a4-table td.cell.on { background:#fff; }
          body.print-annual .sig-pad { border-color:transparent; background:transparent; }
          body.print-annual .a4-sheet input.a4-input::placeholder { color:transparent; }
          body.print-annual .print-only-inline { display:inline-block; }
        }
      `}</style>
    </div>
  )
}
