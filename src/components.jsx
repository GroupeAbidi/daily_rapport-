import {
  Banknote,
  CheckCircle2,
  Factory,
  PackageCheck,
  Scale,
  Wheat,
} from 'lucide-react';
import { analyzeBalanceCollections, formatDate, formatMoney, formatNumber, summarizeReport } from './lib/report.js';

export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}abidi-logo.png`} alt="Groupe ABIDI" /></div>
      <div>
        <span>GROUPE ABIDI</span>
        <strong>Minoterie · Rapport Journalier</strong>
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  const published = status === 'PUBLISHED';
  return <span className={`status-pill ${published ? 'published' : 'draft'}`}>{published ? <CheckCircle2 size={14} /> : null}{published ? 'Validé' : 'Brouillon'}</span>;
}

export function SummaryCards({ report, reports = [], onOpen }) {
  const s = summarizeReport(report);
  const pdfSales = report.sales?.some((row) => row.source?.includes('PDF') || row.produit === 'CA PDF');
  const latestBalanceReport = [...reports]
    .filter((item) => item.report_date <= report.report_date && item.collections?.some((row) => row.source === 'BALANCE_CLIENT'))
    .sort((a, b) => b.report_date.localeCompare(a.report_date))[0];
  const balanceRows = latestBalanceReport?.collections?.filter((row) => row.source === 'BALANCE_CLIENT') || [];
  const totalClientBalance = balanceRows.reduce((sum, row) => sum + Number(row.solde || 0), 0);
  const collectionAnalysis = analyzeBalanceCollections(report.collections || []);
  const cards = [
    { key: 'production', icon: Factory, label: 'Production', value: `${formatNumber(s.productionQtx)} qtx`, note: `${report.production?.length || 0} lignes`, tone: 'red' },
    { key: 'wheat', icon: Wheat, label: 'Suivi Blé', value: `${formatNumber(s.wheatReceivedQtx)} qtx`, note: s.wheatShortageQtx ? `Manque ${formatNumber(s.wheatShortageQtx)} qtx` : 'Quota couvert', tone: 'gold' },
    { key: 'sales', icon: PackageCheck, label: 'Ventes', value: formatMoney(s.salesAmount), note: `${formatNumber(s.salesQtx)} qtx${pdfSales ? ' · CA PDF' : ''}`, tone: 'green' },
    { key: 'collections', icon: Banknote, label: 'Encaissements', value: formatMoney(s.collectionsAmount), note: `${formatNumber(s.recoveryRate)}% du CA du jour`, tone: 'ink' },
    { key: 'client-balance', view: 'collections', icon: Scale, label: 'Solde total clients', value: formatMoney(totalClientBalance), note: balanceRows.length ? `${balanceRows.length} clients · au ${formatDate(latestBalanceReport.report_date)}` : 'Importez une balance clients', tone: 'gold' },
    { key: 'previous-balance', view: 'collections', icon: Banknote, label: 'Ancien solde encaissé', value: formatMoney(collectionAnalysis.previousBalanceCollected), note: `${collectionAnalysis.previousBalanceClients} clients aujourd'hui`, tone: 'green' },
  ];
  return (
    <div className="summary-grid">
      {cards.map(({ key, view, icon: Icon, label, value, note, tone }) => (
        <button className={`summary-card tone-${tone}`} key={key} onClick={() => onOpen?.(view || key)}>
          <span className="summary-icon"><Icon size={20} /></span>
          <span className="summary-copy"><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
        </button>
      ))}
    </div>
  );
}
