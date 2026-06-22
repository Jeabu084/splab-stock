'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hashPassword, saveSession } from '@/lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!username || !password) { setError('กรุณากรอก username และ password'); return }
    setLoading(true); setError('')
    const hash = await hashPassword(password)
    const { data, error: e } = await supabase
      .from('app_users')
      .select('id,username,full_name,role')
      .eq('username', username.trim())
      .eq('password_hash', hash)
      .eq('is_active', true)
      .single()
    if (e || !data) {
      setError('username หรือ password ไม่ถูกต้อง')
      setLoading(false); return
    }
    saveSession({ id: data.id, username: data.username, full_name: data.full_name, role: data.role })
    window.location.href = '/stock'
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <link rel="stylesheet" href="https://unpkg.com/@tabler/icons-webfont@2.47.0/tabler-icons.min.css"/>
      <style>{`
        * { font-family:'Plus Jakarta Sans','Noto Sans Thai',sans-serif; box-sizing:border-box; margin:0; padding:0; }
        body { background:#EBF7F9; }
        input { width:100%; background:#F4F7FB; border:1.5px solid rgba(0,0,0,0.07); border-radius:12px; padding:0 15px; font-size:16px; color:#1E2D3A; outline:none; font-family:inherit; transition:all .15s; height:52px; -webkit-appearance:none; appearance:none; }
        input:focus { border-color:#4AA5B0; background:#fff; box-shadow:0 0 0 3px rgba(74,165,176,0.12); }
        input[type=password] { letter-spacing:2px; }
        input[type=password]::placeholder { letter-spacing:0; }
      `}</style>

      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #EBF7F9 0%, #ECEAFF 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>

        {/* decorative blobs */}
        <div style={{ position:'fixed', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(93,184,196,0.15)', pointerEvents:'none' }}/>
        <div style={{ position:'fixed', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(123,110,246,0.10)', pointerEvents:'none' }}/>

        <div style={{ background:'#fff', borderRadius:28, padding:'44px 48px', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(93,184,196,0.18), 0 2px 8px rgba(0,0,0,0.06)', position:'relative', zIndex:1 }}>

          {/* Logo */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ width:72, height:72, borderRadius:22, background:'linear-gradient(135deg, #5DB8C4, #4AA5B0)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(93,184,196,0.35)' }}>
              <svg width="38" height="38" viewBox="0 0 30 30" fill="none">
                <path d="M9 4C9 4 9 9 15 15C21 21 21 26 21 26" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M21 4C21 4 21 9 15 15C9 21 9 26 9 26" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
                <circle cx="9.5" cy="5" r="2.1" fill="#FFC247"/>
                <circle cx="20.5" cy="5" r="2.1" fill="#FEA0BF"/>
                <circle cx="9.5" cy="25" r="2.1" fill="#FEA0BF"/>
                <circle cx="20.5" cy="25" r="2.1" fill="#FFC247"/>
                <circle cx="11.3" cy="10.6" r="1.7" fill="#C9C1FF"/>
                <circle cx="18.7" cy="10.6" r="1.7" fill="#fff"/>
                <circle cx="18.7" cy="19.4" r="1.7" fill="#C9C1FF"/>
                <circle cx="11.3" cy="19.4" r="1.7" fill="#fff"/>
              </svg>
            </div>
            <div style={{ fontSize:26, fontWeight:900, color:'#1E2D3A', letterSpacing:'0.5px' }}>SPLABSTOCK</div>
            <div style={{ fontSize:13, color:'#8FA0A8', marginTop:5, fontWeight:500 }}>Reagent Inventory &amp; Vendor Evaluation</div>
          </div>

          {/* Fields */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#4AA5B0', marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-user" style={{ fontSize:14 }}></i> Username
            </div>
            <input
              placeholder="กรอก username"
              value={username}
              onChange={e=>setUsername(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#4AA5B0', marginBottom:7, display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-lock" style={{ fontSize:14 }}></i> Password
            </div>
            <input
              type="password"
              placeholder="กรอก password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleLogin()}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{ background:'#FEE3ED', color:'#F0769E', borderRadius:12, padding:'11px 16px', fontSize:13, fontWeight:600, marginBottom:18, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <i className="ti ti-alert-circle" style={{ fontSize:16 }}></i> {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width:'100%', background: loading ? '#8FA0A8' : 'linear-gradient(135deg, #5DB8C4, #4AA5B0)',
              color:'#fff', border:'none', borderRadius:99, padding:'15px',
              fontSize:16, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer',
              transition:'all .18s', boxShadow: loading ? 'none' : '0 6px 20px rgba(93,184,196,0.40)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
          >
            <i className="ti ti-login" style={{ fontSize:18 }}></i>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:'#B0BEC5' }}>
            SPLABSTOCK v4 · For Laboratory Use Only
          </div>
        </div>
      </div>
    </>
  )
}
