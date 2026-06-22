'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const today = () => new Date().toISOString().slice(0,10)

function Row({ label, children }) {
  return (
    <div style={{ marginBottom:10 }}>
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}

export default function TabHome() {
  // shared lookups
  const [vendors, setVendors] = useState([])
  const [types, setTypes] = useState([])
  const [itemsByType, setItemsByType] = useState({})
  const [unitMap, setUnitMap] = useState({})

  // RECEIVE form state
  const [rForm, setRForm] = useState({ date:today(), vendor_id:'', type:'', item:'', lot:'', expire:'', qty:'', unit:'', invoice_no:'', unit_price:'', temperature:'', user_name:'' })
  const [rSaving, setRSaving] = useState(false)
  const [rMsg, setRMsg] = useState(null)

  // ISSUE form state
  const [iType, setIType] = useState('')
  const [iItem, setIItem] = useState('')
  const [iLot, setILot] = useState('')
  const [iQty, setIQty] = useState('')
  const [iUser, setIUser] = useState('')
  const [lots, setLots] = useState([])
  const [iSaving, setISaving] = useState(false)
  const [iMsg, setIMsg] = useState(null)

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

  // ---- RECEIVE logic ----
  const rSet = (k,v) => setRForm(f => ({...f,[k]:v}))
  useEffect(() => {
    if (rForm.type && rForm.item) {
      const u = unitMap[rForm.type+'||'+rForm.item] || ''
      setRForm(f => ({...f, unit:u}))
    }
  }, [rForm.type, rForm.item])

  async function handleReceiveSubmit() {
    if (!rForm.date||!rForm.type||!rForm.item||!rForm.qty||!rForm.user_name) {
      setRMsg({text:'กรุณากรอกให้ครบ: วันที่, ประเภท, รายการ, จำนวน, ผู้บันทึก', ok:false}); return
    }
    if (!rForm.invoice_no || !rForm.invoice_no.trim()) {
      setRMsg({text:'กรุณากรอกเลขที่บิล / Invoice — จำเป็นสำหรับการประเมินผู้ขายในภายหลัง', ok:false}); return
    }
    if (!rForm.temperature || !rForm.temperature.trim()) {
      setRMsg({text:'กรุณากรอกอุณหภูมิขณะรับน้ำยา', ok:false}); return
    }
    setRSaving(true); setRMsg(null)
    const {error:e1} = await supabase.from('receipts').insert({
      date:rForm.date, vendor_id:rForm.vendor_id?Number(rForm.vendor_id):null,
      type:rForm.type, item:rForm.item, lot:rForm.lot||'-',
      expire:rForm.expire||null, qty:Number(rForm.qty),
      unit:rForm.unit||null, invoice_no:rForm.invoice_no.trim(),
      unit_price:rForm.unit_price?Number(rForm.unit_price):null,
      temperature:rForm.temperature.trim(),
      user_name:rForm.user_name,
    })
    if (e1) { setRMsg({text:'บันทึกล้มเหลว: '+e1.message, ok:false}); setRSaving(false); return }
    setRMsg({text:'บันทึกรับน้ำยาสำเร็จ', ok:true})
    setRForm(f => ({...f, lot:'', expire:'', qty:'', unit_price:''}))
    setRSaving(false)
  }

  // ---- ISSUE logic ----
  useEffect(() => {
    if (!iType || !iItem) { setLots([]); return }
    supabase.from('stock_balance').select('lot,expire,balance').eq('type',iType).eq('item',iItem).gt('balance',0).order('expire')
      .then(({data}) => setLots(data||[]))
  }, [iType, iItem])

  async function handleIssueSubmit() {
    if (!iType||!iItem||!iLot||!iQty||!iUser) {
      setIMsg({text:'กรุณากรอกให้ครบ: ประเภท, รายการ, Lot, จำนวน, ผู้เบิก', ok:false}); return
    }
    const lotInfo = lots.find(l => l.lot===iLot)
    if (lotInfo && Number(iQty) > Number(lotInfo.balance)) {
      setIMsg({text:'จำนวนที่เบิกเกินกว่าคงเหลือใน Lot นี้ (คงเหลือ '+lotInfo.balance+')', ok:false}); return
    }
    setISaving(true); setIMsg(null)
    const {error} = await supabase.from('issues').insert({
      date: today(), type:iType, item:iItem, lot:iLot, qty:Number(iQty), user_name:iUser,
    })
    if (error) { setIMsg({text:'บันทึกล้มเหลว: '+error.message, ok:false}); setISaving(false); return }
    setIMsg({text:'บันทึกเบิกน้ำยาสำเร็จ', ok:true})
    setIQty(''); setILot('')
    supabase.from('stock_balance').select('lot,expire,balance').eq('type',iType).eq('item',iItem).gt('balance',0).order('expire')
      .then(({data}) => setLots(data||[]))
    setISaving(false)
  }

  return (
    <div>
      <div className="grid2" style={{ marginBottom:16, alignItems:'stretch' }}>

        {/* ISSUE FORM */}
        <div className="card form-pink" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
          <h2 style={{ color:'var(--pink-dark)' }}><i className="ti ti-package-export"></i> เบิกน้ำยา</h2>
          <Row label="ประเภท">
            <select value={iType} onChange={e=>{setIType(e.target.value);setIItem('')}}>
              <option value="">— เลือกประเภท —</option>
              {types.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Row>
          <Row label="รายการ">
            <select value={iItem} onChange={e=>setIItem(e.target.value)}>
              <option value="">— เลือกรายการ —</option>
              {(itemsByType[iType]||[]).map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </Row>
          <Row label="Lot (เฉพาะที่มีคงเหลือ)">
            <select value={iLot} onChange={e=>setILot(e.target.value)}>
              <option value="">— เลือก Lot —</option>
              {lots.map(l=><option key={l.lot} value={l.lot}>{l.lot} (คงเหลือ {l.balance}{l.expire?' · Exp '+l.expire:''})</option>)}
            </select>
          </Row>
          <Row label="จำนวนที่เบิก"><input type="number" min="1" placeholder="0" value={iQty} onChange={e=>setIQty(e.target.value)}/></Row>
          <Row label="ผู้เบิก"><input placeholder="ชื่อ-นามสกุล" value={iUser} onChange={e=>setIUser(e.target.value)}/></Row>

          {iMsg && <div className={'pill '+(iMsg.ok?'pill-ok':'pill-danger')} style={{ display:'block', marginTop:6, marginBottom:10, padding:'10px 14px', fontSize:12 }}>{iMsg.text}</div>}
          <button className="btn btn-pink" style={{ width:'100%', justifyContent:'center', marginTop:8 }} onClick={handleIssueSubmit} disabled={iSaving}>
            <i className="ti ti-check"></i> {iSaving?'กำลังบันทึก...':'บันทึกเบิกน้ำยา'}
          </button>

        </div>

        {/* RECEIVE FORM */}
        <div className="card form-purple" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
          <h2 style={{ color:'var(--pv)' }}><i className="ti ti-package-import"></i> รับน้ำยา</h2>

          {/* แถว 1: วันที่รับ + ผู้ขาย */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div className="field-label">วันที่รับ</div><input type="date" value={rForm.date} onChange={e=>rSet('date',e.target.value)}/></div>
            <div><div className="field-label">ผู้ขาย</div>
              <select value={rForm.vendor_id} onChange={e=>rSet('vendor_id',e.target.value)}>
                <option value="">— เลือกผู้ขาย —</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>

          {/* แถว 2: เลขที่บิล + อุณหภูมิ */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div className="field-label">เลขที่บิล / Invoice *</div><input placeholder="INV-2025-001" value={rForm.invoice_no} onChange={e=>rSet('invoice_no',e.target.value)}/></div>
            <div><div className="field-label">อุณหภูมิขณะรับ *</div><input placeholder="เช่น 2-8°C, Ambient" value={rForm.temperature} onChange={e=>rSet('temperature',e.target.value)}/></div>
          </div>

          {/* แถว 3: ประเภท + รายการ */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div className="field-label">ประเภท</div>
              <select value={rForm.type} onChange={e=>{rSet('type',e.target.value);rSet('item','')}}>
                <option value="">— เลือกประเภท —</option>
                {types.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><div className="field-label">รายการ</div>
              <select value={rForm.item} onChange={e=>rSet('item',e.target.value)}>
                <option value="">— เลือกรายการ —</option>
                {(itemsByType[rForm.type]||[]).map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          {/* แถว 4: Lot + วันหมดอายุ */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div className="field-label">Lot</div><input placeholder="เช่น L2509-01" value={rForm.lot} onChange={e=>rSet('lot',e.target.value)}/></div>
            <div><div className="field-label">วันหมดอายุ</div><input type="date" value={rForm.expire} onChange={e=>rSet('expire',e.target.value)}/></div>
          </div>

          {/* แถว 5: จำนวน + หน่วย + ราคา */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div className="field-label">จำนวนรับ</div><input type="number" min="1" placeholder="0" value={rForm.qty} onChange={e=>rSet('qty',e.target.value)}/></div>
            <div><div className="field-label">หน่วยนับ</div><input placeholder="ขวด, กล่อง" value={rForm.unit} onChange={e=>rSet('unit',e.target.value)}/></div>
            <div><div className="field-label">ราคา/หน่วย (฿)</div><input type="number" min="0" step="0.01" placeholder="0.00" value={rForm.unit_price} onChange={e=>rSet('unit_price',e.target.value)}/></div>
          </div>

          {rForm.qty && rForm.unit_price && (
            <div className="pill pill-ok" style={{ marginBottom:10, fontSize:12, padding:'7px 12px' }}>
              ราคารวม: {(Number(rForm.qty)*Number(rForm.unit_price)).toLocaleString('th-TH',{minimumFractionDigits:2})} บาท
            </div>
          )}

          {/* แถว 6: ผู้บันทึก */}
          <Row label="ผู้บันทึก"><input placeholder="ชื่อผู้บันทึก" value={rForm.user_name} onChange={e=>rSet('user_name',e.target.value)}/></Row>

          {rMsg && <div className={'pill '+(rMsg.ok?'pill-ok':'pill-danger')} style={{ display:'block', marginTop:12, padding:'10px 14px', fontSize:12 }}>{rMsg.text}</div>}
          <button className="btn btn-purple" style={{ width:'100%', justifyContent:'center', marginTop:14 }} onClick={handleReceiveSubmit} disabled={rSaving}>
            <i className="ti ti-device-floppy"></i> {rSaving?'กำลังบันทึก...':'บันทึกรับน้ำยา'}
          </button>
        </div>

      </div>
    </div>
  )
}
