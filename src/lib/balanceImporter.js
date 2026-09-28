import * as XLSX from 'xlsx';

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const parseNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const compact = String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(/[^0-9,.-]/g, '');
  const cleaned = compact.includes(',') && !compact.includes('.') ? compact.replace(',', '.') : compact.replace(/,/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isoDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return '';
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

export async function parseClientBalance(file) {
  if (!/\.xls[xm]?$/i.test(file?.name || '')) throw new Error('Sélectionnez un fichier Excel .xls ou .xlsx.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => normalize(row[0]) === 'code' && normalize(row[1]) === 'nom');
  if (headerIndex < 0) throw new Error('Colonnes Code/Nom introuvables dans la balance client.');

  let periodStart = '';
  let periodEnd = '';
  rows.slice(0, headerIndex).forEach((row) => {
    row.forEach((cell, index) => {
      const key = normalize(cell);
      if (key === 'du :') periodStart = isoDate(row[index + 1]);
      if (key === 'au :') periodEnd = isoDate(row[index + 1]);
    });
  });

  const clients = rows.slice(headerIndex + 1).filter((row) => {
    const code = String(row[0] || '').trim();
    return code && row[1] && !normalize(code).startsWith('total');
  }).map((row) => ({
    client_code: String(row[0]).trim(),
    client: String(row[1] || '').trim(),
    solde_anterieur: parseNumber(row[4]),
    chiffre_affaire: parseNumber(row[8]),
    paiement: parseNumber(row[11]),
    solde: parseNumber(row[13]),
    pourcentage: parseNumber(row[16]),
  }));
  if (!clients.length) throw new Error('Aucun client détecté dans la balance.');
  if (!periodEnd) throw new Error('Date de fin « Au » introuvable dans la balance.');

  return {
    source_file: file.name,
    periodStart: periodStart || periodEnd,
    periodEnd,
    clients,
    isDaily: !periodStart || periodStart === periodEnd,
    totals: clients.reduce((total, row) => ({
      opening: total.opening + row.solde_anterieur,
      sales: total.sales + row.chiffre_affaire,
      payments: total.payments + row.paiement,
      closing: total.closing + row.solde,
    }), { opening: 0, sales: 0, payments: 0, closing: 0 }),
  };
}
