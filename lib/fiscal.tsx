'use client'
// ปีงบประมาณ (ต.ค.–ก.ย.) ที่เลือกจากหัวเว็บ ใช้ร่วมกันทุกแท็บ
import { createContext, useContext } from 'react'

// ปีงบเก็บเป็น ค.ศ. ของเดือน ก.ย. ที่ปิดปี เช่น 2026 = 1 ต.ค.2025 – 30 ก.ย.2026 (= ปีงบ 2569)
export function currentFY() {
  const d = new Date()
  return d.getMonth()+1 >= 10 ? d.getFullYear()+1 : d.getFullYear()
}

// เปิดเว็บมาเริ่มที่ปีงบปัจจุบันเสมอ
export const defaultFY = currentFY

export function fyRange(fy: number) {
  return { start: (fy-1)+'-10-01', end: fy+'-10-01' }   // end ใช้แบบ < (ไม่รวม)
}

export function fyList(n = 5) {
  const list: number[] = []
  for (let f = currentFY(); f > currentFY()-n; f--) list.push(f)
  return list
}

export const toBE = (fy: number) => fy + 543

const FYContext = createContext<{ fy: number; setFy: (fy: number) => void }>({ fy: defaultFY(), setFy: () => {} })
export const FYProvider = FYContext.Provider
export const useFY = () => useContext(FYContext)
