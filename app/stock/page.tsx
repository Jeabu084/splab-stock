'use client'
import { useState, useEffect } from 'react'
import { getSession, clearSession, canAccess } from '@/lib/auth'
import type { AppUser } from '@/lib/auth'
import TabHome from '@/components/TabHome'
import TabOverview from '@/components/TabOverview'
import TabUsage from '@/components/TabUsage'
import TabItems from '@/components/TabItems'
import TabHistory from '@/components/TabHistory'
import TabVendor from '@/components/TabVendor'
import TabSettings from '@/components/TabSettings'

const ALL_TABS = [
  { id: 'home',     label: 'HOME',         icon: 'ti-home',             bg: '#FEE3ED', fg: '#F0769E' },
  { id: 'overview', label: 'Overview',      icon: 'ti-layout-grid',      bg: '#ECEAFF', fg: '#7B6EF6' },
  { id: 'usage',    label: 'Usage',         icon: 'ti-report-analytics', bg: '#C9E4D8', fg: '#4A9B7F' },
  { id: 'items',    label: 'รายการน้ำยา',   icon: 'ti-list-details',     bg: '#FFF6E0', fg: '#B07A00' },
  { id: 'history',  label: 'Stock Card',    icon: 'ti-file-text',        bg: '#EBF7F9', fg: '#4AA5B0' },
  { id: 'vendor',   label: 'Vendor',        icon: 'ti-star',             bg: '#EAF1FE', fg: '#5B97E8' },
  { id: 'settings', label: 'Settings',      icon: 'ti-settings',         bg: '#F3F4F6', fg: '#6B7280' },
]

const ROLE_LABEL = { admin:'Admin', user:'User', viewer:'Viewer' }
const ROLE_COLOR = { admin:'var(--pink-dark)', user:'var(--gd)', viewer:'var(--bd)' }

