'use client'
import { preparePrint } from '@/lib/printPaginate'

// ปุ่มพิมพ์ / บันทึก PDF — fileName จะเป็นชื่อไฟล์ตอนเลือก "บันทึกเป็น PDF"
// การคืนค่าหลังพิมพ์ (afterprint) อยู่ที่ app/stock/page.tsx
export default function PrintButton({ fileName, label = 'พิมพ์ / บันทึก PDF', className = 'btn btn-outline' }) {
  function print() {
    const old = document.title
    document.title = fileName
    preparePrint()
    window.print()
    document.title = old
  }
  return (
    <button className={className+' no-print'} onClick={print}>
      <i className="ti ti-printer"></i> {label}
    </button>
  )
}
