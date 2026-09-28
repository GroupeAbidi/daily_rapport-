import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Factory,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  History,
  Home,
  Info,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Target,
  Scale,
  Trash2,
  TrendingUp,
  LogOut,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  Wheat,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Brand, StatusPill, SummaryCards } from './components.jsx';
import { parseValidatedFile, validateImportedReport } from './lib/importer.js';
import { parseSalesPdf } from './lib/pdfSalesImporter.js';
import { parseClientBalance } from './lib/balanceImporter.js';
import { loadLocalReports, loadLocalSession, saveLocalReports, saveLocalSession } from './lib/localStore.js';
import {
  cloudEnabled,
  cloudLoadReports,
  cloudLoadSession,
  cloudClearReports,
  cloudPublishReport,
  cloudSignIn,
  cloudSignOut,
} from './lib/supabase.js';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  groupBy,
  summarizeReport,
} from './lib/report.js';

const COLORS = ['#7a3024', '#c99715', '#3f6f68', '#8f766c', '#d8b75a', '#5f6a68'];
const DEMO_ACCOUNTS = {
  analyst: { email: 'analyste@abidi.demo', password: 'demo1234', full_name: 'Analyste ABIDI', role: 'ANALYST' },
  manager: { email: 'manager@abidi.demo', password: 'demo1234', full_name: 'Manager ABIDI', role: 'MANAGER' },
};

const keepLatestReportPerDay = (items) => {
  const latest = new Map();
  items.forEach((item) => {
    const current = latest.get(item.report_date);
    if (!current || Number(item.version || 0) > Number(current.version || 0)) latest.set(item.report_date, item);
  });
  return [...latest.values()].sort((a, b) => `${b.report_date}-${b.version || 0}`.localeCompare(`${a.report_date}-${a.version || 0}`));
};

const normalizeClient = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const normalizeReference = (value) => {
  const reference = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return /^\d+$/.test(reference) ? String(Number(reference)) : reference;
};

const salesMatchKey = (row) => {
  const reference = normalizeReference(row.reference);
  return reference ? `${row.date}|REF|${reference}` : `${row.date}|CLIENT|${normalizeClient(row.client)}`;
};

const aggregateSalesRows = (rows, kind) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = salesMatchKey(row);
    const current = grouped.get(key) || { ...row, quantite_qtx: 0, montant_da: 0, products: [] };
    current.quantite_qtx += Number(row.quantite_qtx || 0);
    current.montant_da += Number(row.montant_da || 0);
    if (kind === 'excel' && row.produit && !current.products.includes(row.produit)) current.products.push(row.produit);
    grouped.set(key, current);
  });
  return grouped;
};

const salesDisplayRows = (sales = []) => {
  const excelGroups = aggregateSalesRows(sales.filter((row) => row.source === 'EXCEL_QTY'), 'excel');
  const pdfGroups = aggregateSalesRows(sales.filter((row) => row.source !== 'EXCEL_QTY'), 'pdf');
  const usedExcelKeys = new Set();
  const rows = [];

  pdfGroups.forEach((pdfRow, pdfKey) => {
    let excelKey = excelGroups.has(pdfKey) ? pdfKey : '';
    if (!excelKey) {
      excelKey = [...excelGroups.entries()].find(([key, row]) => !usedExcelKeys.has(key) && row.date === pdfRow.date && normalizeClient(row.client) === normalizeClient(pdfRow.client))?.[0] || '';
    }
    const excelRow = excelKey ? excelGroups.get(excelKey) : null;
    if (excelKey) usedExcelKeys.add(excelKey);
    rows.push({
      ...pdfRow,
      produit: excelRow?.products.join(' + ') || pdfRow.produit,
      quantite_qtx: excelRow?.quantite_qtx || 0,
      montant_da: pdfRow.montant_da,
    });
  });

  excelGroups.forEach((excelRow, key) => {
    if (!usedExcelKeys.has(key)) rows.push({ ...excelRow, produit: excelRow.products.join(' + '), montant_da: 0 });
  });
  return rows.sort((a, b) => String(a.reference || '').localeCompare(String(b.reference || ''), undefined, { numeric: true }));
};

