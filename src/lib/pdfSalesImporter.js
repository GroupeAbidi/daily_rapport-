import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = typeof window === 'undefined'
  ? new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href
  : `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

const isoDate = (value) => {
  const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};

const amount = (value) => {
  const normalized = String(value || '')
    .replace(/[\s\u00a0\u202f�]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pageLines = (items) => {
  const rows = [];
  items.filter((item) => item.str?.trim()).forEach((item) => {
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2.5);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: item.transform[4], text: item.str.trim() });
  });
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '));
};

export async function parseSalesPdf(file) {
  if (!file?.name?.toLowerCase().endsWith('.pdf')) throw new Error('Sélectionnez un fichier PDF.');
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const transactions = [];
  let currentClient = '';
  let periodStart = '';
  let periodEnd = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = pageLines(content.items);

    lines.forEach((line) => {
      const period = line.match(/P[ée]riode du\s*:\s*(\d{2}\/\d{2}\/\d{4})\s+Au\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
      if (period) {
        periodStart = isoDate(period[1]);
        periodEnd = isoDate(period[2]);
      }

      const client = line.match(/Client\s*:\s*(.+?)(?:\s+Mont\.|$)/i);
      if (client) currentClient = client[1].trim().replace(/^C\d+\s+/i, '');
      if (!currentClient || /Totaux Client|Tatal G[ée]n[ée]ral/i.test(line)) return;

      const dateMatch = line.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (!dateMatch) return;
      const afterDate = line.slice((dateMatch.index || 0) + dateMatch[0].length);
      const amounts = afterDate.match(/-?[\d\s\u00a0\u202f�.]+,\d{2}/g);
      if (!amounts?.length) return;
      const beforeDate = line.slice(0, dateMatch.index).trim();
      const reference = beforeDate.match(/([A-Z]?\d{3,})\s*$/i)?.[1] || '';
      const montant = amount(amounts[0]);
      transactions.push({
        date: isoDate(dateMatch[1]),
        client: currentClient,
        produit: 'CA PDF',
        quantite_qtx: 0,
        montant_da: montant,
        reference,
      });
    });
  }

  if (!transactions.length) throw new Error('Aucune livraison client exploitable détectée dans ce PDF.');
  const salesByDate = transactions.reduce((groups, row) => {
    (groups[row.date] ||= []).push(row);
    return groups;
  }, {});
  return {
    source_file: file.name,
    pages: pdf.numPages,
    periodStart: periodStart || Object.keys(salesByDate).sort()[0],
    periodEnd: periodEnd || Object.keys(salesByDate).sort().at(-1),
    transactions,
    salesByDate,
  };
}
