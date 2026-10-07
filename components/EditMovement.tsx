'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const FIELDS = {
  issues:   ['date','lot','qty','user_name'],
  receipts: ['date','lot','expire','qty','invoice_no','unit_price'],
}
const LABEL = { date:'วันที่', lot:'Lot', expire:'วันหมดอายุ', qty:'จำนวน', user_name:'ผู้เบิก', invoice_no:'เลขที่บิล', unit_price:'ราคา/หน่วย (฿)' }
const SRC_LABEL = { issues:'เบิก', receipts:'รับ' }

// ยอดคงเหลือสุดท้ายแยกตาม Lot
function lotBalance(moves) {
  const m = {}
  moves.forEach(r => { m[r.lot] = (m[r.lot]||0) + (r.qty_in||0) - (r.qty_out||0) })
  return m
}

// mode = 'edit' | 'delete' ; row = แถวจาก Stock Card (มี src, id) ; moves = รายการทั้งหมดของน้ำยาตัวนี้
export default function EditMovement({ mode, row, moves, userName, onClose, onSaved }) {
  const src = row.src
  const init: Record<string, string> = {}
  FIELDS[src].forEach(k => { init[k] = row[k]==null ? '' : String(k==='date'||k==='expire' ? String(row[k]).slice(0,10) : row[k]) })
  const [f, setF] = useState(init)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const set = (k,v) => setF(x => ({ ...x, [k]:v }))

  const lotOptions: string[] = [...new Set<string>(moves.filter(m => m.src!=='issues').map(m => m.lot))]
  if (f.lot && !lotOptions.includes(f.lot)) lotOptions.unshift(f.lot)

  function check() {
    if (!reason.trim()) return 'กรุณาระบุเหตุผลการ'+(mode==='delete'?'ลบ':'แก้ไข')
    if (mode==='edit') {
      if (!f.date) return 'กรุณาระบุวันที่'
      if (!f.lot.trim()) return 'กรุณาระบุ Lot'
      if (!(Number(f.qty) > 0)) return 'จำนวนต้องมากกว่า 0'
    }
    // ห้ามทำให้ Lot ติดลบ (เทียบเฉพาะ Lot ที่เกี่ยวข้อง)
    const others = moves.filter(m => !(m.src===src && m.id===row.id))
    const after = mode==='delete' ? others : [...others, src==='issues'
      ? { lot:f.lot.trim(), qty_out:Number(f.qty) }
      : { lot:f.lot.trim(), qty_in:Number(f.qty) }]
    const b0 = lotBalance(moves), b1 = lotBalance(after)
    for (const lot of new Set([row.lot, f.lot.trim()])) {
      if ((b1[lot]||0) < 0 && (b1[lot]||0) < (b0[lot]||0)) return 'ทำไม่ได้: Lot '+lot+' จะติดลบ ('+b1[lot]+')'
    }
    return null
  }

  async function submit() {
    const e = check()
    if (e) { setMsg(e); return }
    setSaving(true); setMsg(null)
    const { data: before, error: e0 } = await supabase.from(src).select('*').eq('id', row.id).single()
    if (e0 || !before) { setMsg('ไม่พบรายการนี้ในฐานข้อมูล อาจถูกแก้ไขไปแล้ว — กรุณารีเฟรช'); setSaving(false); return }

    let after = null
    if (mode==='edit') {
      const patch: any = {
        date: f.date, lot: f.lot.trim(), qty: Number(f.qty),
      }
      if (src==='issues') patch.user_name = f.user_name.trim()
      else {
        patch.expire = f.expire || null
        patch.invoice_no = f.invoice_no.trim()
        patch.unit_price = f.unit_price==='' ? null : Number(f.unit_price)
      }
      const { data, error } = await supabase.from(src).update(patch).eq('id', row.id).select().single()
      if (error) { setMsg('บันทึกไม่สำเร็จ: '+error.message); setSaving(false); return }
      after = data
    } else {
      const { error } = await supabase.from(src).delete().eq('id', row.id)
      if (error) { setMsg('ลบไม่สำเร็จ: '+error.message); setSaving(false); return }
    }

    const { error: logErr } = await supabase.from('edit_log').insert({
      table_name: src, row_id: row.id, action: mode==='edit' ? 'update' : 'delete',
      before, after, reason: reason.trim(), edited_by: userName || null,
    })
    setSaving(false)
    onSaved(logErr ? 'บันทึกการเปลี่ยนแปลงแล้ว แต่เก็บประวัติไม่สำเร็จ ('+logErr.message+') — ตรวจว่ารัน supabase/edit_log.sql แล้วหรือยัง' : null)
  }

  const isDel = mode==='delete'

  return (
    <div className="em-overlay" onClick={onClose}>
      <div className="card em-box" onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ marginBottom:0, color: isDel ? 'var(--pink-dark)' : 'var(--pv)' }}>
            <i className={'ti '+(isDel?'ti-trash':'ti-pencil')}></i> {isDel ? 'ลบ' : 'แก้ไข'}รายการ{SRC_LABEL[src]}
          </h2>
          <button className="btn btn-outline" style={{ padding:'6px 12px' }} onClick={onClose}><i className="ti ti-x"></i></button>
        </div>

        <div className="em-orig">
          <b>ข้อมูลเดิม:</b> {String(row.date).slice(0,10)} · Lot {row.lot} · {SRC_LABEL[src]} {row.qty}
          {row.user_name && ' · '+row.user_name}
          {src==='receipts' && row.invoice_no && ' · บิล '+row.invoice_no}
        </div>

        {!isDel && (
          <div className="em-grid">
            {FIELDS[src].map(k => (
              <div key={k}>
                <div className="field-label">{LABEL[k]}</div>
                {k==='lot' && src==='issues' ? (
                  <select value={f.lot} onChange={e=>set('lot',e.target.value)}>
                    {lotOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input
                    type={k==='date'||k==='expire' ? 'date' : k==='qty'||k==='unit_price' ? 'number' : 'text'}
                    min={k==='qty' ? 1 : undefined} step={k==='unit_price' ? '0.01' : undefined}
                    value={f[k]} onChange={e=>set(k,e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {isDel && (
          <div className="em-warn">
            <i className="ti ti-alert-triangle"></i> รายการนี้จะถูกลบออกจากฐานข้อมูล ยอดคงเหลือทุกหน้าจะคำนวณใหม่ (ข้อมูลเดิมเก็บไว้ในประวัติการแก้ไข)
          </div>
        )}

        <div style={{ marginTop:12 }}>
          <div className="field-label">เหตุผล *</div>
          <input placeholder={isDel ? 'เช่น บันทึกซ้ำ, เลือกรายการผิด' : 'เช่น เลือก Lot ผิด, กรอกจำนวนผิด'} value={reason} onChange={e=>setReason(e.target.value)} />
        </div>

        {msg && <div className="pill pill-danger" style={{ display:'block', marginTop:12, padding:'10px 14px', fontSize:13 }}>{msg}</div>}

        <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
          <button className={'btn '+(isDel?'btn-pink':'btn-purple')} onClick={submit} disabled={saving}>
            <i className={'ti '+(isDel?'ti-trash':'ti-device-floppy')}></i> {saving ? 'กำลังบันทึก...' : isDel ? 'ยืนยันลบ' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </div>

      <style>{`
        .em-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; }
        .em-box { max-width:560px; width:100%; max-height:90vh; overflow-y:auto; }
        .em-orig { background:var(--bg); border-radius:12px; padding:10px 14px; font-size:13px; color:var(--text); margin-bottom:14px; }
        .em-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .em-warn { background:var(--pink-light); color:var(--pink-dark); border-radius:12px; padding:12px 14px; font-size:13px; font-weight:600; display:flex; gap:8px; }
        @media (max-width:520px) { .em-grid { grid-template-columns:1fr; } }
      `}</style>
    </div>
  )
}