const combinePdfCaWithExcelQuantities = (caRows = [], quantityRows = []) => {
  const pdfSales = caRows
    .filter((row) => row.source !== 'EXCEL_QTY')
    .map((row) => ({ ...row, quantite_qtx: 0, source: 'PDF_CA' }));
  const excelQuantities = quantityRows
    .filter((row) => row.source === 'EXCEL_QTY' || Number(row.montant_da || 0) === 0)
    .map((row) => ({ ...row, montant_da: 0, source: 'EXCEL_QTY' }));
  return [...pdfSales, ...excelQuantities];
};

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type || 'info'}`}>
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Fermer"><X size={16} /></button>
    </div>
  );
}

function Login({ busy, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    }
  };

  const demoLogin = async (kind) => {
    setError('');
    const account = DEMO_ACCOUNTS[kind];
    try {
      await onLogin(account.email, account.password, account);
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    }
  };

  return (
    <main className="login-page">
      <div className="login-glow one" />
      <div className="login-glow two" />
      <section className="login-card">
        <Brand />
        <div className="login-title">
          <span><ShieldCheck size={17} /> Accès sécurisé</span>
          <h1>Rapport journalier Minoterie</h1>
          <p>Production · Suivi Blé · Ventes · Encaissements clients</p>
        </div>

        {cloudEnabled ? (
          <form onSubmit={submit} className="login-form">
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.dz" required /></label>
            <label>Mot de passe<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></label>
            <button className="primary wide" disabled={busy}>{busy ? <><RefreshCw className="spin" size={17} /> Connexion…</> : 'Se connecter'}</button>
          </form>
        ) : (
          <div className="demo-login">
            <div className="demo-banner"><Info size={17} /><span><strong>Mode prototype local</strong> — aucune configuration Supabase nécessaire pour tester.</span></div>
            <button onClick={() => demoLogin('analyst')} disabled={busy}><span><UserRound size={19} /><b>Mon compte</b><small>Analyste / import et publication</small></span><ChevronRight size={18} /></button>
            <button onClick={() => demoLogin('manager')} disabled={busy}><span><LayoutDashboard size={19} /><b>Compte manager</b><small>Consultation uniquement</small></span><ChevronRight size={18} /></button>
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <footer>{cloudEnabled ? <><Cloud size={14} /> Mode Supabase activé</> : 'Prototype v0.1 · données de démonstration locales'}</footer>
      </section>
    </main>
  );
}

function Header({ session, report, onLogout, onImport, onImportSales, onImportBalance, onClear }) {
  const analyst = session.profile.role === 'ANALYST';
  return (
    <header className="app-header">
      <Brand compact />
      <div className="header-actions">
        {analyst && <button className="header-import ca-import" onClick={onImportSales}><FileText size={17} /><span>CA PDF</span></button>}
        {analyst && <button className="header-import balance-import" onClick={onImportBalance}><Scale size={17} /><span>Balance clients</span></button>}
        {analyst && <button className="header-import" onClick={onImport}><Upload size={17} /><span>Rapport Excel</span></button>}
        <div className="user-chip">
          <div><strong>{session.profile.full_name}</strong><small>{analyst ? 'Analyste' : 'Manager'}</small></div>
          <span>{session.profile.full_name?.charAt(0) || 'A'}</span>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Déconnexion"><LogOut size={18} /></button>
        {analyst && <button className="icon-button danger-button" onClick={onClear} aria-label="Effacer toutes les données" title="Effacer toutes les données"><Trash2 size={17}/></button>}
      </div>
      {report && <div className="header-report-state"><StatusPill status={report.status} /><span>{formatDate(report.report_date)}</span></div>}
    </header>
  );
}

function BottomNav({ view, setView }) {
  const items = [
    ['home', Home, 'Accueil'],
    ['production', Factory, 'Production'],
    ['wheat', Wheat, 'Blé'],
    ['sales', PackageCheck, 'Ventes'],
    ['collections', Banknote, 'Encaissement'],
  ];
  return (
    <nav className="bottom-nav">
      {items.map(([key, Icon, label]) => (
        <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>
          <Icon size={20} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Hero({ report, role, onImport }) {
  const s = summarizeReport(report);
  const analyst = role === 'ANALYST';
  return (
    <section className="hero-panel">
      <div className="hero-copy">
        <span className="eyebrow"><CalendarDays size={15} /> Rapport du {formatDate(report.report_date)}</span>
        <h1>Minoterie — synthèse journalière</h1>
        <p>{report.note || 'Aucune observation analyste pour cette journée.'}</p>
        <div className="hero-meta"><StatusPill status={report.status} /><span>v{report.version || 1}</span><span>Publié {formatDateTime(report.published_at)}</span></div>
      </div>
      <div className="hero-score">
        <small>Taux de recouvrement</small>
        <strong>{formatNumber(s.recoveryRate)}%</strong>
        <span>{formatMoney(s.collectionsAmount)} encaissés</span>
      </div>
      {analyst && <button className="hero-import" onClick={onImport}><Upload size={18} /> Importer le rapport validé</button>}
    </section>
  );
}

function HomeView({ report, setView, reports, onSelectReport, role, onImport }) {
  const s = summarizeReport(report);
  const pdfSales = report.sales?.some((row) => row.source?.includes('PDF') || row.produit === 'CA PDF');
  const trendData = useMemo(() => reports
    .filter((item) => item.status === 'PUBLISHED')
    .slice(0, 7)
    .reverse()
    .map((item) => {
      const summary = summarizeReport(item);
      return {
        date: formatDate(item.report_date).slice(0, 5),
        Production: summary.productionQtx,
        Ventes: summary.salesQtx,
        Recouvrement: Math.min(summary.recoveryRate, 140),
      };
    }), [reports]);
  const productionCoverage = s.wheatReceivedQtx ? (s.productionQtx / s.wheatReceivedQtx) * 100 : 0;
  const salesCoverage = s.productionQtx ? (s.salesQtx / s.productionQtx) * 100 : 0;
  const alerts = [
    s.wheatShortageQtx > 0 && `${formatNumber(s.wheatShortageQtx)} qtx de blé manquants sur le quota`,
    s.recoveryRate < 80 && `Recouvrement à ${formatNumber(s.recoveryRate)}%, sous le seuil de 80%`,
    salesCoverage < 60 && `Seulement ${formatNumber(salesCoverage)}% de la production vendue`,
  ].filter(Boolean);
  return (
    <>
      <Hero report={report} role={role} onImport={onImport} />
      <div className="date-toolbar">
        <div><CalendarDays size={18}/><span><strong>Journée affichée</strong><small>Le jour le plus récent est sélectionné automatiquement</small></span></div>
        <select value={report.id} onChange={(event) => {
          const selectedReport = reports.find((item) => item.id === event.target.value);
          if (selectedReport) onSelectReport(selectedReport);
        }} aria-label="Choisir la date du rapport">
          {reports.filter((item) => item.status === 'PUBLISHED').map((item) => <option key={item.id} value={item.id}>{formatDate(item.report_date)} · v{item.version || 1}</option>)}
        </select>
      </div>
      <SummaryCards report={report} reports={reports} onOpen={setView} />
      <section className="analysis-grid">
        <ChartPanel title="Production et ventes sur 7 rapports" note="qtx">
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7a3024" stopOpacity={0.28}/><stop offset="95%" stopColor="#7a3024" stopOpacity={0}/></linearGradient>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3f6f68" stopOpacity={0.24}/><stop offset="95%" stopColor="#3f6f68" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eee7df" strokeDasharray="4 4"/>
              <XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip/>}/><Legend/>
              <Area type="monotone" dataKey="Production" unit=" qtx" stroke="#7a3024" strokeWidth={3} fill="url(#productionFill)" activeDot={{ r: 5 }}/>
              <Area type="monotone" dataKey="Ventes" unit=" qtx" stroke="#3f6f68" strokeWidth={3} fill="url(#salesFill)" activeDot={{ r: 5 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <article className="panel insight-panel">
          <header className="panel-header"><div><span>Pilotage</span><h2>Indicateurs de performance</h2></div><Activity size={20}/></header>
          <div className="performance-list">
            <PerformanceRow icon={Target} label="Rendement réception → production" value={productionCoverage} target={95} numerator={s.productionQtx} denominator={s.wheatReceivedQtx} numeratorLabel="كمية الإنتاج" denominatorLabel="كمية القمح المستلم" unit="qtx" explanation="يوضح كمية الإنتاج المحققة مقابل القمح المستلم خلال اليوم."/>
            <PerformanceRow icon={TrendingUp} label="Écoulement de la production" value={pdfSales && !s.salesQtx ? NaN : salesCoverage} target={80} numerator={s.salesQtx} denominator={s.productionQtx} numeratorLabel="الكمية المباعة" denominatorLabel="الكمية المنتجة" unit="qtx" explanation={pdfSales && !s.salesQtx ? "أعد استيراد ملف Excel لربط كميات البيع بفواتير PDF." : "يوضح نسبة الكمية المباعة مقارنة بإنتاج اليوم. الكميات مأخوذة من Excel ورقم الأعمال مأخوذ من PDF، ويتم الربط برقم الفاتورة."}/>
            <PerformanceRow icon={Banknote} label="Recouvrement du chiffre d'affaires" value={s.recoveryRate} target={90} numerator={s.collectionsAmount} denominator={s.salesAmount} numeratorLabel="المبالغ المحصلة" denominatorLabel="قيمة المبيعات" unit="money" explanation="يوضح المبلغ المحصل فعليًا مقارنة بقيمة مبيعات اليوم."/>
          </div>
          <div className={`alert-box ${alerts.length ? 'warning' : 'success'}`}>
            {alerts.length ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>} 
            <div><strong>{alerts.length ? `${alerts.length} point${alerts.length > 1 ? 's' : ''} d'attention` : 'Situation maîtrisée'}</strong><span>{alerts[0] || 'Tous les principaux indicateurs sont dans les objectifs.'}</span></div>
          </div>
        </article>
      </section>
      <section className="home-grid">
        <article className="panel">
          <header className="panel-header"><div><span>Lecture du jour</span><h2>Résumé opérationnel</h2></div><CheckCircle2 size={20} /></header>
          <div className="decision-list">
            <div><span>Production</span><strong>{formatNumber(s.productionQtx)} qtx</strong><small>Produit fini déclaré</small></div>
            <div><span>Blé reçu</span><strong>{formatNumber(s.wheatReceivedQtx)} qtx</strong><small>sur {formatNumber(s.quotaQtx)} qtx de quota</small></div>
            <div><span>Ventes</span><strong>{formatMoney(s.salesAmount)}</strong><small>{formatNumber(s.salesQtx)} qtx · {pdfSales ? 'CA PDF' : 'Excel'}</small></div>
            <div><span>Encaissements</span><strong>{formatMoney(s.collectionsAmount)}</strong><small>{formatNumber(s.recoveryRate)}% du chiffre du jour</small></div>
          </div>
        </article>
        <HistoryCard reports={reports} selected={report} onSelect={onSelectReport} />
      </section>
    </>
  );
}

