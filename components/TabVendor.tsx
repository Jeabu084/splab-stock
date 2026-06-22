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

export default function TabVendor() {
  const [waiting, setWaiting] = useState([])
  const [summary, setSummary] = useState([])
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(true)

  // popup state
  const [modalBill, setModalBill] = useState(null)
  const [scores, setScores] = useState({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: receipts }, { data: scoresData }, { data: summaryData }] = await Promise.all([
      supabase.from('receipts').select('vendor_id,invoice_no,date,type,item,qty,unit,vendors(name)').not('vendor_id','is',null).order('date',{ascending:false}),
      supabase.from('vendor_scores').select('vendor_id,invoice_no'),
      supabase.from('vendor_score_summary').select('*'),
    ])
    setSummary(summaryData || [])

    const doneSet = new Set((scoresData||[]).map(s => s.vendor_id+'||'+s.invoice_no))

    const billMap = {}
    ;(receipts||[]).forEach(r => {
      if (!r.invoice_no) return
      const key = r.vendor_id+'||'+r.invoice_no
      if (doneSet.has(key)) return
      if (!billMap[key]) {
        billMap[key] = {
          vendor_id: r.vendor_id,
          vendor_name: r.vendors?.name || '(ไม่พบชื่อผู้ขาย)',
          invoice_no: r.invoice_no,
          date: r.date,
          items: [],
        }
      }
      billMap[key].items.push({ type:r.type, item:r.item, qty:r.qty, unit:r.unit })
    })

    setWaiting(Object.values(billMap).sort((a,b)=> new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  function openModal(bill) {
    setModalBill(bill)
    setScores({})
    setNote('')
    setSaveMsg(null)
  }

  function closeModal() {
    setModalBill(null)
  }

  const scoredAll = SCORE_LABELS.every(l => scores[l.key])

  async function handleSaveEvaluation() {
    if (!scoredAll) {
      setSaveMsg({ text:'กรุณาให้คะแนนครบทั้ง 7 ข้อ', ok:false }); return
    }
    setSaving(true); setSaveMsg(null)
    const { error } = await supabase.from('vendor_scores').insert({
      vendor_id: modalBill.vendor_id,
      invoice_no: modalBill.invoice_no,
      date: modalBill.date,
      item: modalBill.items.map(i=>i.item).join(', '),
      lot: '-',
      ...scores,
      user_name: '',
      note: note || null,
    })
    if (error) {
      setSaveMsg({ text:'บันทึกล้มเหลว: '+error.message, ok:false }); setSaving(false); return
    }
    setSaveMsg({ text:'บันทึกการประเมินสำเร็จ', ok:true })
    setSaving(false)
    setTimeout(() => {
      closeModal()
      loadAll()
    }, 700)
  }

  function gradeClass(g) {
    if (g === 'ดีมาก' || g === 'ดี') return 'pill-ok'
    if (g === 'พอใช้') return 'pill-warn'
    return 'pill-danger'
  }

  const totalScore = SCORE_LABELS.reduce((s,l) => s+(scores[l.key]||0), 0)

  return (
    <div>
      {/* WAITING LIST */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-clock" style={{ color:'var(--bd)' }}></i> รอประเมิน</h2>
          <button className="btn btn-teal" onClick={loadAll}><i className="ti ti-refresh"></i> รีเฟรช</button>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>บิลรับสินค้าที่ยังไม่ได้ประเมินผู้ขาย (1 บิล = 1 ผู้ขาย + 1 เลขที่บิล)</div>

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : waiting.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ไม่มีบิลที่รอประเมิน 🎉</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ผู้ขาย</th>
                  <th>เลขที่บิล</th>
                  <th>วันที่รับ</th>
                  <th>รายการในบิล</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((bill, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:700 }}>{bill.vendor_name}</td>
                    <td>{bill.invoice_no}</td>
                    <td style={{ color:'var(--muted)' }}>{bill.date}</td>
                    <td style={{ fontSize:12, color:'var(--muted)' }}>
                      {bill.items.map((it,j)=>(
                        <div key={j}>{it.item} — {it.qty}{it.unit?' '+it.unit:''}</div>
                      ))}
                    </td>
                    <td>
                      <button className="btn btn-purple" style={{ padding:'8px 16px', fontSize:12 }} onClick={()=>openModal(bill)}>
                        <i className="ti ti-star"></i> ประเมิน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUMMARY TABLE */}
      <div className="card" style={{ marginBottom: sel ? 16 : 0 }}>
        <h2><i className="ti ti-chart-bar" style={{ color:'var(--bd)' }}></i> สรุปคะแนนผู้ขาย</h2>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>เกณฑ์: ≥80% = ดีมาก · 70–79% = ดี · 60–69% = พอใช้ · &lt;60% = ต้องปรับปรุง</div>
        {summary.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>ยังไม่มีข้อมูลการประเมิน</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ผู้ขาย</th><th>จำนวนครั้ง</th><th>คะแนนเฉลี่ย</th><th>%</th><th>ระดับ</th><th></th>
                </tr>
              </thead>
              <tbody>
                {summary.map((v, i) => {
                  const isSel = sel?.vendor_id === v.vendor_id
                  return (
                    <tr key={i} style={{ cursor:'pointer', background: isSel ? 'var(--bb)' : undefined }} onClick={()=>setSel(isSel?null:v)}>
                      <td style={{ fontWeight:700 }}>{v.vendor_name}</td>
                      <td>{v.eval_count}</td>
                      <td>{v.avg_score} / 35</td>
                      <td style={{ fontWeight:800 }}>{v.pct}%</td>
                      <td><span className={'pill '+gradeClass(v.grade)}>{v.grade}</span></td>
                      <td style={{ color:'var(--bd)', fontSize:12, fontWeight:700 }}>{isSel?'▲ ซ่อน':'▼ รายละเอียด'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sel && (
        <div className="card">
          <h2 style={{ color:'var(--bd)' }}><i className="ti ti-chart-bar"></i> รายละเอียด — {sel.vendor_name}</h2>
          {[
            {key:'avg_delivery',label:'ความถูกต้องในการจัดส่งสินค้าและราคา'},
            {key:'avg_leadtime',label:'ระยะเวลาการส่งสินค้า'},
            {key:'avg_expiry',label:'วันหมดอายุ'},
            {key:'avg_coldchain',label:'การควบคุมอุณหภูมิ'},
            {key:'avg_quality',label:'คุณภาพผลิตภัณฑ์'},
            {key:'avg_defect',label:'ปัญหาที่พบจากตรวจรับ'},
            {key:'avg_service',label:'การบริการหลังการขาย'},
          ].map(l => {
            const val = Number(sel[l.key]) || 0
            const pct = (val/5)*100
            return (
              <div key={l.key} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                <div style={{ width:220, fontSize:13, color:'var(--text)', fontWeight:600, flexShrink:0 }}>{l.label}</div>
                <div className="bar-wrap" style={{ flex:1 }}><div className="bar" style={{ width:pct+'%', background:'var(--bd)' }}/></div>
                <div style={{ width:36, fontSize:14, fontWeight:800, color:'var(--text)', textAlign:'right' }}>{val.toFixed(1)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL */}
      {modalBill && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={closeModal}>
          <div className="card" style={{ maxWidth:560, width:'100%', maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
              <h2 style={{ color:'var(--pv)', marginBottom:0 }}><i className="ti ti-star"></i> ประเมินผู้ขาย</h2>
              <button className="btn btn-outline" style={{ padding:'6px 12px' }} onClick={closeModal}><i className="ti ti-x"></i></button>
            </div>
            <div style={{ background:'var(--pb)', borderRadius:14, padding:'12px 14px', marginBottom:16, marginTop:10 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--pv)' }}>{modalBill.vendor_name}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>เลขที่บิล {modalBill.invoice_no} · {modalBill.date}</div>
              <div style={{ marginTop:8, fontSize:12, color:'var(--text)' }}>
                {modalBill.items.map((it,j)=>(
                  <div key={j} style={{ padding:'2px 0' }}>• {it.item} — {it.qty}{it.unit?' '+it.unit:''}</div>
                ))}
              </div>
            </div>

            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>ให้คะแนน 1–5 (5=ดีมาก) ทั้ง 7 ข้อ</div>
            {SCORE_LABELS.map(l=>(
              <div key={l.key} style={{ background:'var(--pb)', borderRadius:14, padding:'12px 14px', marginBottom:10 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--pv)', marginBottom:8 }}>{l.label}</div>
                <div style={{ display:'flex', gap:8 }}>
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} className={'scoreopt scoreopt-purple'+(scores[l.key]===n?' sel':'')} onClick={()=>setScores(s=>({...s,[l.key]:n}))}>{n}</button>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ marginTop:4, marginBottom:14 }}>
              <div className="field-label">หมายเหตุ / ปัญหาที่พบ</div>
              <textarea placeholder="พิมพ์รายละเอียด (ถ้ามี)" value={note} onChange={e=>setNote(e.target.value)}/>
            </div>

            {saveMsg && <div className={'pill '+(saveMsg.ok?'pill-ok':'pill-danger')} style={{ display:'block', marginBottom:12, padding:'10px 14px', fontSize:12 }}>{saveMsg.text}</div>}

            <button className="btn btn-purple" style={{ width:'100%', justifyContent:'center' }} onClick={handleSaveEvaluation} disabled={saving}>
              <i className="ti ti-device-floppy"></i> {saving?'กำลังบันทึก...':'บันทึกการประเมิน ('+totalScore+'/35)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
