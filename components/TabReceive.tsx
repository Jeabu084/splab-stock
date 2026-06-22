'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SCORE_LABELS = [
  { key: 'score_delivery',  label: '1. ความถูกต้องในการจัดส่งสินค้าและราคา' },
  { key: 'score_leadtime',  label: '2. ระยะเวลาการส่งสินค้า' },
  { key: 'score_expiry',    label: '3. วันหมดอายุ (อายุคงเหลือเพียงพอ)' },
  { key: 'score_coldchain', label: '4. การควบคุมอุณหภูมิขณะนำส่ง' },
  { key: 'score_quality',   label: '5. คุณภาพผลิตภัณฑ์จากการใช้งานจริง' },
  { key: 'score_defect',    label: '6. ปัญหาที่พบจากการตรวจรับสินค้า (5=ไม่พบปัญหา)' },
  { key: 'score_service',   label: '7. การบริการหลังการขายตามข้อตกลง' },
]
const today = () => new Date().toISOString().slice(0,10)
const inp = { width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:10, fontSize:14, background:'#fafaff', outline:'none' }
function Row({ label, children }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:10, alignItems:'center', marginBottom:10 }}>
      <label style={{ fontWeight:600, fontSize:13, color:'#374151' }}>{label}</label>
      <div>{children}</div>
    </div>
  )
}
export default function TabReceive() {
  const [vendors, setVendors] = useState([])
  const [types, setTypes] = useState([])
  const [itemsByType, setItemsByType] = useState({})
  const [unitMap, setUnitMap] = useState({})
  const [form, setForm] = useState({ date:today(), vendor_id:'', type:'', item:'', lot:'', expire:'', qty:'', unit:'', invoice_no:'', unit_price:'', user_name:'' })
  const [scores, setScores] = useState({})
  const [scoreNote, setScoreNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    supabase.from('vendors').select('id,name').eq('is_active',true).order('name')
      .then(({data}) => setVendors(data||[]))
    supabase.from('master_items').select('type,item,unit').order('type').order('item')
      .then(({data}) => {
        if (!data) return
        const map = {}; const um = {}
        data.forEach(r => {
          if (!map[r.type]) map[r.type]=[]
          map[r.type].push(r.item)
          um[r.type+'||'+r.item] = r.unit||''
        })
        setItemsByType(map); setTypes(Object.keys(map).sort()); setUnitMap(um)
      })
  }, [])
  const set = (k, v) => setForm(f => ({...f, [k]:v}))
  useEffect(() => {
    if (form.type && form.item) set('unit', unitMap[form.type+'||'+form.item]||'')
  }, [form.type, form.item])
  const totalScore = SCORE_LABELS.reduce((s,l) => s+(scores[l.key]||0), 0)
  const pct = Math.round((totalScore/35)*100)
  const grade = pct>=80?'ดีมาก':pct>=70?'ดี':pct>=60?'พอใช้':'ต้องปรับปรุง'
  const gradeColor = pct>=80?'#16a34a':pct>=70?'#7c6ff6':pct>=60?'#d97706':'#dc2626'
  const scoredAll = SCORE_LABELS.every(l => scores[l.key])
  async function handleSubmit() {
    if (!form.date||!form.type||!form.item||!form.qty||!form.user_name) {
      setMsg({text:'กรุณากรอกให้ครบ: วันที่, ประเภท, รายการ, จำนวน, ผู้บันทึก', ok:false}); return
    }
    setSaving(true); setMsg(null)
    const {data:rcpt, error:e1} = await supabase.from('receipts').insert({
      date:form.date, vendor_id:form.vendor_id?Number(form.vendor_id):null,
      type:form.type, item:form.item, lot:form.lot||'-',
      expire:form.expire||null, qty:Number(form.qty),
      unit:form.unit||null, invoice_no:form.invoice_no||null,
      unit_price:form.unit_price?Number(form.unit_price):null,
      user_name:form.user_name,
    }).select('id').single()
    if (e1) { setMsg({text:'บันทึกล้มเหลว: '+e1.message, ok:false}); setSaving(false); return }
    if (scoredAll && form.vendor_id) {
      await supabase.from('vendor_scores').insert({
        receipt_id:rcpt.id, vendor_id:Number(form.vendor_id),
        date:form.date, item:form.item, lot:form.lot||'-',
        ...scores, user_name:form.user_name, note:scoreNote||null,
      })
    }
    setMsg({text:'✅ บันทึกรับน้ำยาสำเร็จ'+(scoredAll&&form.vendor_id?' พร้อมประเมินผู้ขายแล้ว':''), ok:true})
    setForm(f => ({...f, lot:'', expire:'', qty:'', invoice_no:'', unit_price:''}))
    setScores({}); setScoreNote(''); setSaving(false)
  }
  return (
    <div>
      <div style={{background:'#fff',border:'1px solid #ece9ff',borderRadius:16,padding:'20px 24px',marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:17,color:'#2f2c84',marginBottom:16}}>📥 รับน้ำยา</div>
        <Row label="วันที่รับ"><input type="date" style={inp} value={form.date} onChange={e=>set('date',e.target.value)}/></Row>
        <Row label="ผู้ขาย">
          <select style={inp} value={form.vendor_id} onChange={e=>set('vendor_id',e.target.value)}>
            <option value="">— เลือกผู้ขาย (ถ้ามี) —</option>
            {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Row>
        <Row label="เลขที่บิล / Invoice"><input style={inp} placeholder="เช่น INV-2025-001" value={form.invoice_no} onChange={e=>set('invoice_no',e.target.value)}/></Row>
        <Row label="ประเภท">
          <select style={inp} value={form.type} onChange={e=>{set('type',e.target.value);set('item','')}}>
            <option value="">— เลือกประเภท —</option>
            {types.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="รายการ">
          <select style={inp} value={form.item} onChange={e=>set('item',e.target.value)}>
            <option value="">— เลือกรายการ —</option>
            {(itemsByType[form.type]||[]).map(i=><option key={i} value={i}>{i}</option>)}
          </select>
        </Row>
        <Row label="Lot"><input style={inp} placeholder="เช่น L2509-01" value={form.lot} onChange={e=>set('lot',e.target.value)}/></Row>
        <Row label="วันหมดอายุ"><input type="date" style={inp} value={form.expire} onChange={e=>set('expire',e.target.value)}/></Row>
        <Row label="จำนวนรับ"><input type="number" style={inp} min="1" placeholder="0" value={form.qty} onChange={e=>set('qty',e.target.value)}/></Row>
        <Row label="หน่วยนับ"><input style={inp} placeholder="เช่น ขวด, กล่อง, ชุด" value={form.unit} onChange={e=>set('unit',e.target.value)}/></Row>
        <Row label="ราคาต่อหน่วย (บาท)"><input type="number" style={inp} min="0" step="0.01" placeholder="0.00" value={form.unit_price} onChange={e=>set('unit_price',e.target.value)}/></Row>
        {form.qty && form.unit_price && (
          <div style={{marginBottom:10,padding:'8px 12px',background:'#f5f3ff',borderRadius:10,fontSize:13,color:'#4c3fbb'}}>
            💰 ราคารวม: <b>{(Number(form.qty)*Number(form.unit_price)).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</b>
          </div>
        )}
        <Row label="ผู้บันทึก"><input style={inp} placeholder="ชื่อผู้บันทึก" value={form.user_name} onChange={e=>set('user_name',e.target.value)}/></Row>
      </div>
      <div style={{background:'#fff',border:'1px solid #c4b8ff',borderRadius:16,padding:'20px 24px',marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:16,color:'#4c3fbb',marginBottom:4}}>⭐ ประเมินผู้ขาย ณ วันรับสินค้า</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:16}}>ให้คะแนน 1–5 (5=ดีมาก) {!form.vendor_id&&'— เลือกผู้ขายด้านบนก่อน'}</div>
        {SCORE_LABELS.map(l=>(
          <div key={l.key} style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>{l.label}</div>
            <div style={{display:'flex',gap:8}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setScores(s=>({...s,[l.key]:n}))} style={{
                  width:40,height:40,borderRadius:10,border:'1px solid',
                  borderColor:scores[l.key]===n?'#7c6ff6':'#e5e7eb',
                  background:scores[l.key]===n?'#7c6ff6':'#fafaff',
                  color:scores[l.key]===n?'#fff':'#6b7280',
                  fontWeight:700,fontSize:15,cursor:'pointer'
                }}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{background:'#f3f0ff',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:20,flexWrap:'wrap',marginTop:8}}>
          <div>
            <div style={{fontSize:11,color:'#7c6ff6',fontWeight:600}}>คะแนนรวม</div>
            <div style={{fontSize:28,fontWeight:800,color:'#2f2c84'}}>{totalScore} <span style={{fontSize:14,fontWeight:400}}>/ 35</span></div>
          </div>
          <div>
            <div style={{fontSize:11,color:'#7c6ff6',fontWeight:600}}>เปอร์เซ็นต์</div>
            <div style={{fontSize:28,fontWeight:800,color:'#2f2c84'}}>{totalScore>0?pct:'—'}%</div>
          </div>
          {totalScore>0&&(
            <div style={{flex:1,minWidth:140}}>
              <div style={{background:'#ddd6fe',borderRadius:99,height:8,overflow:'hidden'}}>
                <div style={{width:pct+'%',height:'100%',background:gradeColor,borderRadius:99,transition:'width .3s'}}/>
              </div>
              <div style={{fontSize:12,color:gradeColor,marginTop:4,fontWeight:600}}>ระดับ: {grade}</div>
            </div>
          )}
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>หมายเหตุ / ปัญหาที่พบ</div>
          <textarea style={{...inp,height:64,resize:'vertical'}} placeholder="พิมพ์รายละเอียด (ถ้ามี)" value={scoreNote} onChange={e=>setScoreNote(e.target.value)}/>
        </div>
      </div>
      {msg&&<div style={{padding:'12px 16px',borderRadius:10,marginBottom:12,background:msg.ok?'#f0fdf4':'#fef2f2',color:msg.ok?'#166534':'#991b1b',border:'1px solid '+(msg.ok?'#bbf7d0':'#fecaca'),fontSize:14}}>{msg.text}</div>}
      <button onClick={handleSubmit} disabled={saving} style={{background:saving?'#a5b4fc':'#7c6ff6',color:'#fff',border:'none',borderRadius:12,padding:'12px 28px',fontWeight:700,fontSize:15,cursor:saving?'not-allowed':'pointer',boxShadow:'0 4px 14px rgba(124,111,246,0.3)'}}>
        {saving?'กำลังบันทึก...':'💾 บันทึกรับน้ำยา'+(scoredAll&&form.vendor_id?' + ประเมินผู้ขาย':'')}
      </button>
    </div>
  )
}