function PerformanceRow({ icon: Icon, label, value, target, numerator, denominator, numeratorLabel, denominatorLabel, unit, explanation }) {
  const available = Number.isFinite(value);
  const safeValue = available ? value : 0;
  const progress = Math.min(100, Math.max(0, (safeValue / target) * 100));
  const tone = safeValue >= target ? 'good' : safeValue >= target * .75 ? 'medium' : 'low';
  const formattedNumerator = unit === 'money' ? formatMoney(numerator) : `${formatNumber(numerator)} qtx`;
  const formattedDenominator = unit === 'money' ? formatMoney(denominator) : `${formatNumber(denominator)} qtx`;
  return <details className="performance-item">
    <summary className="performance-row"><span className={`performance-icon ${tone}`}><Icon size={17}/></span><div><span>{label}</span><div className="progress-track"><i className={tone} style={{ width: `${progress}%` }}/></div><small>{available ? `Objectif ${target}%` : 'Quantités absentes du PDF'} · Cliquer pour comprendre</small></div><strong>{available ? `${formatNumber(safeValue)}%` : 'N/D'}</strong><ChevronRight className="performance-chevron" size={16}/></summary>
    <div className="performance-explanation" dir="rtl"><strong>{explanation}</strong>{available && <><div><span>{numeratorLabel}</span><b>{formattedNumerator}</b></div><div><span>{denominatorLabel}</span><b>{formattedDenominator}</b></div><code>({formattedNumerator} ÷ {formattedDenominator}) × 100 = {formatNumber(safeValue)}%</code></>}</div>
  </details>;
}

function HistoryCard({ reports, selected, onSelect }) {
  const published = useMemo(() => reports.filter((r) => r.status === 'PUBLISHED'), [reports]);
  return (
    <article className="panel history-card">
      <header className="panel-header"><div><span>Historique</span><h2>Derniers rapports</h2></div><History size={20} /></header>
      <div className="history-list">
        {published.map((item) => {
          const s = summarizeReport(item);
          return <button key={item.id || `${item.report_date}-${item.version}`} className={item.id === selected.id ? 'active' : ''} onClick={() => onSelect(item)}>
            <div><strong>{formatDate(item.report_date)}</strong><small>v{item.version || 1} · {formatNumber(s.productionQtx)} qtx production</small></div>
            <span>{formatMoney(s.collectionsAmount)}</span><ChevronRight size={17} />
          </button>;
        })}
      </div>
    </article>
  );
}

function SectionTitle({ icon: Icon, kicker, title, note, onBack }) {
  return (
    <section className="section-title">
      <button onClick={onBack}><ArrowLeft size={18} /></button>
      <div><span><Icon size={16} /> {kicker}</span><h1>{title}</h1><p>{note}</p></div>
    </section>
  );
}

function ChartTooltip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label || payload[0]?.name}</strong>{payload.map((item) => {
    const isMoney = money || item.dataKey === 'CA ventes';
    return <span key={`${item.dataKey}-${item.name}`}>{item.name}: {isMoney ? formatMoney(item.value) : `${formatNumber(item.value)}${item.unit || ''}`}</span>;
  })}</div>;
}

