import {
  Banknote,
  CheckCircle2,
  Factory,
  PackageCheck,
  Wheat,
} from 'lucide-react';
import { formatMoney, formatNumber, summarizeReport } from './lib/report.js';

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

export function SummaryCards({ report, onOpen }) {
  const s = summarizeReport(report);
  const cards = [
    { key: 'production', icon: Factory, label: 'Production', value: `${formatNumber(s.productionQtx)} qtx`, note: `${report.production?.length || 0} lignes`, tone: 'red' },
    { key: 'wheat', icon: Wheat, label: 'Suivi Blé', value: `${formatNumber(s.wheatReceivedQtx)} qtx`, note: s.wheatShortageQtx ? `Manque ${formatNumber(s.wheatShortageQtx)} qtx` : 'Quota couvert', tone: 'gold' },
    { key: 'sales', icon: PackageCheck, label: 'Ventes', value: formatMoney(s.salesAmount), note: `${formatNumber(s.salesQtx)} qtx`, tone: 'green' },
    { key: 'collections', icon: Banknote, label: 'Encaissements', value: formatMoney(s.collectionsAmount), note: `${formatNumber(s.recoveryRate)}% du CA du jour`, tone: 'ink' },
  ];
  return (
    <div className="summary-grid">
      {cards.map(({ key, icon: Icon, label, value, note, tone }) => (
        <button className={`summary-card tone-${tone}`} key={key} onClick={() => onOpen?.(key)}>
          <span className="summary-icon"><Icon size={20} /></span>
          <span className="summary-copy"><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
        </button>
      ))}
    </div>
  );
}
