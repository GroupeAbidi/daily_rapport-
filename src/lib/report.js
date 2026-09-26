const asNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const sum = (rows, key) => rows.reduce((total, row) => total + asNumber(row[key]), 0);

export const summarizeReport = (report) => {
  const productionQtx = sum(report.production || [], 'quantite_qtx');
  const quotaQtx = sum(report.wheat || [], 'quota_qtx');
  const wheatReceivedQtx = (report.wheat || []).reduce(
    (total, row) => total + asNumber(row.livre_groupe_qtx) + asNumber(row.livre_minoterie_qtx),
    0,
  );
  const wheatShortageQtx = Math.max(0, quotaQtx - wheatReceivedQtx);
  const salesQtx = sum(report.sales || [], 'quantite_qtx');
  const salesAmount = sum(report.sales || [], 'montant_da');
  const collectionsAmount = sum(report.collections || [], 'montant_da');
  const recoveryRate = salesAmount ? (collectionsAmount / salesAmount) * 100 : 0;

  return {
    productionQtx,
    quotaQtx,
    wheatReceivedQtx,
    wheatShortageQtx,
    salesQtx,
    salesAmount,
    collectionsAmount,
    recoveryRate,
  };
};

export const formatNumber = (value, digits = 1) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(Number(value) || 0);

export const formatMoney = (value) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value) || 0)} DA`;

export const formatDate = (date) => {
  if (!date) return '—';
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

export const groupBy = (rows, key, valueKey) => {
  const map = new Map();
  rows.forEach((row) => {
    const name = String(row[key] || 'Non défini').trim() || 'Non défini';
    map.set(name, (map.get(name) || 0) + asNumber(row[valueKey]));
  });
  return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};