function ProductionView({ report, onBack }) {
  const byProduct = groupBy(report.production || [], 'produit', 'quantite_qtx');
  const bySite = groupBy(report.production || [], 'site', 'quantite_qtx');
  const total = summarizeReport(report).productionQtx;
  return (
    <>
      <SectionTitle icon={Factory} kicker="Production" title="Production du jour" note="Lecture des quantités produites par produit et par site." onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Production totale" value={`${formatNumber(total)} qtx`} /><MiniKpi label="Produits" value={byProduct.length} /><MiniKpi label="Lignes" value={report.production.length} /></div>
      <section className="two-grid">
        <ChartPanel title="Production par produit" note="qtx"><ResponsiveContainer width="100%" height={290}><BarChart data={byProduct} layout="vertical" margin={{ left: 12, right: 18 }}><CartesianGrid horizontal={false} stroke="#e8e0d6"/><XAxis type="number" axisLine={false} tickLine={false}/><YAxis dataKey="name" type="category" width={105} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="value" name="Production qtx" fill="#7a3024" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></ChartPanel>
        <ChartPanel title="Répartition par site" note="G / M"><ResponsiveContainer width="100%" height={290}><PieChart><Pie data={bySite} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={4}>{bySite.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartPanel>
      </section>
      <DataTable columns={[['date','Date'],['site','Site'],['produit','Produit'],['quantite_qtx','Quantité qtx']]} rows={report.production} numberKeys={['quantite_qtx']} />
    </>
  );
}

function WheatView({ report, onBack }) {
  const rows = (report.wheat || []).map((row) => ({ ...row, recu_qtx: Number(row.livre_groupe_qtx || 0) + Number(row.livre_minoterie_qtx || 0), manque_qtx: Math.max(0, Number(row.quota_qtx || 0) - Number(row.livre_groupe_qtx || 0) - Number(row.livre_minoterie_qtx || 0)) }));
  const s = summarizeReport(report);
  const chart = rows.map((row) => ({ name: formatDate(row.date).slice(0,5), Groupe: row.livre_groupe_qtx, Minoterie: row.livre_minoterie_qtx, Quota: row.quota_qtx }));
  return (
    <>
      <SectionTitle icon={Wheat} kicker="Suivi Blé" title="Blé reçu et quota" note="Contrôle journalier du quota et des quantités reçues Groupe / Minoterie." onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Quota" value={`${formatNumber(s.quotaQtx)} qtx`} /><MiniKpi label="Reçu" value={`${formatNumber(s.wheatReceivedQtx)} qtx`} tone="green" /><MiniKpi label="Manque" value={`${formatNumber(s.wheatShortageQtx)} qtx`} tone={s.wheatShortageQtx ? 'red' : 'green'} /></div>
      <ChartPanel title="Répartition du blé reçu" note="qtx"><ResponsiveContainer width="100%" height={310}><BarChart data={chart}><CartesianGrid vertical={false} stroke="#e8e0d6"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Legend/><Bar dataKey="Groupe" stackId="a" fill="#c99715" radius={[0,0,0,0]}/><Bar dataKey="Minoterie" stackId="a" fill="#7a3024" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <DataTable columns={[['date','Date'],['quota_qtx','Quota qtx'],['livre_groupe_qtx','Groupe qtx'],['livre_minoterie_qtx','Minoterie qtx'],['manque_qtx','Manque qtx'],['observation','Observation']]} rows={rows} numberKeys={['quota_qtx','livre_groupe_qtx','livre_minoterie_qtx','manque_qtx']} />
    </>
  );
}

function SalesView({ report, onBack }) {
  const s = summarizeReport(report);
  const pdfMode = report.sales?.some((row) => row.source?.includes('PDF') || row.produit === 'CA PDF');
  const displayRows = pdfMode ? salesDisplayRows(report.sales || []) : report.sales;
  const clients = groupBy(report.sales || [], 'client', 'montant_da').slice(0, 8);
  const products = groupBy(report.sales || [], 'produit', 'quantite_qtx');
  return (
    <>
      <SectionTitle icon={PackageCheck} kicker="Ventes" title="Ventes du jour" note={pdfMode ? "Chiffre d'affaires HT issu du PDF des livraisons clients." : "Quantités vendues, chiffre d'affaires et principaux clients."} onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Quantité vendue" value={`${formatNumber(s.salesQtx)} qtx`} /><MiniKpi label="Chiffre d'affaires HT" value={formatMoney(s.salesAmount)} tone="green" /><MiniKpi label="Clients" value={new Set(displayRows.map((r) => normalizeClient(r.client))).size} /></div>
      <section className="two-grid">
        <ChartPanel title="CA par client" note="DA"><ResponsiveContainer width="100%" height={300}><BarChart data={clients} layout="vertical" margin={{ left: 12, right: 18 }}><CartesianGrid horizontal={false} stroke="#e8e0d6"/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip money/>}/><Bar dataKey="value" name="CA" fill="#3f6f68" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></ChartPanel>
        <ChartPanel title="Quantité par produit" note="qtx"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={products} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{products.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartPanel>
      </section>
      <DataTable columns={pdfMode ? [['date','Date'],['client','Client'],['reference','Facture'],['produit','Produit'],['quantite_qtx','Quantité qtx'],['montant_da','Montant HT']] : [['date','Date'],['client','Client'],['produit','Produit'],['quantite_qtx','Quantité qtx'],['montant_da','Montant']]} rows={displayRows} numberKeys={['quantite_qtx']} moneyKeys={['montant_da']} searchKey="client" searchPlaceholder="Rechercher un client…" />
    </>
  );
}

const buildClientRecovery = (reports, clientName) => {
  const key = normalizeClient(clientName);
  const ordered = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date));
  const balances = ordered.flatMap((report) => (report.collections || [])
    .filter((row) => row.source === 'BALANCE_CLIENT' && normalizeClient(row.client) === key)
    .map((row) => ({ ...row, date: row.date || report.report_date })));
  const invoices = ordered.flatMap((report) => (report.sales || [])
    .filter((row) => row.source !== 'EXCEL_QTY' && Number(row.montant_da || 0) > 0 && normalizeClient(row.client) === key)
    .map((row) => ({ date: row.date || report.report_date, reference: row.reference || 'Sans référence', montant_da: Number(row.montant_da || 0) })));
  const firstBalance = balances[0];
  const debts = firstBalance && Number(firstBalance.solde_anterieur || 0) > 0
    ? [{ date: firstBalance.date, reference: 'Solde antérieur', montant_da: Number(firstBalance.solde_anterieur), paid: 0 }]
    : [];
  invoices.forEach((invoice) => debts.push({ ...invoice, paid: 0 }));
  debts.sort((a, b) => a.date.localeCompare(b.date));

  let unapplied = 0;
  balances.forEach((payment) => {
    let available = Math.max(0, Number(payment.montant_da || 0));
    debts.filter((debt) => debt.date <= payment.date).forEach((debt) => {
      const remaining = debt.montant_da - debt.paid;
      const applied = Math.min(available, Math.max(0, remaining));
      debt.paid += applied;
      available -= applied;
    });
    unapplied += available;
  });
  debts.forEach((debt) => {
    debt.remaining = Math.max(0, debt.montant_da - debt.paid);
    debt.status = debt.remaining <= 0.01 ? 'Encaissée' : debt.paid > 0 ? 'Partiellement encaissée' : 'Non encaissée';
  });
  return { balances, debts, latest: balances.at(-1), unapplied };
};

