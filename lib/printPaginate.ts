// ตัดหน้ากระดาษเองก่อนพิมพ์ เพื่อให้หัวตารางซ้ำทุกหน้า
// (Safari ไม่ทำซ้ำ <thead> ตอนพิมพ์ จึงพึ่ง CSS อย่างเดียวไม่ได้)
//
// ขั้นตอน: ใส่ class pg-print ที่ <html> ให้สไตล์การพิมพ์ทำงานบนจอ → คัดลอก .page-wrap เป็นสำเนากว้างเท่า A4
// → วัดความสูงแต่ละแถว แล้วแยกตารางเป็นตารางย่อยทีละหน้า (ใส่หัวตารางซ้ำ) → พิมพ์ → ลบสำเนาทิ้ง
// สำเนาอยู่นอก React จึงไม่กระทบหน้าเว็บจริง

const MM = 96 / 25.4
const MARGIN_MM = 10

function pageSize(landscape: boolean) {
  const w = (landscape ? 297 : 210) - MARGIN_MM*2
  const h = (landscape ? 210 : 297) - MARGIN_MM*2
  return { w, h: h * MM * 0.97 }   // เผื่อระยะปัดเศษของเบราว์เซอร์
}

// แถวหัวกลุ่ม (เช่น ชื่อประเภท) — ไม่ปล่อยค้างไว้ท้ายหน้า
const isGroupRow = (tr: HTMLTableRowElement) => tr.cells.length === 1 && tr.cells[0].colSpan > 1

// แยกตารางที่แถว cut: ย้ายแถวตั้งแต่ cut ไปไว้ในตารางใหม่ (มีหัวตารางชุดเดิม) บนหน้าถัดไป
function splitTable(table: HTMLTableElement, cut: HTMLTableRowElement) {
  const wrap = document.createElement('div')
  wrap.className = 'pg-break'
  const nt = table.cloneNode(false) as HTMLTableElement
  if (table.tHead) nt.appendChild(table.tHead.cloneNode(true))
  wrap.appendChild(nt)

  const startBody = cut.parentElement as HTMLTableSectionElement
  const bodies = Array.from(table.tBodies)
  const nb = startBody.cloneNode(false) as HTMLTableSectionElement
  let r: Element | null = cut
  while (r) { const next = r.nextElementSibling; nb.appendChild(r); r = next }
  nt.appendChild(nb)
  bodies.slice(bodies.indexOf(startBody) + 1).forEach(b => nt.appendChild(b))
  if (table.tFoot) nt.appendChild(table.tFoot)

  table.after(wrap)
  return nt
}

function paginate(out: HTMLElement, landscape: boolean) {
  const { h: H } = pageSize(landscape)
  const tables = Array.from(out.querySelectorAll('table')).filter(t =>
    t.tHead && !t.closest('[data-nopage]') && !t.parentElement?.closest('table')
  ) as HTMLTableElement[]

  let pageTop = out.getBoundingClientRect().top
  for (const t0 of tables) {
    let table = t0
    // เนื้อหาก่อนหน้าดันจนข้ามหน้าไปเอง
    const top = table.getBoundingClientRect().top
    while (top >= pageTop + H) pageTop += H

    for (let guard = 0; guard < 500; guard++) {
      const rows = Array.from(table.tBodies).flatMap(b => Array.from(b.rows))
      const limit = pageTop + H
      let cut = rows.findIndex(r => r.getBoundingClientRect().bottom > limit)
      const footOver = cut === -1 && table.tFoot && table.tFoot.getBoundingClientRect().bottom > limit
      if (cut === -1 && !footOver) break
      if (cut === -1) cut = rows.length - 1          // ให้ tfoot ไม่แยกจากแถวสุดท้าย
      // ไม่ตัดกลางกลุ่มแถวที่มีช่อง rowSpan (เช่น หลาย Lot ของน้ำยาตัวเดียว)
      const covered = new Array(rows.length).fill(false)
      rows.forEach((r, i) => Array.from(r.cells).forEach(c => {
        for (let k = 1; k < c.rowSpan && i+k < rows.length; k++) covered[i+k] = true
      }))
      while (cut > 0 && (covered[cut] || isGroupRow(rows[cut-1]))) cut--

      if (cut === 0) {
        // แถวแรกก็ไม่พอแล้ว ยกทั้งตารางไปหน้าถัดไป (ทำได้ครั้งเดียว)
        if (table.closest('.pg-break') || table.getBoundingClientRect().top - pageTop < 4) break
        const wrap = document.createElement('div')
        wrap.className = 'pg-break'
        table.before(wrap); wrap.appendChild(table)
        pageTop = wrap.getBoundingClientRect().top
        continue
      }
      table = splitTable(table, rows[cut])
      pageTop = (table.parentElement as HTMLElement).getBoundingClientRect().top
    }
  }
}

export function preparePrint() {
  const html = document.documentElement
  if (html.classList.contains('pg-print')) return
  // ฟอร์มประเมินผู้ขาย A4 จัดหน้าของตัวเองแล้ว
  if (document.body.classList.contains('print-annual')) return
  const root = document.querySelector('.page-wrap') as HTMLElement | null
  if (!root) return

  const landscape = !!root.querySelector('[data-print-landscape]')
  const { w } = pageSize(landscape)
  html.classList.add('pg-print')

  const style = document.createElement('style')
  style.id = 'pg-page'
  style.textContent =
    `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${MARGIN_MM}mm; ` +
    `@bottom-right { content: "หน้า " counter(page) " / " counter(pages); font-size: 9pt; color: #777; } }` +
    `html.pg-print .pg-out { width: ${w}mm; }`
  document.body.appendChild(style)   // ไว้ท้ายสุดให้ทับ @page พื้นฐานใน page.tsx

  const out = root.cloneNode(true) as HTMLElement
  out.removeAttribute('style')
  out.className = 'page-wrap pg-out'
  out.id = 'pg-out'
  document.body.appendChild(out)
  paginate(out, landscape)
}

export function cleanupPrint() {
  document.getElementById('pg-out')?.remove()
  document.getElementById('pg-page')?.remove()
  document.documentElement.classList.remove('pg-print')
}
