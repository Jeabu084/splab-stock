'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { hashPassword } from '@/lib/auth'

const ROLE_LABEL = { admin:'Admin', user:'User', viewer:'Viewer' }
const ROLE_CLASS = { admin:'pill-danger', user:'pill-ok', viewer:'pill-warn' }

export default function TabSettings() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | {edit user}
  const [form, setForm] = useState({ username:'', full_name:'', password:'', role:'user', is_active:true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('id,username,full_name,role,is_active,created_at').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ username:'', full_name:'', password:'', role:'user', is_active:true })
    setMsg(null); setModal('add')
  }

  function openEdit(u) {
    setForm({ username:u.username, full_name:u.full_name, password:'', role:u.role, is_active:u.is_active })
    setMsg(null); setModal(u)
  }

  async function handleSave() {
    if (!form.username || !form.full_name) { setMsg({text:'กรุณากรอก username และชื่อ', ok:false}); return }
    if (modal==='add' && !form.password) { setMsg({text:'กรุณากรอก password', ok:false}); return }
    setSaving(true); setMsg(null)

    if (modal === 'add') {
      const hash = await hashPassword(form.password)
      const { error } = await supabase.from('app_users').insert({
        username: form.username.trim(),
        full_name: form.full_name.trim(),
        password_hash: hash,
        role: form.role,
        is_active: form.is_active,
      })
      if (error) { setMsg({text:'บันทึกล้มเหลว: '+error.message, ok:false}); setSaving(false); return }
    } else {
      const updates: any = {
        username: form.username.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
        is_active: form.is_active,
      }
      if (form.password) updates.password_hash = await hashPassword(form.password)
      const { error } = await supabase.from('app_users').update(updates).eq('id', modal.id)
      if (error) { setMsg({text:'บันทึกล้มเหลว: '+error.message, ok:false}); setSaving(false); return }
    }
    setMsg({text:'บันทึกสำเร็จ', ok:true})
    setSaving(false)
    setTimeout(() => { setModal(null); loadUsers() }, 600)
  }

  async function handleDelete(u) {
    if (!confirm(`ลบ user "${u.username}" ออกจากระบบ?`)) return
    await supabase.from('app_users').delete().eq('id', u.id)
    loadUsers()
  }

  return (
    <div>
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <h2 style={{ marginBottom:0 }}><i className="ti ti-users" style={{ color:'var(--pv)' }}></i> จัดการผู้ใช้งาน</h2>
          <button className="btn btn-purple" onClick={openAdd}><i className="ti ti-user-plus"></i> เพิ่ม User</button>
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:16 }}>จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึงระบบ</div>

        {loading ? (
          <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>กำลังโหลด...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Username</th><th>ชื่อ</th><th>Role</th><th>สถานะ</th><th>วันที่สร้าง</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u:any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight:700 }}>{u.username}</td>
                  <td>{u.full_name}</td>
                  <td><span className={'pill '+ROLE_CLASS[u.role]}>{ROLE_LABEL[u.role]}</span></td>
                  <td><span className={'pill '+(u.is_active?'pill-ok':'pill-danger')}>{u.is_active?'ใช้งาน':'ปิดใช้งาน'}</span></td>
                  <td style={{ color:'var(--muted)', fontSize:12 }}>{u.created_at?.slice(0,10)}</td>
                  <td style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-outline" style={{ padding:'6px 12px', fontSize:12 }} onClick={()=>openEdit(u)}><i className="ti ti-edit"></i></button>
                    <button className="btn btn-outline" style={{ padding:'6px 12px', fontSize:12, color:'var(--pink-dark)' }} onClick={()=>handleDelete(u)}><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={()=>setModal(null)}>
          <div className="card" style={{ maxWidth:440, width:'100%' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ color:'var(--pv)', marginBottom:0 }}>{modal==='add'?'เพิ่ม User ใหม่':'แก้ไข User'}</h2>
              <button className="btn btn-outline" style={{ padding:'6px 12px' }} onClick={()=>setModal(null)}><i className="ti ti-x"></i></button>
            </div>

            {[
              { label:'Username', key:'username', placeholder:'เช่น jsmith' },
              { label:'ชื่อ-นามสกุล', key:'full_name', placeholder:'เช่น สมชาย ใจดี' },
              { label: modal==='add'?'Password':'Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)', key:'password', placeholder:'กรอก password', type:'password' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <div className="field-label">{f.label}</div>
                <input type={f.type||'text'} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}

            <div style={{ marginBottom:12 }}>
              <div className="field-label">Role</div>
              <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
                <option value="admin">Admin — แก้ไขได้ทุกอย่าง</option>
                <option value="user">User — รับ/เบิกน้ำยาได้</option>
                <option value="viewer">Viewer — ดูข้อมูลได้อย่างเดียว</option>
              </select>
            </div>

            <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} style={{ width:'auto', height:'auto' }}/>
              <span style={{ fontSize:14, fontWeight:600 }}>เปิดใช้งาน</span>
            </div>

            {msg && <div className={'pill '+(msg.ok?'pill-ok':'pill-danger')} style={{ display:'block', marginBottom:14, padding:'10px 14px', fontSize:12 }}>{msg.text}</div>}
            <button className="btn btn-purple" style={{ width:'100%', justifyContent:'center' }} onClick={handleSave} disabled={saving}>
              <i className="ti ti-device-floppy"></i> {saving?'กำลังบันทึก...':'บันทึก'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