function ClientRecoveryPanel({ reports }) {
  const balanceRows = reports.flatMap((report) => (report.collections || []).filter((row) => row.source === 'BALANCE_CLIENT'));
  const clients = [...new Map(balanceRows.map((row) => [normalizeClient(row.client), row.client])).entries()]
    .map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  const [query, setQuery] = useState('');
  const selected = query.trim() ? clients.find((client) => client.key.includes(normalizeClient(query))) : clients[0];
  const recovery = selected ? buildClientRecovery(reports, selected.name) : null;
  const latest = recovery?.latest;
  const balance = Number(latest?.solde || 0);
  const accountStatus = balance <= 0 ? 'Soldé / crédit client' : Number(latest?.montant_da || 0) > 0 ? 'Paiement enregistré' : 'Solde à recouvrer';

  if (!clients.length) return null;
  return <article className="panel recovery-panel">
    <header className="panel-header"><div><span>Suivi clients</span><h2>Recouvrement des ventes antérieures</h2></div><small>FIFO estimatif</small></header>
    <div className="recovery-search">
      <label><Search size={17}/><input list="recovery-clients" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client…"/></label>
      <datalist id="recovery-clients">{clients.map((client) => <option key={client.key} value={client.name}/>)}</datalist>
      <small>Sans référence de règlement, les paiements sont affectés automatiquement aux dettes les plus anciennes.</small>
    </div>
    {selected && <>
      <div className="preview-grid recovery-kpis"><MiniKpi label="Client" value={selected.name}/><MiniKpi label="Paiement importé" value={formatMoney(latest?.montant_da || 0)}/><MiniKpi label="Solde actuel" value={formatMoney(balance)} tone={balance > 0 ? 'red' : 'green'}/><MiniKpi label="Situation" value={accountStatus}/></div>
      <DataTable title="Affectation estimative des paiements" columns={[['date','Date vente'],['reference','Facture / origine'],['montant_da','Montant HT'],['paid','Affecté'],['remaining','Reste'],['status','État']]} rows={recovery.debts} moneyKeys={['montant_da','paid','remaining']} />
      {recovery.unapplied > 0.01 && <div className="validation-ok"><CheckCircle2 size={18}/><span>{formatMoney(recovery.unapplied)} de paiement reste non affecté aux factures disponibles.</span></div>}
    </>}
  </article>;
}

function CollectionsView({ report, reports, onBack }) {
  const s = summarizeReport(report);
  const balanceRows = (report.collections || []).filter((row) => row.source === 'BALANCE_CLIENT');
  const paymentRows = (report.collections || []).filter((row) => Number(row.montant_da || 0) !== 0);
  const clients = groupBy(paymentRows, 'client', 'montant_da').slice(0, 10);
  const modes = groupBy(paymentRows, 'mode_paiement', 'montant_da');
  return (
    <>
      <SectionTitle icon={Banknote} kicker="Encaissements clients" title="Encaissements du jour" note="Montants réellement encaissés, par client et par mode de paiement." onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Total encaissé" value={formatMoney(s.collectionsAmount)} tone="green" /><MiniKpi label="Taux recouvrement" value={`${formatNumber(s.recoveryRate)}%`} /><MiniKpi label="Clients encaissés" value={new Set(paymentRows.map((r) => r.client)).size} /></div>
      <section className="two-grid">
        <ChartPanel title="Encaissement par client" note="DA"><ResponsiveContainer width="100%" height={Math.max(380, clients.length * 46)}><BarChart data={clients} layout="vertical" margin={{ left: 8, right: 22, top: 8, bottom: 8 }} barCategoryGap="28%"><CartesianGrid horizontal={false} stroke="#e8e0d6"/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={165} axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 10, fill: '#625b57' }}/><Tooltip content={<ChartTooltip money/>}/><Bar dataKey="value" name="Encaissé" fill="#c99715" radius={[0,7,7,0]} maxBarSize={25}/></BarChart></ResponsiveContainer></ChartPanel>
        <ChartPanel title="Modes de paiement" note="répartition"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={modes} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{modes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip money/>}/><Legend/></PieChart></ResponsiveContainer></ChartPanel>
      </section>
      <DataTable key={`payments-${report.id}`} title="Encaissements du jour" columns={[['date','Date'],['client','Client'],['montant_da','Montant'],['mode_paiement','Mode paiement'],['reference','Référence']]} rows={paymentRows} moneyKeys={['montant_da']} />
      <DataTable key={`balance-${report.id}`} title="Balance clients" columns={[['client_code','Code'],['client','Client'],['solde_anterieur','Solde antérieur'],['chiffre_affaire',"Chiffre d'affaires"],['montant_da','Paiement'],['solde','Nouveau solde']]} rows={balanceRows} moneyKeys={['solde_anterieur','chiffre_affaire','montant_da','solde']} />
      <ClientRecoveryPanel reports={reports} />
    </>
  );
}

function MiniKpi({ label, value, tone = '' }) {
  return <article className={`mini-kpi ${tone}`}><small>{label}</small><strong>{value}</strong></article>;
}

function ChartPanel({ title, note, children }) {
  return <article className="panel chart-panel"><header className="panel-header"><div><span>Analyse</span><h2>{title}</h2></div><small>{note}</small></header><div className="chart-wrap">{children}</div></article>;
}

function DataTable({ title = 'Données du rapport', columns, rows, numberKeys = [], moneyKeys = [], searchKey = '', searchPlaceholder = '' }) {
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);
  const visibleRows = searchKey && query.trim()
    ? rows.filter((row) => normalizeClient(row[searchKey]).includes(normalizeClient(query)))
    : rows;
  return (
    <article className="panel table-panel">
      <header className="panel-header table-panel-header"><div><span>Détail</span><h2>{title}</h2></div><div className="table-header-actions"><small>{visibleRows.length}{query.trim() ? ` / ${rows.length}` : ''} lignes</small><button type="button" onClick={() => setHidden((value) => !value)} aria-expanded={!hidden}>{hidden ? <Eye size={15}/> : <EyeOff size={15}/>}<span>{hidden ? 'Afficher' : 'Masquer'}</span></button></div></header>
      {!hidden && <>
        {searchKey && <label className="table-search"><Search size={17}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder || 'Rechercher…'} aria-label={searchPlaceholder || 'Rechercher'}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Effacer la recherche"><X size={15}/></button>}</label>}
        <div className="table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{visibleRows.length ? visibleRows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{moneyKeys.includes(key) ? formatMoney(row[key]) : numberKeys.includes(key) ? formatNumber(row[key]) : key === 'date' ? formatDate(row[key]) : row[key] || '—'}</td>)}</tr>) : <tr><td colSpan={columns.length}>Aucune donnée trouvée.</td></tr>}</tbody></table></div>
      </>}
    </article>
  );
}

