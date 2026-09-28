import * as XLSX from 'xlsx';
import { emptyReport } from '../sampleData.js';

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const compactText = (value) =>
  normalizeText(value).replace(/[^a-z0-9]+/g, '');

const number = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value ?? '')
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, ''),
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

const isoFromParts = (day, month, year) => {
  const yyyy =
    String(year).length === 2 ? `20${year}` : String(year);

  return `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(
    2,
    '0',
  )}`;
};

const dateFromText = (value) => {
  const text = String(value ?? '').trim();

  const match = text.match(
    /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/,
  );

  if (!match) return '';

  return isoFromParts(
    match[1],
    match[2],
    match[3],
  );
};

const excelDate = (value) => {
  if (!value) return '';

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    const year = value.getFullYear();
    const month = String(
      value.getMonth() + 1,
    ).padStart(2, '0');

    const day = String(
      value.getDate(),
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'number') {
    const parsed =
      XLSX.SSF.parse_date_code(value);

    if (parsed) {
      return `${parsed.y}-${String(
        parsed.m,
      ).padStart(2, '0')}-${String(
        parsed.d,
      ).padStart(2, '0')}`;
    }
  }

  const direct = dateFromText(value);

  if (direct) return direct;

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();

  const month = String(
    parsed.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    parsed.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatDateForTitle = (isoDate) => {
  const [year, month, day] =
    String(isoDate).split('-');

  return `${day}/${month}/${year}`;
};

const findSheet = (
  workbook,
  expectedName,
) => {
  const expected =
    compactText(expectedName);

  const sheetName =
    workbook.SheetNames.find(
      (name) =>
        compactText(name) === expected,
    );

  return sheetName
    ? workbook.Sheets[sheetName]
    : null;
};

const sheetRows = (
  workbook,
  expectedName,
) => {
  const sheet =
    findSheet(
      workbook,
      expectedName,
    );

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(
    sheet,
    {
      header: 1,
      defval: null,
      raw: true,
    },
  );
};

/*
|--------------------------------------------------------------------------
| Find latest JOURNEE COMMERCIAL date
|--------------------------------------------------------------------------
*/

const latestCommercialDate = (
  rows,
) => {
  const dates = [];

  rows.forEach((row) => {
    row.forEach((cell) => {
      const text =
        normalizeText(cell);

      if (
        !text.includes(
          'journee commercial du',
        )
      ) {
        return;
      }

      const date =
        dateFromText(cell);

      if (date) {
        dates.push(date);
      }
    });
  });

  return (
    dates.sort().at(-1) || ''
  );
};

const commercialDates = (rows) => {
  const dates = new Set();
  rows.forEach((row) => row.forEach((cell) => {
    if (normalizeText(cell).includes('journee commercial du')) {
      const date = dateFromText(cell);
      if (date) dates.add(date);
    }
  }));
  return [...dates].sort();
};

/*
|--------------------------------------------------------------------------
| PRODUCTION
|--------------------------------------------------------------------------
*/

const productionSiteName = (
  row,
) => {
  const joined = normalizeText(
    row
      .filter(
        (value) =>
          value !== null &&
          value !== '',
      )
      .join(' '),
  );

  if (
    joined.includes(
      'minoterie abidi mohamed',
    )
  ) {
    return 'Minoterie ABIDI Mohamed';
  }

  if (
    joined.includes(
      'groupe abidi',
    )
  ) {
    return 'SARL Groupe ABIDI';
  }

  return 'Minoterie';
};

const parseProduction = (
  rows,
  reportDate,
) => {
  const result = [];

  rows.forEach(
    (row, titleIndex) => {
      const hasTargetTitle =
        row.some((cell) => {
          const text =
            normalizeText(cell);

          return (
            text.includes(
              'production du',
            ) &&
            dateFromText(cell) ===
              reportDate
          );
        });

      if (!hasTargetTitle) {
        return;
      }

      const site =
        productionSiteName(row);

      const header =
        rows[titleIndex + 1] || [];

      const productIndex =
        header.findIndex(
          (cell) =>
            compactText(cell) ===
            'produits',
        );

      const quantityIndex =
        header.findIndex(
          (cell) => {
            const key =
              compactText(cell);

            return (
              key === 'qtenqtx' ||
              key === 'qteenqtx' ||
              key.includes(
                'qtenqtx',
              )
            );
          },
        );

      if (
        productIndex < 0 ||
        quantityIndex < 0
      ) {
        return;
      }

      for (
        let i = titleIndex + 2;
        i < rows.length;
        i += 1
      ) {
        const dataRow =
          rows[i] || [];

        const firstValue =
          normalizeText(
            dataRow[
              productIndex
            ],
          );

        if (
          firstValue === 'total'
        ) {
          break;
        }

        if (!firstValue) {
          continue;
        }

        const qty = number(
          dataRow[
            quantityIndex
          ],
        );

        /*
         * Do not display empty
         * production lines.
         */
        if (!qty) {
          continue;
        }

        result.push({
          date: reportDate,

          site,

          produit: String(
            dataRow[
              productIndex
            ] ?? '',
          ).trim(),

          quantite_qtx: qty,
        });
      }
    },
  );

  return result;
};

/*
|--------------------------------------------------------------------------
| SUIVI BLE
|--------------------------------------------------------------------------
|
| In your LIVRAISON sheet there are 2 SUIVI BLE tables side by side.
|
| Left:
| B = DATE
| C = GROUPE
| D = MINOTERIE
|
| Right:
| H = DATE
| I = GROUPE
| J = MINOTERIE
|
*/

const parseWheat = (
  rows,
  reportDate,
) => {
  const matches = [];

  rows.forEach(
    (row, rowIndex) => {
      /*
       * LEFT SUIVI BLE
       */

      if (
        excelDate(row[1]) ===
        reportDate
      ) {
        matches.push({
          rowIndex,

          livre_groupe_qtx:
            number(row[2]),

          livre_minoterie_qtx:
            number(row[3]),
        });
      }

      /*
       * RIGHT SUIVI BLE
       */

      if (
        excelDate(row[7]) ===
        reportDate
      ) {
        matches.push({
          rowIndex,

          livre_groupe_qtx:
            number(row[8]),

          livre_minoterie_qtx:
            number(row[9]),
        });
      }
    },
  );

  /*
   * There are repeated monthly
   * blocks in your workbook.
   * We use the latest matching row.
   */

  const latest =
    matches.at(-1);

  if (!latest) {
    return [];
  }

  return [
    {
      date: reportDate,

      /*
       * Current daily quota.
       * We can make this configurable
       * later.
       */
      quota_qtx: 1000,

      livre_groupe_qtx:
        latest.livre_groupe_qtx,

      livre_minoterie_qtx:
        latest.livre_minoterie_qtx,

      observation:
        'Import automatique depuis la feuille LIVRAISON',
    },
  ];
};

/*
|--------------------------------------------------------------------------
| JOURNEE COMMERCIAL
|--------------------------------------------------------------------------
*/

const findCommercialBlock = (
  rows,
  reportDate,
) => {
  let titleIndex = -1;

  rows.forEach(
    (row, index) => {
      const found =
        row.some((cell) => {
          const text =
            normalizeText(cell);

          return (
            text.includes(
              'journee commercial du',
            ) &&
            dateFromText(cell) ===
              reportDate
          );
        });

      if (found) {
        titleIndex = index;
      }
    },
  );

  if (titleIndex < 0) {
    return null;
  }

  let totalIndex = -1;

  for (
    let i = titleIndex + 2;
    i < rows.length;
    i += 1
  ) {
    if (
      normalizeText(
        rows[i]?.[0],
      ) === 'total'
    ) {
      totalIndex = i;
      break;
    }
  }

  if (totalIndex < 0) {
    return null;
  }

  return {
    titleIndex,
    totalIndex,
  };
};

/*
|--------------------------------------------------------------------------
| VENTES + ENCAISSEMENTS
|--------------------------------------------------------------------------
|
| Your JOURNEE COMMERCIAL structure:
|
| VENTE FARINE
| C = quantité
| E = format
| G = montant
|
| VENTE SON / ALIMENT / BT
| K = quantité
| M = produit
| O = montant
|
| RECOUVREMENT
| P = client
| Q = montant
|
*/

const parseSalesAndCollections = (
  rows,
  reportDate,
) => {
  const block =
    findCommercialBlock(
      rows,
      reportDate,
    );

  if (!block) {
    return {
      sales: [],
      collections: [],
    };
  }

  const sales = [];
  const collections = [];
  let currentClient = '';
  let currentBonNumber = '';

  /*
   * Data starts after:
   *
   * JOURNEE COMMERCIAL
   * Header line
   * Sub-header line
   */

  for (
    let i =
      block.titleIndex + 3;

    i < block.totalIndex;

    i += 1
  ) {
    const row =
      rows[i] || [];

    const rowClient = String(row[1] ?? '').trim();
    const rowBonNumber = String(row[0] ?? '').trim();

    // Excel merged cells only expose their value on the first row. Keep that
    // value for the following product rows belonging to the same client.
    if (rowClient) currentClient = rowClient;
    if (rowBonNumber) currentBonNumber = rowBonNumber;

    const client = currentClient;
    const bonNumber = currentBonNumber;

    /*
    |--------------------------------------------------------------------------
    | VENTE FARINE
    |--------------------------------------------------------------------------
    */

    const farineQty =
      number(row[2]);

    const farineFormat =
      String(
        row[4] ?? '',
      ).trim();

    const farineAmount =
      number(row[6]);

    if (
      farineQty ||
      farineAmount
    ) {
      sales.push({
        date: reportDate,

        client:
          client ||
          'Divers clients',

        produit:
          farineFormat
            ? `Farine ${farineFormat}`
            : 'Farine',

        quantite_qtx:
          farineQty,

        montant_da:
          farineAmount,

        reference: String(bonNumber || '').trim(),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VENTE SON / ALIMENT / BT
    |--------------------------------------------------------------------------
    */

    const otherQty =
      number(row[10]);

    const otherProduct =
      String(
        row[12] ?? '',
      ).trim();

    const otherAmount =
      number(row[14]);

    if (
      otherQty ||
      otherAmount
    ) {
      sales.push({
        date: reportDate,

        client:
          client ||
          'Divers clients',

        produit:
          otherProduct ||
          'Son / Aliment / BT',

        quantite_qtx:
          otherQty,

        montant_da:
          otherAmount,

        reference: String(bonNumber || '').trim(),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ENCAISSEMENTS / RECOUVREMENT
    |--------------------------------------------------------------------------
    */

    const collectionClient =
      String(
        row[15] ?? '',
      ).trim();

    const collectionAmount =
      number(row[16]);

    if (
      collectionClient ||
      collectionAmount
    ) {
      collections.push({
        date: reportDate,

        client:
          collectionClient ||
          'Client non précisé',

        montant_da:
          collectionAmount,

        /*
         * Payment mode is not
         * available in this sheet.
         */
        mode_paiement:
          'Non précisé',

        reference:
          bonNumber
            ? `Bon ${bonNumber}`
            : '',
      });
    }
  }

  return {
    sales,
    collections,
  };
};

/*
|--------------------------------------------------------------------------
| MAIN IMPORT FUNCTION
|--------------------------------------------------------------------------
*/

export async function parseValidatedFile(
  file,
) {
  /*
   * Keep JSON support for the
   * prototype/sample file.
   */

  if (
    file.name
      .toLowerCase()
      .endsWith('.json')
  ) {
    const raw =
      JSON.parse(
        await file.text(),
      );

    return {
      ...emptyReport(
        raw.report_date ||
          new Date()
            .toISOString()
            .slice(0, 10),
      ),

      ...raw,

      source_file:
        file.name,

      status: 'DRAFT',
    };
  }

  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
    });

  /*
   * Read your REAL sheet names.
   */

  const commercialRows =
    sheetRows(
      workbook,
      'JOURNEE COMMERCIAL',
    );

  const productionRows =
    sheetRows(
      workbook,
      'PRODUCTION',
    );

  const deliveryRows =
    sheetRows(
      workbook,
      'LIVRAISON',
    );

  /*
   * Check sheets.
   */

  if (!commercialRows.length) {
    throw new Error(
      'La feuille "JOURNEE COMMERCIAL" est introuvable.',
    );
  }

  if (!productionRows.length) {
    throw new Error(
      'La feuille "PRODUCTION" est introuvable.',
    );
  }

  if (!deliveryRows.length) {
    throw new Error(
      'La feuille "LIVRAISON" est introuvable.',
    );
  }

  /*
   * Automatically find the latest
   * JOURNEE COMMERCIAL.
   */

  const availableDates = commercialDates(commercialRows);
  const reportDate = latestCommercialDate(commercialRows);

  if (!reportDate) {
    throw new Error(
      'Aucune date "JOURNEE COMMERCIAL DU ..." n’a été détectée dans le fichier.',
    );
  }

  /*
   * Create the report.
   */

  const reports = availableDates.map((date) => {
    const report = emptyReport(date);
    const { sales, collections } = parseSalesAndCollections(commercialRows, date);
    report.source_file = file.name;
    report.status = 'DRAFT';
    report.production = parseProduction(productionRows, date);
    report.wheat = parseWheat(deliveryRows, date);
    // Excel remains the quantity/product source; CA amounts come from the PDF.
    report.sales = sales.map((row) => ({ ...row, montant_da: 0, source: 'EXCEL_QTY' }));
    report.collections = collections;
    report.note = `Import automatique du rapport Minoterie du ${formatDateForTitle(date)}.`;
    return report;
  });

  const latestReport = reports.at(-1);
  return { ...latestReport, historical_reports: reports };
}

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

export function validateImportedReport(
  report,
) {
  const errors = [];

  if (!report.report_date) {
    errors.push(
      'La date du rapport est absente.',
    );
  }

  if (
    !report.production?.length
  ) {
    errors.push(
      'Aucune donnée Production détectée pour cette date.',
    );
  }

  if (!report.wheat?.length) {
    errors.push(
      'Aucune donnée Suivi Blé détectée pour cette date.',
    );
  }

  if (
    !report.collections?.length
  ) {
    errors.push(
      'Aucune donnée Encaissements détectée pour cette date.',
    );
  }

  return errors;
}
