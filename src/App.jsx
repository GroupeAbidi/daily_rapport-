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
  FileSpreadsheet,
  History,
  Home,
  Info,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Target,
  TrendingUp,
  LogOut,
  PackageCheck,
  RefreshCw,
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
import { loadLocalReports, loadLocalSession, saveLocalReports, saveLocalSession } from './lib/localStore.js';
import {
  cloudEnabled,
  cloudLoadReports,
  cloudLoadSession,
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

function Header({ session, report, onLogout, onImport }) {
  const analyst = session.profile.role === 'ANALYST';
  return (
    <header className="app-header">
      <Brand compact />
      <div className="header-actions">
        {analyst && <button className="header-import" onClick={onImport}><Upload size={17} /><span>Importer</span></button>}
        <div className="user-chip">
          <div><strong>{session.profile.full_name}</strong><small>{analyst ? 'Analyste' : 'Manager'}</small></div>
          <span>{session.profile.full_name?.charAt(0) || 'A'}</span>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Déconnexion"><LogOut size={18} /></button>
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
      <SummaryCards report={report} onOpen={setView} />
      <section className="analysis-grid">
        <ChartPanel title="Tendance sur 7 rapports" note="qtx">
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="productionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7a3024" stopOpacity={0.28}/><stop offset="95%" stopColor="#7a3024" stopOpacity={0}/></linearGradient>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3f6f68" stopOpacity={0.24}/><stop offset="95%" stopColor="#3f6f68" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eee7df" strokeDasharray="4 4"/>
              <XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip/>}/><Legend/>
              <Area type="monotone" dataKey="Production" stroke="#7a3024" strokeWidth={3} fill="url(#productionFill)" activeDot={{ r: 5 }}/>
              <Area type="monotone" dataKey="Ventes" stroke="#3f6f68" strokeWidth={3} fill="url(#salesFill)" activeDot={{ r: 5 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <article className="panel insight-panel">
          <header className="panel-header"><div><span>Pilotage</span><h2>Indicateurs de performance</h2></div><Activity size={20}/></header>
          <div className="performance-list">
            <PerformanceRow icon={Target} label="Rendement réception → production" value={productionCoverage} target={95}/>
            <PerformanceRow icon={TrendingUp} label="Écoulement de la production" value={salesCoverage} target={80}/>
            <PerformanceRow icon={Banknote} label="Recouvrement du chiffre d'affaires" value={s.recoveryRate} target={90}/>
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
            <div><span>Ventes</span><strong>{formatMoney(s.salesAmount)}</strong><small>{formatNumber(s.salesQtx)} qtx vendus</small></div>
            <div><span>Encaissements</span><strong>{formatMoney(s.collectionsAmount)}</strong><small>{formatNumber(s.recoveryRate)}% du chiffre du jour</small></div>
          </div>
        </article>
        <HistoryCard reports={reports} selected={report} onSelect={onSelectReport} />
      </section>
    </>
  );
}

function PerformanceRow({ icon: Icon, label, value, target }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const progress = Math.min(100, Math.max(0, (safeValue / target) * 100));
  const tone = safeValue >= target ? 'good' : safeValue >= target * .75 ? 'medium' : 'low';
  return <div className="performance-row"><span className={`performance-icon ${tone}`}><Icon size={17}/></span><div><span>{label}</span><div className="progress-track"><i className={tone} style={{ width: `${progress}%` }}/></div><small>Objectif {target}%</small></div><strong>{formatNumber(safeValue)}%</strong></div>;
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
  return <div className="chart-tooltip"><strong>{label || payload[0]?.name}</strong>{payload.map((item) => <span key={`${item.dataKey}-${item.name}`}>{item.name}: {money ? formatMoney(item.value) : formatNumber(item.value)}</span>)}</div>;
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
  const clients = groupBy(report.sales || [], 'client', 'montant_da').slice(0, 8);
  const products = groupBy(report.sales || [], 'produit', 'quantite_qtx');
  return (
    <>
      <SectionTitle icon={PackageCheck} kicker="Ventes" title="Ventes du jour" note="Quantités vendues, chiffre d'affaires et principaux clients." onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Quantité vendue" value={`${formatNumber(s.salesQtx)} qtx`} /><MiniKpi label="Chiffre d'affaires" value={formatMoney(s.salesAmount)} tone="green" /><MiniKpi label="Clients" value={new Set(report.sales.map((r) => r.client)).size} /></div>
      <section className="two-grid">
        <ChartPanel title="CA par client" note="DA"><ResponsiveContainer width="100%" height={300}><BarChart data={clients} layout="vertical" margin={{ left: 12, right: 18 }}><CartesianGrid horizontal={false} stroke="#e8e0d6"/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip money/>}/><Bar dataKey="value" name="CA" fill="#3f6f68" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></ChartPanel>
        <ChartPanel title="Quantité par produit" note="qtx"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={products} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>{products.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip/>}/><Legend/></PieChart></ResponsiveContainer></ChartPanel>
      </section>
      <DataTable columns={[['date','Date'],['client','Client'],['produit','Produit'],['quantite_qtx','Quantité qtx'],['montant_da','Montant']]} rows={report.sales} numberKeys={['quantite_qtx']} moneyKeys={['montant_da']} />
    </>
  );
}

function CollectionsView({ report, onBack }) {
  const s = summarizeReport(report);
  const clients = groupBy(report.collections || [], 'client', 'montant_da').slice(0, 10);
  const modes = groupBy(report.collections || [], 'mode_paiement', 'montant_da');
  return (
    <>
      <SectionTitle icon={Banknote} kicker="Encaissements clients" title="Encaissements du jour" note="Montants réellement encaissés, par client et par mode de paiement." onBack={onBack} />
      <div className="section-kpis"><MiniKpi label="Total encaissé" value={formatMoney(s.collectionsAmount)} tone="green" /><MiniKpi label="Taux recouvrement" value={`${formatNumber(s.recoveryRate)}%`} /><MiniKpi label="Clients encaissés" value={new Set(report.collections.map((r) => r.client)).size} /></div>
      <section className="two-grid">
        <ChartPanel title="Encaissement par client" note="DA"><ResponsiveContainer width="100%" height={300}><BarChart data={clients} layout="vertical" margin={{ left: 12, right: 18 }}><CartesianGrid horizontal={false} stroke="#e8e0d6"/><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip money/>}/><Bar dataKey="value" name="Encaissé" fill="#c99715" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></ChartPanel>
        <ChartPanel title="Modes de paiement" note="répartition"><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={modes} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{modes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip content={<ChartTooltip money/>}/><Legend/></PieChart></ResponsiveContainer></ChartPanel>
      </section>
      <DataTable columns={[['date','Date'],['client','Client'],['montant_da','Montant'],['mode_paiement','Mode paiement'],['reference','Référence']]} rows={report.collections} moneyKeys={['montant_da']} />
    </>
  );
}

function MiniKpi({ label, value, tone = '' }) {
  return <article className={`mini-kpi ${tone}`}><small>{label}</small><strong>{value}</strong></article>;
}

function ChartPanel({ title, note, children }) {
  return <article className="panel chart-panel"><header className="panel-header"><div><span>Analyse</span><h2>{title}</h2></div><small>{note}</small></header><div className="chart-wrap">{children}</div></article>;
}

function DataTable({ columns, rows, numberKeys = [], moneyKeys = [] }) {
  return (
    <article className="panel table-panel">
      <header className="panel-header"><div><span>Détail</span><h2>Données du rapport</h2></div><small>{rows.length} lignes</small></header>
      <div className="table-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{moneyKeys.includes(key) ? formatMoney(row[key]) : numberKeys.includes(key) ? formatNumber(row[key]) : key === 'date' ? formatDate(row[key]) : row[key] || '—'}</td>)}</tr>) : <tr><td colSpan={columns.length}>Aucune donnée.</td></tr>}</tbody></table></div>
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
            {reading ? <RefreshCw className="spin" size={36}/> : <FileSpreadsheet size={40}/>}<strong>{reading ? 'Lecture du fichier…' : 'Choisir le fichier validé'}</strong><span>Excel .xlsx / .xls ou JSON</span><small>Feuilles attendues : Production, Suivi Ble, Ventes, Encaissements</small>
            <button className="primary"><Upload size={17}/> Parcourir</button>
          </div>
        ) : (
          <>
            <div className="import-file"><FileSpreadsheet size={22}/><div><strong>{draft.source_file}</strong><small>Rapport détecté : {formatDate(draft.report_date)}</small></div><button onClick={() => setDraft(null)}>Changer</button></div>
            {draft.historical_reports?.length > 1 && <div className="import-days"><CalendarDays size={18}/><span><strong>{draft.historical_reports.length} journées détectées</strong><small>Du {formatDate(draft.historical_reports[0].report_date)} au {formatDate(draft.report_date)}. Elles seront toutes ajoutées.</small></span></div>}
            <div className="preview-grid"><MiniKpi label="Production" value={`${formatNumber(summary.productionQtx)} qtx`}/><MiniKpi label="Blé reçu" value={`${formatNumber(summary.wheatReceivedQtx)} qtx`}/><MiniKpi label="Ventes" value={formatMoney(summary.salesAmount)}/><MiniKpi label="Encaissements" value={formatMoney(summary.collectionsAmount)}/></div>
            <label className="note-field">Observation analyste<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observation ou information importante pour le manager…" rows={4}/></label>
            {errors.length ? <div className="validation-errors"><strong>À corriger avant publication :</strong>{errors.map((error) => <span key={error}>• {error}</span>)}</div> : <div className="validation-ok"><CheckCircle2 size={18}/><span>Les 4 sections sont présentes. Le rapport peut être publié.</span></div>}
            <div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={publish} disabled={publishing || errors.length}>{publishing ? <><RefreshCw size={17} className="spin"/> Publication…</> : <><CheckCircle2 size={17}/> Valider & publier</>}</button></div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.json" hidden onChange={(e) => readFile(e.target.files?.[0])}/>
      </section>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
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
      const importedReports = draft.historical_reports?.length ? draft.historical_reports : [draft];
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
        const next = [...created, ...reports].sort((a, b) => `${b.report_date}-${b.version}`.localeCompare(`${a.report_date}-${a.version}`));
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

  if (busy && !session) return <div className="loading-screen"><RefreshCw size={28} className="spin"/><span>Chargement…</span></div>;
  if (!session) return <><Login busy={busy} onLogin={login}/><Toast toast={toast} onClose={() => setToast(null)}/></>;

  const visibleReports = session.profile.role === 'MANAGER' ? reports.filter((r) => r.status === 'PUBLISHED') : reports;
  const selected = visibleReports.find((item) => item.id === selectedId) || visibleReports[0];

  if (!selected) {
    return <div className="app-shell"><Header session={session} onLogout={logout} onImport={() => setImportOpen(true)}/><main className="app-main empty-main"><FileSpreadsheet size={46}/><h2>Aucun rapport publié</h2><p>Importez le premier rapport journalier validé.</p>{session.profile.role === 'ANALYST' && <button className="primary" onClick={() => setImportOpen(true)}><Upload size={17}/> Importer</button>}</main>{importOpen && <ImportModal onClose={() => setImportOpen(false)} onPublish={publishReport} publishing={publishing}/>}<Toast toast={toast} onClose={() => setToast(null)}/></div>;
  }

  const setReport = (report) => { setSelectedId(report.id); setView('home'); };
  return (
    <div className="app-shell">
      <Header session={session} report={selected} onLogout={logout} onImport={() => setImportOpen(true)} />
      <main className="app-main" key={`${view}-${selected.id}`}>
        {view === 'home' && <HomeView report={selected} setView={setView} reports={visibleReports} onSelectReport={setReport} role={session.profile.role} onImport={() => setImportOpen(true)} />}
        {view === 'production' && <ProductionView report={selected} onBack={() => setView('home')} />}
        {view === 'wheat' && <WheatView report={selected} onBack={() => setView('home')} />}
        {view === 'sales' && <SalesView report={selected} onBack={() => setView('home')} />}
        {view === 'collections' && <CollectionsView report={selected} onBack={() => setView('home')} />}
      </main>
      <BottomNav view={view} setView={setView} />
      {importOpen && session.profile.role === 'ANALYST' && <ImportModal onClose={() => setImportOpen(false)} onPublish={publishReport} publishing={publishing}/>} 
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