export default function StockPage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { window.location.href = '/login'; return }
    setUser(session)
    setActiveTab(canAccess(session.role, 'home') ? 'home' : 'overview')
    setChecked(true)
  }, [])

  function handleLogout() {
    clearSession()
    window.location.href = '/login'
  }

  function handleTabClick(tabId: string) {
    if (!user || !canAccess(user.role, tabId)) return
    setActiveTab(tabId)
  }

  if (!checked) return null

  const visibleTabs = ALL_TABS.filter(t => user && canAccess(user.role, t.id))

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://unpkg.com/@tabler/icons-webfont@2.47.0/tabler-icons.min.css" />

      <style>{`
        :root {
          --teal:#5DB8C4; --teal-dark:#4AA5B0; --teal-bg:#EBF7F9;
          --pink:#FEA0BF; --pink-dark:#F0769E; --pink-light:#FEE3ED;
          --yellow:#FFE1A7; --yellow-dark:#FFC247; --yellow-bg:#FFF6E0;
          --pv:#7B6EF6; --pb:#ECEAFF;
          --bd:#5B97E8; --bb:#EAF1FE;
          --gd:#8FAF6E; --gb:#EFF5E9;
          --bg:#F4F7FB; --white:#FFFFFF;
          --text:#1E2D3A; --muted:#8FA0A8; --border:rgba(0,0,0,0.07);
          --shadow:0 2px 8px rgba(0,0,0,0.06);
          --shadow-md:0 4px 16px rgba(0,0,0,0.08);
        }
        * { font-family:'Plus Jakarta Sans','Noto Sans Thai',sans-serif; box-sizing:border-box; }
        body { background:var(--bg); color:var(--text); font-size:14px; }

        /* SHORTCUTS NAV */
        .shortcuts { display:grid; gap:10px; margin-bottom:20px; }
        .sc { background:var(--white); border-radius:18px; padding:22px 14px; text-align:center; cursor:pointer; box-shadow:var(--shadow); border:2px solid transparent; transition:all .18s; }
        .sc:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(0,0,0,0.09); }
        .sc:active { transform:scale(0.95); }
        .sc.active { border-color:currentColor; }
        .sc.disabled { opacity:0.35; cursor:not-allowed; }
        .sc.disabled:hover { transform:none; box-shadow:var(--shadow); }
        .sc-icon { width:56px; height:56px; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 14px; }
        .sc-label { font-size:13px; font-weight:800; }

        /* CARDS */
        .card { background:var(--white); border-radius:20px; padding:20px 22px; box-shadow:var(--shadow); }
        .card h2 { font-size:17px; font-weight:800; color:var(--text); margin:0 0 18px; display:flex; align-items:center; gap:9px; }
        .card h2 i { font-size:21px; }

        /* PILLS */
        .pill { display:inline-flex; align-items:center; font-size:10px; font-weight:700; padding:3px 10px; border-radius:99px; }
        .pill-ok { background:var(--gb); color:var(--gd); }
        .pill-warn { background:var(--yellow-bg); color:#B07A00; }
        .pill-danger { background:var(--pink-light); color:var(--pink-dark); }

        /* BUTTONS */
        .btn { display:inline-flex; align-items:center; gap:7px; border:none; border-radius:99px; padding:11px 22px; font-size:13px; font-weight:800; cursor:pointer; transition:all .15s; font-family:inherit; }
        .btn i { font-size:15px; }
        .btn:hover { transform:translateY(-2px); }
        .btn:active { transform:scale(0.96); }
        .btn-pink { background:var(--pink-dark); color:#fff; box-shadow:0 4px 12px rgba(240,118,158,.28); }
        .btn-purple { background:var(--pv); color:#fff; box-shadow:0 4px 12px rgba(123,110,246,.28); }
        .btn-teal { background:var(--teal); color:#fff; box-shadow:0 4px 12px rgba(93,184,196,.28); }
        .btn-outline { background:var(--white); color:var(--muted); border:1.5px solid var(--border); }
        .btn-outline:hover { background:var(--bg); }

        /* SCORE BUTTONS */
        .scoreopt { width:32px; height:32px; border-radius:50%; border:1.5px solid var(--border); background:#fff; font-weight:700; font-size:13px; color:var(--muted); cursor:pointer; transition:all .15s cubic-bezier(.34,1.56,.64,1); display:flex; align-items:center; justify-content:center; }
        .scoreopt:hover { border-color:var(--teal); color:var(--teal); }
        .scoreopt.sel { background:var(--teal); border-color:var(--teal); color:#fff; transform:scale(1.18); box-shadow:0 3px 8px rgba(93,184,196,.35); }
        .scoreopt-purple { background:#fff; border-color:var(--pb); color:var(--pv); }
        .scoreopt-purple:hover { border-color:var(--pv); color:var(--pv); background:var(--pb); }
        .scoreopt-purple.sel { background:var(--pv); border-color:var(--pv); color:#fff; transform:scale(1.18); box-shadow:0 3px 8px rgba(123,110,246,.35); }

        /* FORMS */
        .field-label { font-size:15px; font-weight:700; color:var(--muted); margin-bottom:7px; }
        .form-pink .field-label { color:var(--pink-dark); }
        .form-purple .field-label { color:var(--pv); }
        input, select, textarea {
          width:100%; background:var(--bg); border:1.5px solid var(--border); border-radius:12px;
          padding:0 15px; font-size:17px; color:var(--text); outline:none; font-family:inherit;
          transition:all .15s; height:52px; box-sizing:border-box; line-height:52px;
          -webkit-appearance:none; appearance:none;
        }
        select {
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' stroke='%238FA0A8' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
          background-repeat:no-repeat; background-position:right 15px center; padding-right:38px;
        }
        input:focus, select:focus, textarea:focus { border-color:var(--teal); background:#fff; }
        input:disabled, select:disabled { opacity:0.6; }
        textarea { height:100px; line-height:1.5; padding:13px 15px; resize:vertical; }

        /* TABLE */
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; color:var(--muted); font-weight:700; padding:10px 12px; border-bottom:1.5px solid var(--border); }
        td { padding:10px 12px; color:var(--text); border-bottom:1px solid var(--border); }
        tr:last-child td { border-bottom:none; }
        tr:hover td { background:#fafbfd; }

        /* BARS */
        .bar-wrap { background:#EDF4F5; border-radius:99px; height:8px; overflow:hidden; }
        .bar { height:100%; border-radius:99px; }

        /* OVERVIEW CARDS */
        .ov-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:10px; margin-bottom:8px; }
        .ov-card { position:relative; border-radius:14px; padding:14px 12px; text-align:center; cursor:default; transition:all .15s; border:1.5px solid transparent; }
        .ov-card:hover { box-shadow:var(--shadow-md); transform:translateY(-2px); border-color:var(--border); z-index:30; }
        .ov-card-name { font-size:12px; font-weight:700; color:var(--text); margin-bottom:6px; line-height:1.3; min-height:31px; display:flex; align-items:center; justify-content:center; }
        .ov-card-value { font-size:22px; font-weight:900; }
        .ov-tooltip { position:absolute; left:50%; top:100%; transform:translateX(-50%) translateY(4px); background:#fff; color:var(--text); border-radius:12px; padding:10px 14px; border:1.5px solid var(--border); font-size:12px; font-weight:600; white-space:nowrap; box-shadow:0 8px 20px rgba(0,0,0,0.14); z-index:20; opacity:0; pointer-events:none; transition:opacity .15s; }
        .ov-card:hover .ov-tooltip { opacity:1; }
        .ov-section-title { font-size:20px; font-weight:800; color:var(--teal-dark); margin:18px 0 8px; padding-left:2px; }
        .ov-section-title:first-child { margin-top:0; }

        /* GRID HELPERS */
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
        .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }

        @media print { .no-print { display:none!important; } }
      `}</style>

      <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'20px 24px 48px' }}>

          {/* TOPBAR */}
          <div style={{
            borderRadius:24, padding:'16px 26px', marginBottom:18, color:'#fff',
            background:'var(--teal)', boxShadow:'0 8px 24px rgba(93,184,196,0.35)',
            display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:16, background:'rgba(255,255,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
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
              <div>
                <div style={{ fontSize:22, fontWeight:900, letterSpacing:'0.5px' }}>SPLABSTOCK</div>
                <div style={{ fontSize:13, marginTop:3, opacity:0.9, fontWeight:500 }}>Reagent Inventory &amp; Vendor Evaluation System</div>
              </div>
            </div>
            {user && (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>{user.full_name}</div>
                  <div style={{ fontSize:12, opacity:0.85, fontWeight:600, color: ROLE_COLOR[user.role] }}>
                    ● {ROLE_LABEL[user.role]}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:99, padding:'8px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                >
                  <i className="ti ti-logout"></i> ออกจากระบบ
                </button>
              </div>
            )}
          </div>

          {/* SHORTCUTS */}
          <div className="shortcuts" style={{ gridTemplateColumns: `repeat(${visibleTabs.length},1fr)` }}>
            {visibleTabs.map(tab => (
              <div
                key={tab.id}
                className={'sc' + (activeTab===tab.id ? ' active' : '')}
                style={activeTab===tab.id ? { borderColor: tab.fg } : undefined}
                onClick={() => handleTabClick(tab.id)}
              >
                <div className="sc-icon" style={{ background: tab.bg, color: tab.fg }}>
                  <i className={'ti ' + tab.icon}></i>
                </div>
                <div className="sc-label" style={{ color: tab.fg }}>{tab.label}</div>
              </div>
            ))}
          </div>

          {/* CONTENT */}
          {activeTab==='home'     && <TabHome />}
          {activeTab==='overview' && <TabOverview />}
          {activeTab==='usage'    && <TabUsage />}
          {activeTab==='items'    && <TabItems />}
          {activeTab==='history'  && <TabHistory />}
          {activeTab==='vendor'   && <TabVendor />}
          {activeTab==='settings' && <TabSettings />}
        </div>
      </div>
    </>
  )
}
