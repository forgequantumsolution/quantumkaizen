// Export utilities for PDF (print) and CSV/Excel

export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPrint(title: string) {
  const style = document.createElement('style');
  style.id = 'print-style';
  style.textContent = `
    @media print {
      body > *:not(#root) { display: none !important; }
      .no-print { display: none !important; }
      .print-break { page-break-before: always; }
      header, aside, nav, .sidebar { display: none !important; }
      main, #root > div > div > main { margin: 0 !important; padding: 0 !important; }
      @page { margin: 1.5cm; }
    }
  `;
  document.head.appendChild(style);
  document.title = title;
  window.print();
  setTimeout(() => {
    document.head.removeChild(style);
  }, 1000);
}
