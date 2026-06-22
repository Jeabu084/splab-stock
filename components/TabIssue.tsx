'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const today = () => new Date().toISOString().slice(0, 10)
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #e5e7eb', borderRadius: 10,
  fontSize: 14, background: '#fafaff', outline: 'none',
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: '#fff', border: '1px solid #ece9ff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(100,90,200,0.05)', marginBottom: 16 }}>{children}</div>
}
function Row({ label, children }: { label: string, children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'center', marginBottom: 12 }}><label style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{label}</label><div>{children}</div></div>
}

export default function TabIssue() {
  const [types, setTypes] = useState<string[]>([])
  const [itemsByType, setItemsByType] = useState<Record<string, string[]>>({})
  const [lots, setLots] = useState<any[]>([])
  const [form, setForm] = useState({ date: today(), type: '', item: '', lot: '', qty: '', user_name: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string, ok: boolean } | null>(null)

  useEffect(() => {
    supabase.from('master_items').select('type,item').order('type').order('item')
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string[]> = {}
        data.forEach(r => { if (!map[r.type]) map[r.type] = []; map[r.type].push(r.item) })
        setItemsByType(map)
        setTypes(Object.keys(map).sort())
      })
  }, [])

  useEffect(() => {
    if (!form.type || !form.item) { setLots([]); return }
    supabase.from('stock_balance')
      .select('lot,expire,balance')
      .eq('type', form.type).eq('item', form.item)
      .gt('balance', 0).order('expire')
      .then(({ data }) => {
        setLots(data || [])
        if (data && data.length > 0) setForm(f => ({ ...f, lot: data[0].lot }))
      })
  }, [form.type, form.item])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.date || !form.type || !form.item || !form.lot || !form.qty || !form.user_name) {
      setMsg({ text: 'กรุณากรอกข้อมูลให้ครบ', ok: false }); return
    }
    const lotData = lots.find(l => l.lot === form.lot)
    if (lotData && Number(form.qty) > lotData.balance) {
      setMsg({ text: `จำนวนเกินคงเหลือ (คงเหลือ ${lotData.balance})`, ok: false }); return
    }
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('issues').insert({
      date: form.date, type: form.type, item: form.item,
      lot: form.lot, qty: Number(form.qty), user_name: form.user_name,
    })
    if (error) { setMsg({ text: 'บันทึกล้มเหลว: ' + error.message, ok: false }) }
    else {
      setMsg({ text: '✅ บันทึกเบิกน้ำยาสำเร็จ', ok: true })
      setForm(f => ({ ...f, qty: '' }))
      // refresh lots
      const { data } = await supabase.from('stock_balance').select('lot,expire,balance').eq('type', form.type).eq('item', form.item).gt('balance', 0).order('expire')
      setLots(data || [])
    }
    setSaving(false)
  }

  const selectedLot = lots.find(l => l.lot === form.lot)

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 17, color: '#2f2c84', marginBottom: 16 }}>📤 เบิกน้ำยา</div>

      <Row label="วันที่เบิก">
        <input type="date" style={inputStyle} value={form.date} onChange={e => set('date', e.target.value)} />
      </Row>
      <Row label="ประเภท">
        <select style={inputStyle} value={form.type} onChange={e => { set('type', e.target.value); set('item', ''); set('lot', '') }}>
          <option value="">— เลือกประเภท —</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Row>
      <Row label="รายการ">
        <select style={inputStyle} value={form.item} onChange={e => { set('item', e.target.value); set('lot', '') }}>
          <option value="">— เลือกรายการ —</option>
          {(itemsByType[form.type] || []).map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </Row>
      <Row label="Lot (คงเหลือ)">
        <select style={inputStyle} value={form.lot} onChange={e => set('lot', e.target.value)}>
          <option value="">— เลือก Lot —</option>
          {lots.map(l => (
            <option key={l.lot} value={l.lot}>
              {l.lot} — Exp {l.expire || '-'} — คงเหลือ {l.balance}
            </option>
          ))}
        </select>
        {lots.length === 0 && form.item && (
          <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>ไม่พบ Lot ที่มีคงเหลือ</div>
        )}
        {selectedLot && (
          <div style={{ fontSize: 12, color: '#7c6ff6', marginTop: 4 }}>
            คงเหลือใน Lot นี้: <b>{selectedLot.balance}</b> หน่วย
          </div>
        )}
      </Row>
      <Row label="จำนวนเบิก">
        <input type="number" style={inputStyle} min="1" placeholder="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
      </Row>
      <Row label="ผู้บันทึก">
        <input style={inputStyle} placeholder="ชื่อผู้บันทึก" value={form.user_name} onChange={e => set('user_name', e.target.value)} />
      </Row>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#991b1b', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, fontSize: 14 }}>{msg.text}</div>
      )}

      <button onClick={handleSubmit} disabled={saving} style={{ background: saving ? '#6ee7b7' : '#10b981', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.25)' }}>
        {saving ? 'กำลังบันทึก...' : '💾 บันทึกเบิกน้ำยา'}
      </button>
    </Card>
  )
}