function ImportModal({ onClose, onPublish, publishing }) {
  const inputRef = useRef();
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState('');

  const readFile = async (file) => {
    if (!file) return;
    setReading(true);
    setErrors([]);
    try {
      const parsed = await parseValidatedFile(file);
      setDraft(parsed);
      setNote(parsed.note || '');
      setErrors(validateImportedReport(parsed));
    } catch (err) {
      setErrors([err.message || 'Impossible de lire ce fichier.']);
      setDraft(null);
    } finally {
      setReading(false);
    }
  };

  const summary = draft ? summarizeReport(draft) : null;
  const publish = async () => {
    const final = { ...draft, note };
    const currentErrors = validateImportedReport(final);
    setErrors(currentErrors);
    if (!currentErrors.length) await onPublish(final);
  };

  return (
    <div className="modal-backdrop">
      <section className="import-modal" role="dialog" aria-modal="true">
        <header><div><span>Analyste</span><h2>Importer le rapport journalier validé</h2></div><button className="icon-button" onClick={onClose}><X size={20}/></button></header>
        {!draft ? (
          <div className="drop-zone" onClick={() => inputRef.current?.click()}>
            {reading ? <RefreshCw className="spin" size={36}/> : <FileSpreadsheet size={40}/>}<strong>{reading ? 'Lecture du fichier…' : 'Choisir le fichier validé'}</strong><span>Excel .xlsx / .xls ou JSON</span><small>Production, suivi blé et encaissements. Le CA ventes est importé séparément depuis le PDF.</small>
            <button className="primary"><Upload size={17}/> Parcourir</button>
          </div>
        ) : (
          <>
            <div className="import-file"><FileSpreadsheet size={22}/><div><strong>{draft.source_file}</strong><small>Rapport détecté : {formatDate(draft.report_date)}</small></div><button onClick={() => setDraft(null)}>Changer</button></div>
            {draft.historical_reports?.length > 1 && <div className="import-days"><CalendarDays size={18}/><span><strong>{draft.historical_reports.length} journées détectées</strong><small>Du {formatDate(draft.historical_reports[0].report_date)} au {formatDate(draft.report_date)}. Elles seront toutes ajoutées.</small></span></div>}
            <div className="preview-grid"><MiniKpi label="Production" value={`${formatNumber(summary.productionQtx)} qtx`}/><MiniKpi label="Blé reçu" value={`${formatNumber(summary.wheatReceivedQtx)} qtx`}/><MiniKpi label="CA ventes" value="Import PDF séparé"/><MiniKpi label="Encaissements" value={formatMoney(summary.collectionsAmount)}/></div>
            <label className="note-field">Observation analyste<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation ou information importante pour le manager…" rows={4}/></label>
            {errors.length ? <div className="validation-errors"><strong>À corriger avant publication :</strong>{errors.map((error) => <span key={error}>• {error}</span>)}</div> : <div className="validation-ok"><CheckCircle2 size={18}/><span>Les données opérationnelles sont présentes. Importez ensuite le PDF CA ventes.</span></div>}
            <div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={publish} disabled={publishing || errors.length}>{publishing ? <><RefreshCw size={17} className="spin"/> Publication…</> : <><CheckCircle2 size={17}/> Valider & publier</>}</button></div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.json" hidden onChange={(e) => readFile(e.target.files?.[0])}/>
      </section>
    </div>
  );
}

function SalesPdfModal({ onClose, onPublish, publishing }) {
  const inputRef = useRef();
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  const readFile = async (file) => {
    if (!file) return;
    setReading(true);
    setError('');
    try {
      setParsed(await parseSalesPdf(file));
    } catch (err) {
      setParsed(null);
      setError(err.message || 'Impossible de lire ce PDF.');
    } finally {
      setReading(false);
    }
  };

  const total = parsed?.transactions.reduce((sum, row) => sum + Number(row.montant_da || 0), 0) || 0;
  const dayCount = parsed ? Object.keys(parsed.salesByDate).length : 0;
  const clientCount = parsed ? new Set(parsed.transactions.map((row) => row.client)).size : 0;

  return <div className="modal-backdrop"><section className="import-modal" role="dialog" aria-modal="true">
    <header><div><span>CA Ventes</span><h2>Importer les ventes depuis le PDF</h2></div><button className="icon-button" onClick={onClose}><X size={20}/></button></header>
    {!parsed ? <div className="drop-zone" onClick={() => inputRef.current?.click()}>
      {reading ? <RefreshCw className="spin" size={36}/> : <FileText size={40}/>}<strong>{reading ? 'Analyse des 24 pages…' : 'Choisir le PDF des livraisons clients'}</strong><span>Format attendu : Liste des Livraisons par Client</span><small>Le PDF remplacera uniquement le chiffre d'affaires et les clients. Production, blé et encaissements resteront inchangés.</small><button className="primary"><Upload size={17}/> Parcourir</button>
    </div> : <>
      <div className="import-file"><FileText size={22}/><div><strong>{parsed.source_file}</strong><small>{parsed.pages} pages · du {formatDate(parsed.periodStart)} au {formatDate(parsed.periodEnd)}</small></div><button onClick={() => setParsed(null)}>Changer</button></div>
      <div className="preview-grid"><MiniKpi label="CA total PDF" value={formatMoney(total)}/><MiniKpi label="Journées" value={dayCount}/><MiniKpi label="Livraisons" value={parsed.transactions.length}/><MiniKpi label="Clients" value={clientCount}/></div>
      <div className="validation-ok"><CheckCircle2 size={18}/><span>Les montants HT, dates, références et clients ont été détectés. Les anciennes ventes des mêmes dates seront remplacées.</span></div>
      <div className="pdf-preview"><strong>Aperçu des dernières livraisons</strong>{parsed.transactions.slice(-5).reverse().map((row, index) => <div key={`${row.reference}-${index}`}><span>{formatDate(row.date)} · {row.client}</span><b>{formatMoney(row.montant_da)}</b></div>)}</div>
      <div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={() => onPublish(parsed)} disabled={publishing}>{publishing ? <><RefreshCw size={17} className="spin"/> Importation…</> : <><CheckCircle2 size={17}/> Remplacer le CA ventes</>}</button></div>
    </>}
    {error && <div className="validation-errors">{error}</div>}
    <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => readFile(event.target.files?.[0])}/>
  </section></div>;
}

function BalanceImportModal({ onClose, onPublish, publishing }) {
  const inputRef = useRef();
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  const readFile = async (file) => {
    if (!file) return;
    setReading(true);
    setError('');
    try {
      setParsed(await parseClientBalance(file));
    } catch (err) {
      setParsed(null);
      setError(err.message || 'Impossible de lire cette balance clients.');
    } finally {
      setReading(false);
    }
  };

  return <div className="modal-backdrop"><section className="import-modal" role="dialog" aria-modal="true">
    <header><div><span>Balance clients</span><h2>Importer les paiements et soldes clients</h2></div><button className="icon-button" onClick={onClose}><X size={20}/></button></header>
    {!parsed ? <div className="drop-zone" onClick={() => inputRef.current?.click()}>
      {reading ? <RefreshCw className="spin" size={36}/> : <Scale size={40}/>}<strong>{reading ? 'Lecture de la balance…' : 'Choisir la balance clients'}</strong><span>Excel .xls ou .xlsx</span><small>Colonnes attendues : Code, Nom, Solde antérieur, Chiffre Affaire, Paiement et Solde.</small><button className="primary"><Upload size={17}/> Parcourir</button>
    </div> : <>
      <div className="import-file"><Scale size={22}/><div><strong>{parsed.source_file}</strong><small>Du {formatDate(parsed.periodStart)} au {formatDate(parsed.periodEnd)} · {parsed.clients.length} clients</small></div><button onClick={() => setParsed(null)}>Changer</button></div>
      <div className="preview-grid"><MiniKpi label="Solde antérieur" value={formatMoney(parsed.totals.opening)}/><MiniKpi label="Chiffre d'affaires" value={formatMoney(parsed.totals.sales)}/><MiniKpi label="Paiements" value={formatMoney(parsed.totals.payments)}/><MiniKpi label="Nouveau solde" value={formatMoney(parsed.totals.closing)}/></div>
      {!parsed.isDaily && <div className="validation-errors"><strong>Balance de période détectée</strong><span>Elle sera enregistrée comme une seule situation au {formatDate(parsed.periodEnd)}. Pour connaître les encaissements jour par jour, exportez une balance avec « Du » et « Au » sur la même date.</span></div>}
      {parsed.isDaily && <div className="validation-ok"><CheckCircle2 size={18}/><span>Balance journalière détectée. Les encaissements et soldes clients du {formatDate(parsed.periodEnd)} remplaceront ceux déjà enregistrés ce jour.</span></div>}
      <div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={() => onPublish(parsed)} disabled={publishing}>{publishing ? <><RefreshCw size={17} className="spin"/> Importation…</> : <><CheckCircle2 size={17}/> Importer la balance</>}</button></div>
    </>}
    {error && <div className="validation-errors">{error}</div>}
    <input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => readFile(event.target.files?.[0])}/>
  </section></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [salesPdfOpen, setSalesPdfOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'info') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  };

  const refreshReports = async () => {
    const next = cloudEnabled ? await cloudLoadReports() : loadLocalReports();
    setReports(next);
    if (!selectedId && next.length) setSelectedId(next[0].id);
    return next;
  };

  useEffect(() => {
    (async () => {
      try {
        const savedSession = cloudEnabled ? await cloudLoadSession() : loadLocalSession();
        setSession(savedSession);
        if (savedSession) await refreshReports();
      } catch (err) {
        notify(err.message || 'Erreur de chargement.', 'error');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const login = async (email, password, demoProfile) => {
    setBusy(true);
    try {
      const next = cloudEnabled
        ? await cloudSignIn(email, password)
        : { user: { id: `demo-${demoProfile.role.toLowerCase()}`, email: demoProfile.email }, profile: { email: demoProfile.email, full_name: demoProfile.full_name, role: demoProfile.role } };
      setSession(next);
      if (!cloudEnabled) saveLocalSession(next);
      await refreshReports();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (cloudEnabled) await cloudSignOut();
    else saveLocalSession(null);
    setSession(null);
    setReports([]);
    setSelectedId(null);
    setView('home');
  };

  const publishReport = async (draft) => {
    setPublishing(true);
    try {
      let published;
      const sourceReports = draft.historical_reports?.length ? draft.historical_reports : [draft];
      const importedReports = sourceReports.map((item) => {
        const existing = keepLatestReportPerDay(reports).find((row) => row.report_date === item.report_date);
        const pdfSales = existing?.sales?.filter((row) => row.source !== 'EXCEL_QTY') || [];
        return pdfSales.length ? { ...item, sales: combinePdfCaWithExcelQuantities(pdfSales, item.sales) } : item;
      });
      if (cloudEnabled) {
        for (const item of importedReports) {
          published = await cloudPublishReport({ ...item, note: item.report_date === draft.report_date ? draft.note : item.note }, session.user.id);
        }
        await refreshReports();
      } else {
        const created = importedReports.map((item, index) => {
          const sameDateVersions = reports.filter((existing) => existing.report_date === item.report_date).map((existing) => Number(existing.version || 0));
          const version = Math.max(0, ...sameDateVersions) + 1;
          const { historical_reports, ...cleanItem } = item;
          return { ...cleanItem, note: item.report_date === draft.report_date ? draft.note : item.note, id: `local-${item.report_date}-v${version}-${Date.now()}-${index}`, version, status: 'PUBLISHED', published_at: new Date().toISOString(), created_at: new Date().toISOString() };
        });
        published = created.at(-1);
        const importedDates = new Set(created.map((item) => item.report_date));
        const next = [...created, ...reports.filter((item) => !importedDates.has(item.report_date))]
          .sort((a, b) => `${b.report_date}-${b.version}`.localeCompare(`${a.report_date}-${a.version}`));
        saveLocalReports(next);
        setReports(next);
      }
      setSelectedId(published.id);
      setView('home');
      setImportOpen(false);
      notify(`Rapport du ${formatDate(published.report_date)} publié avec succès.`, 'success');
    } catch (err) {
      notify(err.message || 'Publication impossible.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const publishSalesPdf = async (pdfData) => {
    setPublishing(true);
    try {
      const latestExisting = keepLatestReportPerDay(reports);
      const mergedReports = Object.entries(pdfData.salesByDate).map(([date, sales]) => {
        const existing = latestExisting.find((item) => item.report_date === date);
        return {
          ...(existing || {
            report_date: date,
            production: [],
            wheat: [],
            collections: [],
            note: `CA ventes importé depuis ${pdfData.source_file}.`,
          }),
          report_date: date,
          sales: combinePdfCaWithExcelQuantities(sales, existing?.sales || []),
          source_file: pdfData.source_file,
        };
      }).sort((a, b) => a.report_date.localeCompare(b.report_date));

      let published;
      if (cloudEnabled) {
        for (const item of mergedReports) published = await cloudPublishReport(item, session.user.id);
        await refreshReports();
      } else {
        const importedDates = new Set(mergedReports.map((item) => item.report_date));
        const created = mergedReports.map((item, index) => {
          const previousVersions = reports.filter((row) => row.report_date === item.report_date).map((row) => Number(row.version || 0));
          const version = Math.max(0, ...previousVersions) + 1;
          return { ...item, id: `local-ca-${item.report_date}-${Date.now()}-${index}`, version, status: 'PUBLISHED', published_at: new Date().toISOString(), created_at: new Date().toISOString() };
        });
        const next = [...created, ...reports.filter((item) => !importedDates.has(item.report_date))]
          .sort((a, b) => `${b.report_date}-${b.version}`.localeCompare(`${a.report_date}-${a.version}`));
        saveLocalReports(next);
        setReports(next);
        published = created.at(-1);
      }
      setSelectedId(published?.id || null);
      setView('home');
      setSalesPdfOpen(false);
      notify(`CA ventes PDF importé : ${pdfData.transactions.length} livraisons sur ${mergedReports.length} journées.`, 'success');
    } catch (err) {
      notify(err.message || 'Importation du CA PDF impossible.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const publishClientBalance = async (balance) => {
    setPublishing(true);
    try {
      const date = balance.periodEnd;
      const existing = keepLatestReportPerDay(reports).find((item) => item.report_date === date);
      const merged = {
        ...(existing || { report_date: date, production: [], wheat: [], sales: [], note: '' }),
        report_date: date,
        source_file: balance.source_file,
        collections: balance.clients.map((row) => ({
          date,
          client_code: row.client_code,
          client: row.client,
          montant_da: row.paiement,
          mode_paiement: 'Balance client',
          reference: balance.source_file,
          solde_anterieur: row.solde_anterieur,
          chiffre_affaire: row.chiffre_affaire,
          solde: row.solde,
          pourcentage: row.pourcentage,
          source: 'BALANCE_CLIENT',
        })),
      };

      let published;
      if (cloudEnabled) {
        published = await cloudPublishReport(merged, session.user.id);
        await refreshReports();
      } else {
        const previousVersions = reports.filter((row) => row.report_date === date).map((row) => Number(row.version || 0));
        const version = Math.max(0, ...previousVersions) + 1;
        published = { ...merged, id: `local-balance-${date}-${Date.now()}`, version, status: 'PUBLISHED', published_at: new Date().toISOString(), created_at: new Date().toISOString() };
        const next = [published, ...reports.filter((item) => item.report_date !== date)]
          .sort((a, b) => `${b.report_date}-${b.version}`.localeCompare(`${a.report_date}-${a.version}`));
        saveLocalReports(next);
        setReports(next);
      }
      setSelectedId(published.id);
      setView('collections');
      setBalanceOpen(false);
      notify(`Balance clients du ${formatDate(date)} importée : ${formatMoney(balance.totals.payments)} encaissés.`, 'success');
    } catch (err) {
      notify(err.message || 'Importation de la balance clients impossible.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const clearAllData = async () => {
    if (!window.confirm('Effacer définitivement tous les rapports et toutes les données importées ?')) return;
    setPublishing(true);
    try {
      if (cloudEnabled) await cloudClearReports();
      else saveLocalReports([]);
      setReports([]);
      setSelectedId(null);
      setView('home');
      notify('Toutes les données ont été effacées. Vous pouvez importer les nouveaux fichiers.', 'success');
    } catch (err) {
      notify(err.message || 'Suppression des données impossible.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  if (busy && !session) return <div className="loading-screen"><RefreshCw size={28} className="spin"/><span>Chargement…</span></div>;
  if (!session) return <><Login busy={busy} onLogin={login}/><Toast toast={toast} onClose={() => setToast(null)}/></>;

  const roleReports = session.profile.role === 'MANAGER' ? reports.filter((r) => r.status === 'PUBLISHED') : reports;
  const visibleReports = keepLatestReportPerDay(roleReports);
  const selected = visibleReports.find((item) => item.id === selectedId) || visibleReports[0];

  if (!selected) {
    return <div className="app-shell"><Header session={session} onLogout={logout} onImport={() => setImportOpen(true)} onImportSales={() => setSalesPdfOpen(true)} onImportBalance={() => setBalanceOpen(true)} onClear={clearAllData}/><main className="app-main empty-main"><FileSpreadsheet size={46}/><h2>Aucun rapport publié</h2><p>Importez le premier rapport journalier validé.</p>{session.profile.role === 'ANALYST' && <button className="primary" onClick={() => setImportOpen(true)}><Upload size={17}/> Importer</button>}</main>{importOpen && <ImportModal onClose={() => setImportOpen(false)} onPublish={publishReport} publishing={publishing}/>} {salesPdfOpen && <SalesPdfModal onClose={() => setSalesPdfOpen(false)} onPublish={publishSalesPdf} publishing={publishing}/>} {balanceOpen && <BalanceImportModal onClose={() => setBalanceOpen(false)} onPublish={publishClientBalance} publishing={publishing}/>}<Toast toast={toast} onClose={() => setToast(null)}/></div>;
  }

  const setReport = (report) => { setSelectedId(report.id); setView('home'); };
  return (
    <div className="app-shell">
      <Header session={session} report={selected} onLogout={logout} onImport={() => setImportOpen(true)} onImportSales={() => setSalesPdfOpen(true)} onImportBalance={() => setBalanceOpen(true)} onClear={clearAllData} />
      <main className="app-main" key={`${view}-${selected.id}`}>
        {view === 'home' && <HomeView report={selected} setView={setView} reports={visibleReports} onSelectReport={setReport} role={session.profile.role} onImport={() => setImportOpen(true)} />}
        {view === 'production' && <ProductionView report={selected} onBack={() => setView('home')} />}
        {view === 'wheat' && <WheatView report={selected} onBack={() => setView('home')} />}
        {view === 'sales' && <SalesView report={selected} onBack={() => setView('home')} />}
        {view === 'collections' && <CollectionsView report={selected} reports={visibleReports} onBack={() => setView('home')} />}
      </main>
      <BottomNav view={view} setView={setView} />
      {importOpen && session.profile.role === 'ANALYST' && <ImportModal onClose={() => setImportOpen(false)} onPublish={publishReport} publishing={publishing}/>} 
      {salesPdfOpen && session.profile.role === 'ANALYST' && <SalesPdfModal onClose={() => setSalesPdfOpen(false)} onPublish={publishSalesPdf} publishing={publishing}/>} 
      {balanceOpen && session.profile.role === 'ANALYST' && <BalanceImportModal onClose={() => setBalanceOpen(false)} onPublish={publishClientBalance} publishing={publishing}/>}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
