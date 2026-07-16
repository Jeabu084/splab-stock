'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DAYS_WARN = 90

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

const thMonth: Record<string, string> = {
  '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
  '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
  '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.',
}

export default function TabDashboard() {
  const [summary, setSummary] = useState<any[]>([])
  const [usage, setUsage] = useState<any[]>([])
  const [selItem, setSelItem] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('stock_summary').select('*'),
      supabase.from('master_items').select('item').order('item'),
    ]).then(([s, m]) => {
      setSummary(s.data || [])
      const allItems = [...new Set((m.data || []).map((r: any) => r.item))] as string[]
      setItems(allItems)
      if (allItems.length > 0) setSelItem(allItems[0])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selItem) return
    supabase.from('issues').select('date,qty').eq('item', selItem).then(({ data }) => {
      if (!data) return
      const map: Record<string, number> = {}
      data.forEach((r: any) => {
        const ym = String(r.date).slice(0, 7)
        map[ym] = (map[ym] || 0) + r.qty
      })
      const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      setUsage(sorted.map(([ym, qty]) => ({ ym, qty })))
    })
  }, [selItem])

  const nearExpiry = summary
    .filter(r => r.nearest_expire && daysUntil(r.nearest_expire) <= DAYS_WARN)
    .sort((a, b) => daysUntil(a.nearest_expire) - daysUntil(b.nearest_expire))

  const maxUsage = Math.max(...usage.map(u => u.qty), 1)
  const avgUsage = usage.length ? Math.round(usage.reduce((s, u) => s + u.qty, 0) / usage.length) : 0

  if (loading) return <div style={{ textAlign: 'center', padding: 64, color: '#9ca3af' }}>กำลังโหลด...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'รายการทั้งหมด', value: summary.length, color: '#7c6ff6', bg: '#f5f3ff' },
          { label: 'ใกล้หมดอายุ', value: nearExpiry.length, color: '#dc2626', bg: '#fef2f2', sub: 'ภายใน 90 วัน' },
          { label: 'สต็อกหมด', value: summary.filter(r => r.total_balance === 0).length, color: '#d97706', bg: '#fefce8', sub: 'รายการ' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: m.color, fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: m.color }}>{m.value}</div>
            {'sub' in m && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #ece9ff', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#2f2c84', marginBottom: 12 }}>
            ⚠️ น้ำยาใกล้หมดอายุ
            <span style={{ marginLeft: 8, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 99, fontSize: 12 }}>{nearExpiry.length} รายการ</span>
          </div>
          {nearExpiry.slice(0, 6).map((r, i) => {
            const d = daysUntil(r.nearest_expire)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f0ff' }}>
                <div style={{ width: 8, height: 8, borderRadius: 50, background: d <= 30 ? '#dc2626' : '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.item}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Exp {r.nearest_expire} · เหลือ {d} วัน</div>
                </div>
              </div>
            )
          })}
          {nearExpiry.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 16 }}>ไม่มีน้ำยาใกล้หมดอายุ 🎉</div>}
        </div>

        <div style={{ background: '#fff', border: '1px solid #ece9ff', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#2f2c84', marginBottom: 4 }}>📈 การใช้งานรายเดือน</div>
          <select value={selItem} onChange={e => setSelItem(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12, color: '#7c6ff6', background: '#f5f3ff' }}>
            {items.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          {usage.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
                {usage.map((u, i) => {
                  const mm = u.ym.split('-')[1]
                  const h = Math.round((u.qty / maxUsage) * 90)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{u.qty}</div>
                      <div style={{ width: '100%', height: h, background: '#7c6ff6', borderRadius: '4px 4px 0 0', opacity: i === usage.length - 1 ? 0.6 : 1 }} />
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{thMonth[mm] || mm}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                เฉลี่ย <b style={{ color: '#374151' }}>{avgUsage} หน่วย/เดือน</b>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24 }}>ยังไม่มีข้อมูลการเบิก</div>
          )}
        </div>
      </div>
    </div>
  )
}