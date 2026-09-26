export const sampleReport = {
  id: 'demo-2026-09-24-v1',
  report_date: '2026-09-24',
  version: 1,
  status: 'PUBLISHED',
  note: 'Journée stable. Production conforme au rythme prévu. Deux encaissements clients restent à surveiller demain.',
  source_file: 'rapport_valide_24-09-2026.xlsx',
  created_at: '2026-09-24T16:45:00+01:00',
  published_at: '2026-09-24T17:05:00+01:00',
  production: [
    { date: '2026-09-24', site: 'G', produit: 'Farine panifiable', quantite_qtx: 412.5 },
    { date: '2026-09-24', site: 'M', produit: 'Farine panifiable', quantite_qtx: 368.2 },
    { date: '2026-09-24', site: 'G', produit: 'Semoule', quantite_qtx: 126.4 },
    { date: '2026-09-24', site: 'M', produit: 'Issues / son', quantite_qtx: 94.1 },
  ],
  wheat: [
    { date: '2026-09-24', quota_qtx: 1000, livre_groupe_qtx: 486, livre_minoterie_qtx: 472, observation: 'Livraison CCLS' },
  ],
  sales: [
    { date: '2026-09-24', client: 'Client A', produit: 'Farine panifiable', quantite_qtx: 322, montant_da: 1892000 },
    { date: '2026-09-24', client: 'Client B', produit: 'Farine panifiable', quantite_qtx: 241, montant_da: 1439000 },
    { date: '2026-09-24', client: 'Client C', produit: 'Semoule', quantite_qtx: 98, montant_da: 702000 },
  ],
  collections: [
    { date: '2026-09-24', client: 'Client A', montant_da: 1500000, mode_paiement: 'Virement', reference: 'VIR-2409-A' },
    { date: '2026-09-24', client: 'Client B', montant_da: 920000, mode_paiement: 'Chèque', reference: 'CHQ-2409-B' },
    { date: '2026-09-24', client: 'Client C', montant_da: 610000, mode_paiement: 'Espèces', reference: 'ESP-2409-C' },
  ],
};

export const emptyReport = (date) => ({
  id: `draft-${Date.now()}`,
  report_date: date,
  version: 1,
  status: 'DRAFT',
  note: '',
  source_file: '',
  created_at: new Date().toISOString(),
  published_at: null,
  production: [],
  wheat: [],
  sales: [],
  collections: [],
});
