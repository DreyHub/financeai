import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

import FinanceAIPanel from "./components/FinanceAIPanel";
// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  CLIENT_ID:
    "219304870557-pvhr9m5njhn7fgat8r9u6q4hl0sl3m7n.apps.googleusercontent.com",

  SHEET_NAME: "FinanceAI",
  APP_MARKER: "financeai_web_v3",
  LOCAL_STORAGE_SHEET_KEY: "financeai_sheet_id",
  LOCAL_STORAGE_AUTH_KEY: "financeai_google_granted",
  DEFAULT_CYCLE_START_DAY: 17,

  TABS: {
    transacciones: "Transacciones",
    tarjetas: "Tarjetas",
    cuentas: "Cuentas",
    prestamos: "Préstamos",
    config: "Config",
  },

  SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ].join(" "),
};

const SHEET_HEADERS = {
  Transacciones: [
    [
      "Fecha",
      "Hora",
      "Comercio",
      "Tarjeta",
      "Moneda",
      "Monto",
      "Corte",
      "Ciclo",
      "Importado",
      "Tipo",
      "Notas",
    ],
  ],
  Tarjetas: [["Tarjeta", "Nombre", "Corte", "Pago", "Activa", "Notas"]],
  Cuentas: [["ID", "Nombre de la Cuenta", "Moneda", "Saldo Inicial", "Notas"]],
  Préstamos: [
    [
      "ID",
      "Nombre",
      "Entidad",
      "Moneda",
      "Monto Original",
      "Saldo Actual",
      "Cuota Mensual",
      "Tasa Interés (%)",
      "Plazo Restante (meses)",
      "Notas",
    ],
  ],
  Config: [["Clave", "Valor"]],
};

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg: "#08090F",
  surface: "#0E1118",
  card: "#131720",
  card2: "#181F2E",
  border: "rgba(255,255,255,0.06)",
  emerald: "#00D4A0",
  emeraldDim: "rgba(0,212,160,0.1)",
  sapphire: "#3B8EFF",
  sapphireDim: "rgba(59,142,255,0.1)",
  amber: "#F5A623",
  amberDim: "rgba(245,166,35,0.1)",
  rose: "#FF5E7D",
  roseDim: "rgba(255,94,125,0.1)",
  violet: "#9B7FFF",
  text: "#EEF2FF",
  muted: "#4B5675",
  muted2: "#8892AA",
};

// ─────────────────────────────────────────────────────────────
// CATEGORY RULES
// ─────────────────────────────────────────────────────────────
const CATEGORY_RULES = [
  {
    keywords: ["SUPER", "LICORERA", "MAXI", "FRESH", "WALMART", "PRICEMART", "PRICE SMART"],
    cat: "Supermercado",
    color: T.emerald,
  },
  {
    keywords: ["RESTAURANTE", "BURGER", "KFC", "PIZZA", "SODA", "TACO", "PAPA JOHN", "POLLO"],
    cat: "Comidas",
    color: T.sapphire,
  },
  {
    keywords: ["UBER", "DIDI", "PARKING", "AUTOPIST", "GASOLINA", "ESTACION", "AUTO"],
    cat: "Transporte",
    color: T.amber,
  },
  {
    keywords: ["AMAZON", "PAYPAL", "OPENAI", "NETFLIX", "SPOTIFY", "GOOGLE", "APPLE", "KOLBI", "CLARO"],
    cat: "Digital/Subs",
    color: T.violet,
  },
  {
    keywords: ["FARMACIA", "CLINICA", "MEDIC", "HOSPITAL", "DENTAL"],
    cat: "Salud",
    color: "#34D399",
  },
  {
    keywords: ["BARBER", "SALON", "SPA"],
    cat: "Personal",
    color: "#F472B6",
  },
  {
    keywords: ["SEGURO", "INS"],
    cat: "Seguros",
    color: "#60A5FA",
  },
];

// ─────────────────────────────────────────────────────────────
// DEMO
// ─────────────────────────────────────────────────────────────
const DEMO = {
  transacciones: [
    {
      fecha: "12/03/2026",
      hora: "12:45 PM",
      comercio: "CI BAYER HEREDIA",
      tarjeta: "4006",
      moneda: "CRC",
      monto: 3850,
      corte: 26,
      cicloBase: "Feb26-Mar26",
      ciclo: "DAVI Principal (4006) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "12/03/2026",
      hora: "04:09 PM",
      comercio: "SUPER BUENA SUERTE",
      tarjeta: "4006",
      moneda: "CRC",
      monto: 1675,
      corte: 26,
      cicloBase: "Feb26-Mar26",
      ciclo: "DAVI Principal (4006) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "10/03/2026",
      hora: "08:41 AM",
      comercio: "DLC*DIDI San Jose",
      tarjeta: "4006",
      moneda: "CRC",
      monto: 550,
      corte: 26,
      cicloBase: "Feb26-Mar26",
      ciclo: "DAVI Principal (4006) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "10/03/2026",
      hora: "05:15 PM",
      comercio: "PRICE SMART ALAJUELA",
      tarjeta: "4006",
      moneda: "CRC",
      monto: 88328,
      corte: 26,
      cicloBase: "Feb26-Mar26",
      ciclo: "DAVI Principal (4006) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "10/03/2026",
      hora: "07:15 PM",
      comercio: "Spotify",
      tarjeta: "4006",
      moneda: "USD",
      monto: 6.99,
      corte: 26,
      cicloBase: "Feb26-Mar26",
      ciclo: "DAVI Principal (4006) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "08/03/2026",
      hora: "07:16 PM",
      comercio: "MAXIPALI NARANJO",
      tarjeta: "1234",
      moneda: "CRC",
      monto: 37744,
      corte: 15,
      cicloBase: "Feb26-Mar26",
      ciclo: "BAC Walmart (1234) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "07/03/2026",
      hora: "08:53 PM",
      comercio: "EBA*AMAZON Washington",
      tarjeta: "1234",
      moneda: "CRC",
      monto: 30081,
      corte: 15,
      cicloBase: "Feb26-Mar26",
      ciclo: "BAC Walmart (1234) - Feb26-Mar26",
      tipo: "gasto",
      notas: "",
    },
    {
      fecha: "06/03/2026",
      hora: "10:11 AM",
      comercio: "Pago salario",
      tarjeta: "",
      moneda: "CRC",
      monto: 950000,
      corte: "",
      cicloBase: "Feb26-Mar26",
      ciclo: "Feb26-Mar26",
      tipo: "ingreso",
      notas: "Demo",
    },
  ],
  tarjetas: [
    { tarjeta: "4006", nombre: "DAVI Principal", corte: 26, pago: 17, activa: true, notas: "" },
    { tarjeta: "1234", nombre: "BAC Walmart", corte: 15, pago: 5, activa: true, notas: "" },
  ],
  ahorros: [
    { cuenta: "Davibank Colones", moneda: "CRC", saldo: 853460.44 },
    { cuenta: "Aseibm", moneda: "CRC", saldo: 9770779.66 },
    { cuenta: "FCL", moneda: "CRC", saldo: 1886964.41 },
    { cuenta: "BNCR Dolares", moneda: "USD", saldo: 2.03 },
  ],
  deudas: [
    { nombre: "Préstamo Carro", entidad: "DAVIbank", moneda: "USD", saldo: 24093.36, cuota: 669.28, tasa: 10.75, meses: 55 },
    { nombre: "Préstamo Casa", entidad: "BN", moneda: "CRC", saldo: 29976310.63, cuota: 227762.4, tasa: 8.3, meses: 320 },
    { nombre: "Tasa 0 #1", entidad: "DAVIbank", moneda: "CRC", saldo: 404057.66, cuota: 20202.88, tasa: 0, meses: 20 },
  ],
};

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function buildHeaderMap(rows) {
  const first = rows?.[0] || [];
  const map = {};
  first.forEach((h, i) => {
    map[normalizeHeader(h)] = i;
  });
  return map;
}

function getCell(row, map, keys, fallback = "") {
  for (const key of keys) {
    const idx = map[normalizeHeader(key)];
    if (idx !== undefined) return row?.[idx] ?? fallback;
  }
  return fallback;
}

function parseMonto(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;

  let clean = String(raw).replace(/[₡$\s]/g, "").trim();

  if (clean.includes(",") && clean.includes(".")) {
    clean = clean.replace(/,/g, "");
  } else if (clean.includes(",") && !clean.includes(".")) {
    clean = clean.replace(",", ".");
  }

  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateOnly(fecha) {
  if (!fecha) return null;
  const match = String(fecha).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const d = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);

  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateTime(fecha, hora = "") {
  const base = parseDateOnly(fecha);
  if (!base) return null;

  let h = 0;
  let min = 0;

  if (hora) {
    const raw = String(hora).trim().toUpperCase();
    const isPM = raw.includes("PM");
    const isAM = raw.includes("AM");
    const timePart = raw.replace(/AM|PM/g, "").trim();
    const parts = timePart.split(":").map((v) => parseInt(v || "0", 10));

    h = Number.isFinite(parts[0]) ? parts[0] : 0;
    min = Number.isFinite(parts[1]) ? parts[1] : 0;

    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
  }

  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min, 0, 0);
}

function formatDateDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function labelFromDateKey(key) {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function normalizeLast4(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : "";
}

function validateCutDay(value, fallback = CONFIG.DEFAULT_CYCLE_START_DAY) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return fallback;
  return n;
}

function isBaseCycleLabel(value) {
  return /^[A-Z][a-z]{2}\d{2}-[A-Z][a-z]{2}\d{2}$/.test(String(value || "").trim());
}

function getCycleInfoForDate(date, cycleStartDay) {
  const safeDay = clamp(
    parseInt(cycleStartDay || CONFIG.DEFAULT_CYCLE_START_DAY, 10) || CONFIG.DEFAULT_CYCLE_START_DAY,
    1,
    28
  );

  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let startMonth = current.getMonth();
  let startYear = current.getFullYear();

  if (current.getDate() < safeDay) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }

  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }

  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const startDay = Math.min(safeDay, daysInMonth(startYear, startMonth));
  const endDay = Math.min(safeDay, daysInMonth(endYear, endMonth));

  return {
    start: new Date(startYear, startMonth, startDay),
    end: new Date(endYear, endMonth, endDay),
    label: `${monthNames[startMonth]}${String(startYear).slice(-2)}-${monthNames[endMonth]}${String(endYear).slice(-2)}`,
  };
}

function normalizeTipo(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "gasto";
  if (raw.includes("ingreso")) return "ingreso";
  if (raw.includes("pago") && raw.includes("deuda")) return "pago_deuda";
  if (raw.includes("deuda")) return "pago_deuda";
  return "gasto";
}

function getCategory(comercio) {
  const upper = String(comercio || "").toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => upper.includes(k))) return rule;
  }
  return { cat: "Otros", color: T.muted2 };
}

function getTypeMeta(type) {
  switch (type) {
    case "ingreso":
      return { label: "Ingreso", color: T.emerald, bg: T.emeraldDim };
    case "pago_deuda":
      return { label: "Pago deuda", color: T.amber, bg: T.amberDim };
    default:
      return { label: "Gasto", color: T.rose, bg: T.roseDim };
  }
}

function getTarjetaDisplay(card) {
  if (!card) return "Sin tarjeta";
  const last4 = normalizeLast4(card.tarjeta);
  const nombre = String(card.nombre || "").trim();

  if (!nombre) return last4 || "Sin tarjeta";
  if (!last4) return nombre;

  const lower = nombre.toLowerCase();
  if (lower === last4.toLowerCase()) return last4;
  if (lower === `tarjeta ${last4}`.toLowerCase()) return last4;

  return `${nombre} (${last4})`;
}

function findCardByAnyValue(input, cards) {
  const last4 = normalizeLast4(input);
  if (!last4) return null;
  return cards.find((c) => normalizeLast4(c.tarjeta) === last4) || null;
}

const fmtCRC = (n) => `₡${Math.round(Number(n || 0)).toLocaleString("es-CR").replace(/\s/g, ".")}`;
const fmtUSD = (n) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function readConfig(rows) {
  const map = {};
  rows.slice(1).forEach((r) => {
    if (r?.[0]) map[String(r[0]).trim()] = r?.[1] ?? "";
  });

  const cycleStartDay = clamp(
    parseInt(map.ciclo_inicio_dia || map.cycle_start_day || CONFIG.DEFAULT_CYCLE_START_DAY, 10) ||
      CONFIG.DEFAULT_CYCLE_START_DAY,
    1,
    28
  );

  return {
    appMarker: map.app_marker || "",
    cycleStartDay,
  };
}

function parseTarjetas(rows) {
  if (!rows?.length) return [];
  const map = buildHeaderMap(rows);

  return rows
    .slice(1)
    .filter((r) => normalizeLast4(getCell(r, map, ["Tarjeta"])))
    .map((r) => ({
      tarjeta: normalizeLast4(getCell(r, map, ["Tarjeta"])),
      nombre: String(getCell(r, map, ["Nombre"], "")).trim(),
      corte: validateCutDay(getCell(r, map, ["Corte"], CONFIG.DEFAULT_CYCLE_START_DAY)),
      pago: getCell(r, map, ["Pago"], ""),
      activa: String(getCell(r, map, ["Activa"], "Sí")).trim().toLowerCase() !== "no",
      notas: getCell(r, map, ["Notas"], ""),
    }))
    .sort((a, b) => getTarjetaDisplay(a).localeCompare(getTarjetaDisplay(b)));
}

function parseTransacciones(rows, tarjetas, cycleStartDay) {
  if (!rows?.length) return [];
  const map = buildHeaderMap(rows);

  return rows
    .slice(1)
    .filter((r) => {
      const fecha = String(getCell(r, map, ["Fecha"], "") || "").split(" ")[0];
      return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha);
    })
    .map((r) => {
      const fecha = String(getCell(r, map, ["Fecha"], "") || "").split(" ")[0];
      const hora = getCell(r, map, ["Hora"], "");
      const comercio = getCell(r, map, ["Comercio"], "");
      const tarjeta = normalizeLast4(getCell(r, map, ["Tarjeta"], ""));
      const moneda = String(getCell(r, map, ["Moneda"], "CRC")).toUpperCase();
      const monto = parseMonto(getCell(r, map, ["Monto"], 0));

      const tarjetaInfo = findCardByAnyValue(tarjeta, tarjetas);
      const corteRaw = getCell(r, map, ["Corte"], "");
      const corte = validateCutDay(corteRaw || tarjetaInfo?.corte || cycleStartDay, cycleStartDay);

      const parsedDate = parseDateOnly(fecha);
      const cicloBase = parsedDate ? getCycleInfoForDate(parsedDate, corte).label : "";
      const cicloRaw = String(getCell(r, map, ["Ciclo"], "") || "").trim();

      const hasBadCycle =
        !cicloRaw ||
        /sin ciclo/i.test(cicloRaw) ||
        /^\d{4}\s*-\s*sin ciclo/i.test(cicloRaw) ||
        /\(\d{4}\)\s*-\s*sin ciclo/i.test(cicloRaw);

      let ciclo = cicloRaw;

      if (hasBadCycle) {
        ciclo = tarjetaInfo ? `${getTarjetaDisplay(tarjetaInfo)} - ${cicloBase}` : cicloBase;
      } else if (isBaseCycleLabel(cicloRaw) && tarjetaInfo) {
        ciclo = `${getTarjetaDisplay(tarjetaInfo)} - ${cicloRaw}`;
      }

      return {
        fecha,
        hora,
        comercio,
        tarjeta,
        moneda,
        monto,
        corte,
        cicloBase,
        ciclo,
        importado: getCell(r, map, ["Importado"], ""),
        tipo: normalizeTipo(getCell(r, map, ["Tipo"], "")),
        notas: getCell(r, map, ["Notas"], ""),
      };
    })
    .sort((a, b) => {
      const ta = parseDateTime(a.fecha, a.hora)?.getTime() || 0;
      const tb = parseDateTime(b.fecha, b.hora)?.getTime() || 0;
      return tb - ta;
    });
}

function getStoredSheetId() {
  return localStorage.getItem(CONFIG.LOCAL_STORAGE_SHEET_KEY);
}

function setStoredSheetId(id) {
  localStorage.setItem(CONFIG.LOCAL_STORAGE_SHEET_KEY, id);
}

function clearStoredSheetId() {
  localStorage.removeItem(CONFIG.LOCAL_STORAGE_SHEET_KEY);
}

function useViewport() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width,
    isMobile: width < 768,
    isTablet: width < 1024,
  };
}

// ─────────────────────────────────────────────────────────────
// GOOGLE API HELPERS
// ─────────────────────────────────────────────────────────────
async function gFetch(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });

  const raw = await res.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const message =
      (typeof data === "object" && data?.error?.message) ||
      (typeof data === "object" && data?.message) ||
      raw ||
      "Error desconocido";

    const err = new Error(`API error ${res.status}: ${message}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

async function writeRange(sheetId, range, values, token) {
  return gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    }
  );
}

async function appendRow(sheetId, tab, row, token) {
  return gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    }
  );
}

async function fetchSheetData(sheetId, tab, token) {
  try {
    const data = await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}`,
      token
    );
    return data?.values || [];
  } catch (e) {
    if (e?.status === 400 || e?.status === 404) return [];
    throw e;
  }
}

async function fetchSpreadsheetMeta(sheetId, token) {
  return gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=spreadsheetId,properties(title),sheets(properties(title,sheetId))`,
    token
  );
}

async function createSheet(token) {
  const body = {
    properties: { title: CONFIG.SHEET_NAME },
    sheets: Object.keys(SHEET_HEADERS).map((name, i) => ({
      properties: { sheetId: i + 1, title: name, index: i },
    })),
  };

  const sheet = await gFetch("https://sheets.googleapis.com/v4/spreadsheets", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const sid = sheet.spreadsheetId;

  await Promise.all(
    Object.entries(SHEET_HEADERS).map(([tab, headers]) =>
      writeRange(sid, `${tab}!A1`, headers, token)
    )
  );

  await writeRange(
    sid,
    "Config!A2",
    [
      ["app_marker", CONFIG.APP_MARKER],
      ["ciclo_inicio_dia", String(CONFIG.DEFAULT_CYCLE_START_DAY)],
      ["created_at", new Date().toISOString()],
    ],
    token
  );

  return sid;
}

function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => String(x) === String(b[i]));
}

function isBlankRow(row = []) {
  return !row.some((v) => String(v || "").trim() !== "");
}

async function ensureSpreadsheetStructure(sheetId, token) {
  const meta = await fetchSpreadsheetMeta(sheetId, token);
  const existingTitles = new Set((meta?.sheets || []).map((s) => s.properties.title));
  const addSheetRequests = [];

  Object.keys(SHEET_HEADERS).forEach((title) => {
    if (!existingTitles.has(title)) {
      addSheetRequests.push({
        addSheet: { properties: { title } },
      });
    }
  });

  if (addSheetRequests.length) {
    await gFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ requests: addSheetRequests }),
      }
    );
  }

  for (const [tab, headers] of Object.entries(SHEET_HEADERS)) {
    const rows = await fetchSheetData(sheetId, tab, token);
    const currentHeader = rows?.[0] || [];

    if (!rows.length || isBlankRow(currentHeader)) {
      await writeRange(sheetId, `${tab}!A1`, headers, token);
    } else if (tab !== "Transacciones" && tab !== "Tarjetas" && !arraysEqual(currentHeader, headers[0])) {
      await writeRange(sheetId, `${tab}!A1`, headers, token);
    }
  }

  const configRows = await fetchSheetData(sheetId, "Config", token);
  const config = readConfig(configRows);

  const configKeys = new Set(configRows.slice(1).map((r) => String(r?.[0] || "").trim()));
  const missingRows = [];

  if (config.appMarker !== CONFIG.APP_MARKER && !configKeys.has("app_marker")) {
    missingRows.push(["app_marker", CONFIG.APP_MARKER]);
  }
  if (!configKeys.has("ciclo_inicio_dia")) {
    missingRows.push(["ciclo_inicio_dia", String(CONFIG.DEFAULT_CYCLE_START_DAY)]);
  }

  if (missingRows.length) {
    for (const row of missingRows) {
      await appendRow(sheetId, "Config", row, token);
    }
  }
}

async function findManagedSheet(token) {
  const q = encodeURIComponent(
    `name='${CONFIG.SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );

  const data = await gFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=10`,
    token
  );

  const files = data?.files || [];
  for (const file of files) {
    try {
      const configRows = await fetchSheetData(file.id, "Config", token);
      const config = readConfig(configRows);
      if (config.appMarker === CONFIG.APP_MARKER || file.name === CONFIG.SHEET_NAME) return file.id;
    } catch {
      // ignore
    }
  }

  return files[0]?.id || null;
}

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────
function EmptyState({ title, subtitle, action }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: "1.5rem",
        color: T.muted2,
      }}
    >
      <div style={{ fontSize: 14, color: T.text, marginBottom: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{subtitle}</div>
      {action && <div style={{ marginTop: "1rem" }}>{action}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: "1rem",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.75rem",
          gap: "0.75rem",
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: T.muted,
            fontFamily: "'DM Mono',monospace",
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${color}15`,
            border: `1px solid ${color}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: "clamp(0.95rem, 2vw, 1.25rem)",
          fontWeight: 600,
          color,
          lineHeight: 1.2,
          marginBottom: "0.4rem",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      {sub && <div style={{ fontSize: 11, color: T.muted2 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, subtitle, action, isMobile }) {
  return (
    <div
      style={{
        padding: isMobile ? "1rem" : "1.25rem 1.5rem",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        gap: "0.75rem",
      }}
    >
      <div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.muted2, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function SecondaryButton({ children, onClick, fullWidth = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: fullWidth ? "100%" : "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.45rem",
        background: T.card2,
        border: `1px solid ${T.border}`,
        color: T.text,
        borderRadius: 10,
        padding: "0.7rem 0.95rem",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...fieldLabelStyle, marginBottom: 6 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={fieldInputStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: T.card2,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "0.75rem 1rem",
        fontSize: 12,
      }}
    >
      <div style={{ color: T.muted2, marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {fmtCRC(p.value)}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const { isMobile, isTablet } = useViewport();
  const tokenClientRef = useRef(null);
  const actionMenuRef = useRef(null);

  const [auth, setAuth] = useState({ token: null, expiresAt: 0 });
  const [sheetId, setSheetId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState("");
  const [error, setError] = useState(null);

  const [tab, setTab] = useState("overview");
  const [isDemo, setIsDemo] = useState(true);
  const [gsLoaded, setGsLoaded] = useState(false);

  const [configData, setConfigData] = useState({
    cycleStartDay: CONFIG.DEFAULT_CYCLE_START_DAY,
  });

  const [txns, setTxns] = useState(DEMO.transacciones);
  const [tarjetasData, setTarjetasData] = useState(DEMO.tarjetas);
  const [ahorrosData, setAhorrosData] = useState(DEMO.ahorros);
  const [deudasData, setDeudasData] = useState(DEMO.deudas);

  const [selectedCycle, setSelectedCycle] = useState("all");
  const [selectedCard, setSelectedCard] = useState("all");

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const [movementType, setMovementType] = useState("gasto");
  const [movementForm, setMovementForm] = useState({
    comercio: "",
    monto: "",
    moneda: "CRC",
    tarjeta: "",
    notas: "",
  });

  const [accountForm, setAccountForm] = useState({
    nombre: "",
    moneda: "CRC",
    saldoInicial: "",
    notas: "",
  });

  const [debtForm, setDebtForm] = useState({
    nombre: "",
    entidad: "",
    moneda: "CRC",
    montoOriginal: "",
    saldoActual: "",
    cuotaMensual: "",
    tasa: "",
    plazoRestante: "",
    notas: "",
  });

  const [cardForm, setCardForm] = useState({
    tarjeta: "",
    nombre: "",
    corte: String(CONFIG.DEFAULT_CYCLE_START_DAY),
    pago: "",
    notas: "",
  });

  const cycleStartDay = configData.cycleStartDay;

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGsLoaded(true);
    document.head.appendChild(script);

    return () => {
      try {
        document.head.removeChild(script);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };

    if (showActionMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActionMenu]);

  const hasValidToken = () => auth.token && Date.now() < auth.expiresAt - 60_000;

  const initTokenClient = () => {
    if (!window.google || tokenClientRef.current) return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp?.error) {
          setError(resp.error);
          setLoading(false);
          setSetupStatus("");
          return;
        }

        const accessToken = resp.access_token;
        const expiresAt = Date.now() + Number(resp.expires_in || 3600) * 1000;

        setAuth({ token: accessToken, expiresAt });
        localStorage.setItem(CONFIG.LOCAL_STORAGE_AUTH_KEY, "1");

        try {
          await loadFinanceData(accessToken);
        } catch (e) {
          setError(e.message || "No se pudo cargar la información.");
          setLoading(false);
          setSetupStatus("");
        }
      },
    });
  };

  const requestGoogleAccess = () => {
    if (!gsLoaded || !window.google) return;

    initTokenClient();

    setError(null);
    setLoading(true);

    const hasGrantedBefore = localStorage.getItem(CONFIG.LOCAL_STORAGE_AUTH_KEY) === "1";
    tokenClientRef.current.requestAccessToken({
      prompt: hasGrantedBefore ? "" : "consent",
    });
  };

  const loadFinanceData = async (token) => {
    setSetupStatus("Preparando tu FinanceAI...");

    let sid = getStoredSheetId();

    if (sid) {
      try {
        setSetupStatus("Verificando tu Sheet guardado...");
        await ensureSpreadsheetStructure(sid, token);
      } catch {
        clearStoredSheetId();
        sid = null;
      }
    }

    if (!sid) {
      setSetupStatus("Buscando tu Sheet existente...");
      sid = await findManagedSheet(token);
    }

    if (!sid) {
      setSetupStatus("Creando tu Sheet por primera vez...");
      sid = await createSheet(token);
    }

    setStoredSheetId(sid);
    setSheetId(sid);

    setSetupStatus("Asegurando estructura del Sheet...");
    await ensureSpreadsheetStructure(sid, token);

    setSetupStatus("Cargando datos reales...");
    const [txnRows, tarjetasRows, cuentasRows, prestamosRows, configRows] = await Promise.all([
      fetchSheetData(sid, CONFIG.TABS.transacciones, token),
      fetchSheetData(sid, CONFIG.TABS.tarjetas, token),
      fetchSheetData(sid, CONFIG.TABS.cuentas, token),
      fetchSheetData(sid, CONFIG.TABS.prestamos, token),
      fetchSheetData(sid, CONFIG.TABS.config, token),
    ]);

    const cfg = readConfig(configRows);
    setConfigData({ cycleStartDay: cfg.cycleStartDay });

    const parsedTarjetas = parseTarjetas(tarjetasRows);
    const parsedTxns = parseTransacciones(txnRows, parsedTarjetas, cfg.cycleStartDay);

    const cuentasParsed = cuentasRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[2] && r?.[3] !== undefined)
      .map((r) => ({
        cuenta: r[1],
        moneda: String(r[2] || "CRC").toUpperCase(),
        saldo: parseMonto(r[3]),
      }));

    const prestamosParsed = prestamosRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[5] !== undefined)
      .map((r) => ({
        nombre: r[1],
        entidad: r[2] || "",
        moneda: String(r[3] || "CRC").toUpperCase(),
        saldo: parseMonto(r[5]),
        cuota: parseMonto(r[6]),
        tasa: parseFloat(String(r[7] || "0").replace(",", ".")) || 0,
        meses: parseInt(r[8] || "0", 10) || 0,
      }));

    setTarjetasData(parsedTarjetas);
    setTxns(parsedTxns);
    setAhorrosData(cuentasParsed);
    setDeudasData(prestamosParsed);
    setIsDemo(false);
    setLoading(false);
    setSetupStatus("");
  };

  async function reloadAll() {
    if (!sheetId || !auth.token) return;

    const [txnRows, tarjetasRows, cuentasRows, prestamosRows] = await Promise.all([
      fetchSheetData(sheetId, CONFIG.TABS.transacciones, auth.token),
      fetchSheetData(sheetId, CONFIG.TABS.tarjetas, auth.token),
      fetchSheetData(sheetId, CONFIG.TABS.cuentas, auth.token),
      fetchSheetData(sheetId, CONFIG.TABS.prestamos, auth.token),
    ]);

    const parsedTarjetas = parseTarjetas(tarjetasRows);
    const parsedTxns = parseTransacciones(txnRows, parsedTarjetas, cycleStartDay);

    const cuentasParsed = cuentasRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[2] && r?.[3] !== undefined)
      .map((r) => ({
        cuenta: r[1],
        moneda: String(r[2] || "CRC").toUpperCase(),
        saldo: parseMonto(r[3]),
      }));

    const prestamosParsed = prestamosRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[5] !== undefined)
      .map((r) => ({
        nombre: r[1],
        entidad: r[2] || "",
        moneda: String(r[3] || "CRC").toUpperCase(),
        saldo: parseMonto(r[5]),
        cuota: parseMonto(r[6]),
        tasa: parseFloat(String(r[7] || "0").replace(",", ".")) || 0,
        meses: parseInt(r[8] || "0", 10) || 0,
      }));

    setTarjetasData(parsedTarjetas);
    setTxns(parsedTxns);
    setAhorrosData(cuentasParsed);
    setDeudasData(prestamosParsed);
  }

  async function reloadTransactions() {
    const [txnRows, tarjetasRows] = await Promise.all([
      fetchSheetData(sheetId, CONFIG.TABS.transacciones, auth.token),
      fetchSheetData(sheetId, CONFIG.TABS.tarjetas, auth.token),
    ]);

    const parsedTarjetas = parseTarjetas(tarjetasRows);
    const parsed = parseTransacciones(txnRows, parsedTarjetas, cycleStartDay);
    setTarjetasData(parsedTarjetas);
    setTxns(parsed);
  }

  async function reloadAccounts() {
    const cuentasRows = await fetchSheetData(sheetId, CONFIG.TABS.cuentas, auth.token);
    const cuentasParsed = cuentasRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[2] && r?.[3] !== undefined)
      .map((r) => ({
        cuenta: r[1],
        moneda: String(r[2] || "CRC").toUpperCase(),
        saldo: parseMonto(r[3]),
      }));

    setAhorrosData(cuentasParsed);
  }

  async function reloadDebts() {
    const prestamosRows = await fetchSheetData(sheetId, CONFIG.TABS.prestamos, auth.token);
    const prestamosParsed = prestamosRows
      .slice(1)
      .filter((r) => r?.[1] && r?.[5] !== undefined)
      .map((r) => ({
        nombre: r[1],
        entidad: r[2] || "",
        moneda: String(r[3] || "CRC").toUpperCase(),
        saldo: parseMonto(r[5]),
        cuota: parseMonto(r[6]),
        tasa: parseFloat(String(r[7] || "0").replace(",", ".")) || 0,
        meses: parseInt(r[8] || "0", 10) || 0,
      }));

    setDeudasData(prestamosParsed);
  }

  async function reloadCards() {
    const tarjetasRows = await fetchSheetData(sheetId, CONFIG.TABS.tarjetas, auth.token);
    setTarjetasData(parseTarjetas(tarjetasRows));
  }

  const cycleOptions = useMemo(() => {
    const cycleMap = new Map();

    txns.forEach((t) => {
      const key = t.ciclo || "Sin ciclo";
      const ts = parseDateTime(t.fecha, t.hora)?.getTime() || 0;
      cycleMap.set(key, Math.max(cycleMap.get(key) || 0, ts));
    });

    const sorted = [...cycleMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cycle]) => ({ value: cycle, label: cycle }));

    return [{ value: "all", label: "Todos los ciclos" }, ...sorted];
  }, [txns]);

  const cardOptions = useMemo(() => {
    const map = new Map();

    tarjetasData
      .filter((c) => c.activa)
      .forEach((card) => {
        map.set(normalizeLast4(card.tarjeta), {
          value: normalizeLast4(card.tarjeta),
          label: getTarjetaDisplay(card),
        });
      });

    txns.forEach((t) => {
      const last4 = normalizeLast4(t.tarjeta);
      if (!last4 || map.has(last4)) return;
      map.set(last4, { value: last4, label: last4 });
    });

    return [{ value: "all", label: "Todas las tarjetas" }, ...[...map.values()].sort((a, b) => a.label.localeCompare(b.label))];
  }, [tarjetasData, txns]);

  useEffect(() => {
    const valid = cycleOptions.some((o) => o.value === selectedCycle);
    if (!valid) {
      const firstReal = cycleOptions.find((o) => o.value !== "all");
      setSelectedCycle(firstReal?.value || "all");
    }
  }, [cycleOptions, selectedCycle]);

  useEffect(() => {
    const valid = cardOptions.some((o) => o.value === selectedCard);
    if (!valid) setSelectedCard("all");
  }, [cardOptions, selectedCard]);

  const visibleTxns = useMemo(() => {
    return txns.filter((t) => {
      const cycleOk = selectedCycle === "all" || t.ciclo === selectedCycle;
      const cardOk = selectedCard === "all" || normalizeLast4(t.tarjeta) === selectedCard;
      return cycleOk && cardOk;
    });
  }, [txns, selectedCycle, selectedCard]);

  const previousCycleLabel = useMemo(() => {
  if (selectedCycle === "all") return "";

  const realCycles = cycleOptions.filter((o) => o.value !== "all");
  const idx = realCycles.findIndex((o) => o.value === selectedCycle);

  return idx >= 0 ? realCycles[idx + 1]?.value || "" : "";
}, [cycleOptions, selectedCycle]);

const comparisonTxns = useMemo(() => {
  if (!previousCycleLabel) return [];

  return txns.filter((t) => {
    const cycleOk = t.ciclo === previousCycleLabel;
    const cardOk = selectedCard === "all" || normalizeLast4(t.tarjeta) === selectedCard;
    return cycleOk && cardOk;
  });
}, [txns, previousCycleLabel, selectedCard]);

const selectedCardLabel = useMemo(() => {
  return cardOptions.find((o) => o.value === selectedCard)?.label || "Todas las tarjetas";
}, [cardOptions, selectedCard]);

  const cycleScopedTxns = useMemo(() => {
    return txns.filter((t) => (selectedCycle === "all" ? true : t.ciclo === selectedCycle));
  }, [txns, selectedCycle]);

  const handleRegistrarMovimiento = async () => {
    if (!hasValidToken() || !sheetId) {
      setError("Tu sesión con Google expiró. Tocá “Conectar / renovar Google” y probá de nuevo.");
      return;
    }

    if (!movementForm.comercio || !movementForm.monto) return;

    const now = new Date();
    const fecha = formatDateDDMMYYYY(now);
    const hora = now.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });

    const card = findCardByAnyValue(movementForm.tarjeta, tarjetasData);
    const last4 = card ? card.tarjeta : normalizeLast4(movementForm.tarjeta);
    const corte = card ? validateCutDay(card.corte, cycleStartDay) : validateCutDay(cycleStartDay, cycleStartDay);
    const cicloBase = getCycleInfoForDate(now, corte).label;
    const ciclo = last4
      ? `${card ? getTarjetaDisplay(card) : last4} - ${cicloBase}`
      : cicloBase;

    const row = [
      fecha,
      hora,
      movementForm.comercio,
      last4,
      movementForm.moneda,
      movementForm.monto,
      last4 ? corte : "",
      ciclo,
      new Date().toISOString(),
      movementType,
      movementForm.notas,
    ];

    try {
      setLoading(true);
      setSetupStatus("Guardando movimiento...");
      await appendRow(sheetId, CONFIG.TABS.transacciones, row, auth.token);
      await reloadTransactions();

      setShowMovementModal(false);
      setMovementType("gasto");
      setMovementForm({
        comercio: "",
        monto: "",
        moneda: "CRC",
        tarjeta: "",
        notas: "",
      });
    } catch (e) {
      setError(`Error al registrar movimiento: ${e.message}`);
    } finally {
      setLoading(false);
      setSetupStatus("");
    }
  };

  const handleRegistrarCuenta = async () => {
    if (!hasValidToken() || !sheetId) {
      setError("Tu sesión con Google expiró. Volvé a conectar Google.");
      return;
    }

    if (!accountForm.nombre || !accountForm.saldoInicial) return;

    try {
      setLoading(true);
      setSetupStatus("Guardando cuenta...");

      const row = [
        `CTA-${Date.now()}`,
        accountForm.nombre,
        accountForm.moneda,
        accountForm.saldoInicial,
        accountForm.notas,
      ];

      await appendRow(sheetId, CONFIG.TABS.cuentas, row, auth.token);
      await reloadAccounts();

      setShowAccountModal(false);
      setAccountForm({
        nombre: "",
        moneda: "CRC",
        saldoInicial: "",
        notas: "",
      });
    } catch (e) {
      setError(`Error al registrar cuenta: ${e.message}`);
    } finally {
      setLoading(false);
      setSetupStatus("");
    }
  };

  const handleRegistrarDeuda = async () => {
    if (!hasValidToken() || !sheetId) {
      setError("Tu sesión con Google expiró. Volvé a conectar Google.");
      return;
    }

    if (!debtForm.nombre || !debtForm.saldoActual) return;

    try {
      setLoading(true);
      setSetupStatus("Guardando deuda...");

      const row = [
        `PRE-${Date.now()}`,
        debtForm.nombre,
        debtForm.entidad,
        debtForm.moneda,
        debtForm.montoOriginal,
        debtForm.saldoActual,
        debtForm.cuotaMensual,
        debtForm.tasa,
        debtForm.plazoRestante,
        debtForm.notas,
      ];

      await appendRow(sheetId, CONFIG.TABS.prestamos, row, auth.token);
      await reloadDebts();

      setShowDebtModal(false);
      setDebtForm({
        nombre: "",
        entidad: "",
        moneda: "CRC",
        montoOriginal: "",
        saldoActual: "",
        cuotaMensual: "",
        tasa: "",
        plazoRestante: "",
        notas: "",
      });
    } catch (e) {
      setError(`Error al registrar deuda: ${e.message}`);
    } finally {
      setLoading(false);
      setSetupStatus("");
    }
  };

  const handleRegistrarTarjeta = async () => {
    if (!hasValidToken() || !sheetId) {
      setError("Tu sesión con Google expiró. Volvé a conectar Google.");
      return;
    }

    const last4 = normalizeLast4(cardForm.tarjeta);
    if (!last4 || !cardForm.nombre || !cardForm.corte) return;

    try {
      setLoading(true);
      setSetupStatus("Guardando tarjeta...");

      const row = [
        last4,
        cardForm.nombre,
        validateCutDay(cardForm.corte, cycleStartDay),
        cardForm.pago,
        "Sí",
        cardForm.notas,
      ];

      await appendRow(sheetId, CONFIG.TABS.tarjetas, row, auth.token);
      await reloadCards();
      await reloadTransactions();

      setShowCardModal(false);
      setCardForm({
        tarjeta: "",
        nombre: "",
        corte: String(CONFIG.DEFAULT_CYCLE_START_DAY),
        pago: "",
        notas: "",
      });
    } catch (e) {
      setError(`Error al registrar tarjeta: ${e.message}`);
    } finally {
      setLoading(false);
      setSetupStatus("");
    }
  };

  // ───────────────────────────────────────────────────────────
  // DERIVED DATA
  // ───────────────────────────────────────────────────────────
  const gastos = useMemo(() => visibleTxns.filter((t) => t.tipo === "gasto"), [visibleTxns]);
  const ingresos = useMemo(() => visibleTxns.filter((t) => t.tipo === "ingreso"), [visibleTxns]);
  const pagosDeuda = useMemo(() => visibleTxns.filter((t) => t.tipo === "pago_deuda"), [visibleTxns]);

  const crcGastos = useMemo(() => gastos.filter((t) => t.moneda === "CRC"), [gastos]);
  const usdGastos = useMemo(() => gastos.filter((t) => t.moneda === "USD"), [gastos]);
  const crcIngresos = useMemo(() => ingresos.filter((t) => t.moneda === "CRC"), [ingresos]);
  const usdIngresos = useMemo(() => ingresos.filter((t) => t.moneda === "USD"), [ingresos]);
  const crcPagosDeuda = useMemo(() => pagosDeuda.filter((t) => t.moneda === "CRC"), [pagosDeuda]);
  const usdPagosDeuda = useMemo(() => pagosDeuda.filter((t) => t.moneda === "USD"), [pagosDeuda]);

  const totalGastosCRC = crcGastos.reduce((a, t) => a + t.monto, 0);
  const totalGastosUSD = usdGastos.reduce((a, t) => a + t.monto, 0);
  const totalIngresosCRC = crcIngresos.reduce((a, t) => a + t.monto, 0);
  const totalIngresosUSD = usdIngresos.reduce((a, t) => a + t.monto, 0);
  const totalPagosDeudaCRC = crcPagosDeuda.reduce((a, t) => a + t.monto, 0);
  const totalPagosDeudaUSD = usdPagosDeuda.reduce((a, t) => a + t.monto, 0);

  const categories = useMemo(() => {
    const map = {};
    crcGastos.forEach((t) => {
      const { cat, color } = getCategory(t.comercio);
      if (!map[cat]) map[cat] = { cat, color, total: 0, count: 0 };
      map[cat].total += t.monto;
      map[cat].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [crcGastos]);

  const topComercios = useMemo(() => {
    const map = {};
    crcGastos.forEach((t) => {
      const key = String(t.comercio || "").trim() || "Sin nombre";
      map[key] = (map[key] || 0) + t.monto;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [crcGastos]);

  const dailyData = useMemo(() => {
    const grouped = new Map();

    crcGastos.forEach((t) => {
      const date = parseDateOnly(t.fecha);
      if (!date) return;
      const key = formatDateKey(date);
      grouped.set(key, (grouped.get(key) || 0) + t.monto);
    });

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([key, amt]) => ({ day: labelFromDateKey(key), amt }));
  }, [crcGastos]);

  const spendByCard = useMemo(() => {
    const map = {};
    cycleScopedTxns
      .filter((t) => t.tipo === "gasto" && t.moneda === "CRC")
      .forEach((t) => {
        const card = findCardByAnyValue(t.tarjeta, tarjetasData);
        const label = card ? getTarjetaDisplay(card) : normalizeLast4(t.tarjeta) || "Sin tarjeta";
        if (!map[label]) map[label] = { tarjeta: label, total: 0 };
        map[label].total += t.monto;
      });

    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [cycleScopedTxns, tarjetasData]);

  const ahorros = ahorrosData;
  const deudas = deudasData;

  const totalAhorrosCRC = ahorros.filter((a) => a.moneda === "CRC").reduce((s, a) => s + a.saldo, 0);
  const totalAhorrosUSD = ahorros.filter((a) => a.moneda === "USD").reduce((s, a) => s + a.saldo, 0);

  const totalDeudaCRC = deudas.filter((d) => d.moneda === "CRC").reduce((s, d) => s + d.saldo, 0);
  const totalDeudaUSD = deudas.filter((d) => d.moneda === "USD").reduce((s, d) => s + d.saldo, 0);

  const totalCuotasCRC = deudas.filter((d) => d.moneda === "CRC").reduce((s, d) => s + d.cuota, 0);
  const totalCuotasUSD = deudas.filter((d) => d.moneda === "USD").reduce((s, d) => s + d.cuota, 0);

  const currentSelectionLabel = selectedCycle === "all" ? "Todos los ciclos" : selectedCycle;

  const movementPreview = useMemo(() => {
    const card = findCardByAnyValue(movementForm.tarjeta, tarjetasData);
    const now = new Date();
    const cut = card ? validateCutDay(card.corte, cycleStartDay) : cycleStartDay;
    const cycleBase = getCycleInfoForDate(now, cut).label;
    const last4 = card ? card.tarjeta : normalizeLast4(movementForm.tarjeta);

    return {
      cardLabel: card ? getTarjetaDisplay(card) : last4 || "Sin tarjeta",
      cut: last4 ? cut : "—",
      cycle: last4 ? `${card ? getTarjetaDisplay(card) : last4} - ${cycleBase}` : cycleBase,
    };
  }, [movementForm.tarjeta, tarjetasData, cycleStartDay]);

  const tabs = [
    { id: "overview", label: "Resumen", icon: "◈" },
    { id: "transactions", label: "Movimientos", icon: "◎" },
    { id: "cards", label: "Tarjetas", icon: "◌" },
    { id: "savings", label: "Ahorros", icon: "◉" },
    { id: "debts", label: "Deudas", icon: "◫" },
  ];

  const openMovementModal = () => {
    setShowActionMenu(false);
    setShowMovementModal(true);
  };

  const openAccountModal = () => {
    setShowActionMenu(false);
    setShowAccountModal(true);
  };

  const openDebtModal = () => {
    setShowActionMenu(false);
    setShowDebtModal(true);
  };

  const openCardModal = () => {
    setShowActionMenu(false);
    setShowCardModal(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "radial-gradient(ellipse 70% 40% at 15% 0%, rgba(0,212,160,0.05) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 85% 100%, rgba(59,142,255,0.04) 0%, transparent 60%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "0 1rem 6rem" : "0 1.5rem 5rem",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: isMobile ? "1rem 0 1rem" : "1.75rem 0 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: isMobile ? "stretch" : "center",
            flexDirection: isMobile ? "column" : "row",
            gap: "1rem",
            borderBottom: `1px solid ${T.border}`,
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: 4 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isDemo ? T.amber : T.emerald,
                  boxShadow: `0 0 8px ${isDemo ? T.amber : T.emerald}`,
                }}
              />
              <span
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: isDemo ? T.amber : T.emerald,
                }}
              >
                {isDemo ? "DEMO — Datos de ejemplo" : "CONECTADO — Google Sheet real"}
              </span>
            </div>

            <h1
              style={{
                fontFamily: "'Syne',sans-serif",
                fontSize: "clamp(1.45rem,3vw,2rem)",
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Finance<span style={{ color: T.emerald }}>AI</span>
              <span
                style={{
                  display: isMobile ? "block" : "inline",
                  fontSize: "0.9rem",
                  fontWeight: 400,
                  color: T.muted2,
                  marginLeft: isMobile ? 0 : "0.75rem",
                  marginTop: isMobile ? 6 : 0,
                }}
              >
                · {currentSelectionLabel}
              </span>
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              flexDirection: isMobile ? "column" : "row",
              width: isMobile ? "100%" : "auto",
            }}
          >
            <button
              onClick={requestGoogleAccess}
              disabled={!gsLoaded}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.6rem",
                background: T.card,
                border: `1px solid ${T.emerald}40`,
                color: T.text,
                borderRadius: 12,
                padding: "0.8rem 1rem",
                cursor: gsLoaded ? "pointer" : "default",
                fontSize: "0.85rem",
                fontWeight: 500,
                width: isMobile ? "100%" : "auto",
                boxShadow: `0 0 20px ${T.emerald}10`,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {auth.token ? "Conectar / renovar Google" : "Conectar Google Sheet"}
            </button>

            {auth.token && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: T.emeraldDim,
                  border: `1px solid ${T.emerald}30`,
                  borderRadius: 10,
                  padding: "0.5rem 1rem",
                }}
              >
                <span style={{ fontSize: 12, color: T.emerald, fontFamily: "'DM Mono',monospace" }}>
                  ✓ Acceso listo
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: T.roseDim,
              border: `1px solid ${T.rose}30`,
              borderRadius: 10,
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: 13,
              color: T.rose,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div
            style={{
              background: T.sapphireDim,
              border: `1px solid ${T.sapphire}30`,
              borderRadius: 10,
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: 13,
              color: T.sapphire,
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {setupStatus || "⟳ Cargando..."}
          </div>
        )}

        {isDemo && (
          <div
            style={{
              background: T.amberDim,
              border: `1px solid ${T.amber}30`,
              borderRadius: 12,
              padding: "0.85rem 1rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: 16 }}>💡</span>
            <div style={{ fontSize: 13, color: T.muted2 }}>
              Viendo datos de demo. Tocá <span style={{ color: T.amber, fontWeight: 600 }}>Conectar Google Sheet</span> para usar tus datos reales.
            </div>
          </div>
        )}

        {/* TABS */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: 4,
            marginBottom: "1rem",
            width: "100%",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? T.emeraldDim : "transparent",
                border: `1px solid ${tab === t.id ? `${T.emerald}40` : "transparent"}`,
                color: tab === t.id ? T.emerald : T.muted2,
                borderRadius: 10,
                padding: "0.6rem 0.9rem",
                fontFamily: "'DM Mono',monospace",
                fontSize: 12,
                cursor: "pointer",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* FILTERS */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: isMobile ? "1rem" : "1rem 1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto",
              gap: "0.85rem",
              alignItems: "end",
            }}
          >
            <FilterSelect
              label="Ciclo"
              value={selectedCycle}
              onChange={setSelectedCycle}
              options={cycleOptions}
            />

            <FilterSelect
              label="Tarjeta"
              value={selectedCard}
              onChange={setSelectedCard}
              options={cardOptions}
            />

            {!isDemo && (
              <SecondaryButton onClick={reloadAll} fullWidth={isMobile}>
                ↻ Recargar
              </SecondaryButton>
            )}
          </div>
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                gap: "1rem",
              }}
            >
              <StatCard
                label="Gastos CRC"
                value={fmtCRC(totalGastosCRC)}
                sub={`${crcGastos.length} movimientos`}
                color={T.rose}
                icon="₡"
              />
              <StatCard
                label="Gastos USD"
                value={fmtUSD(totalGastosUSD)}
                sub={`${usdGastos.length} movimientos`}
                color={T.sapphire}
                icon="$"
              />
              <StatCard
                label="Ingresos CRC"
                value={fmtCRC(totalIngresosCRC)}
                sub={`${crcIngresos.length} movimientos`}
                color={T.emerald}
                icon="↗"
              />
              <StatCard
                label="Pago Deuda CRC"
                value={fmtCRC(totalPagosDeudaCRC)}
                sub={`${crcPagosDeuda.length} movimientos`}
                color={T.amber}
                icon="◫"
              />
              <StatCard
                label="Ahorros CRC"
                value={fmtCRC(totalAhorrosCRC)}
                sub={`${ahorros.filter((a) => a.moneda === "CRC").length} cuentas`}
                color={T.emerald}
                icon="◉"
              />
              <StatCard
                label="Deuda Total CRC"
                value={fmtCRC(totalDeudaCRC)}
                sub={`Cuotas: ${fmtCRC(totalCuotasCRC)}/mes`}
                color={T.rose}
                icon="◎"
              />
              <StatCard
                label="Tarjetas activas"
                value={String(tarjetasData.filter((t) => t.activa).length)}
                sub={selectedCard === "all" ? "Vista general" : `Filtro ${selectedCard}`}
                color={T.violet}
                icon="◌"
              />
              <StatCard
                label="Ciclo seleccionado"
                value={selectedCycle === "all" ? "Todos" : selectedCycle}
                sub="Filtro activo"
                color={T.amber}
                icon="◈"
              />
            </div>

            <FinanceAIPanel
  theme={T}
  isMobile={isMobile}
  transactions={visibleTxns}
  comparisonTransactions={comparisonTxns}
  cycleLabel={currentSelectionLabel}
  cardLabel={selectedCardLabel}
/>

            <div
              style={{
                background: T.card,
                borderRadius: 16,
                padding: isMobile ? "1rem" : "1.5rem",
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: 3 }}>
                  Gastos por Día
                </div>
                <div style={{ fontSize: 12, color: T.muted2 }}>
                  Solo gastos CRC · {currentSelectionLabel}
                </div>
              </div>

              {dailyData.length ? (
                <ResponsiveContainer width="100%" height={isMobile ? 220 : 190}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="gEmerald" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.emerald} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={T.emerald} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: T.muted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₡${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amt"
                      name="Gastos"
                      stroke={T.emerald}
                      strokeWidth={2}
                      fill="url(#gEmerald)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Sin gastos CRC en esta selección"
                  subtitle="Cuando entren movimientos de gasto en colones, aquí vas a ver la curva diaria."
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  background: T.card,
                  borderRadius: 16,
                  padding: isMobile ? "1rem" : "1.5rem",
                  border: `1px solid ${T.border}`,
                }}
              >
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "1.1rem" }}>
                  Por Categoría
                </div>

                {categories.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={isMobile ? 200 : 170}>
                      <PieChart>
                        <Pie
                          data={categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 42 : 45}
                          outerRadius={isMobile ? 64 : 68}
                          paddingAngle={3}
                          dataKey="total"
                        >
                          {categories.map((c, i) => (
                            <Cell key={i} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => fmtCRC(v)}
                          contentStyle={{
                            background: T.card2,
                            border: `1px solid ${T.border}`,
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.5rem" }}>
                      {categories.slice(0, 5).map((c, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: c.color,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontSize: 12, color: T.muted2, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {c.cat}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: T.text, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
                            {fmtCRC(c.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Sin categorías todavía"
                    subtitle="Las categorías salen solo de los gastos en CRC."
                  />
                )}
              </div>

              <div
                style={{
                  background: T.card,
                  borderRadius: 16,
                  padding: isMobile ? "1rem" : "1.5rem",
                  border: `1px solid ${T.border}`,
                }}
              >
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "1.1rem" }}>
                  Top Comercios
                </div>

                {topComercios.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    {topComercios.map(([name, amt], i) => {
                      const pct = totalGastosCRC > 0 ? Math.round((amt / totalGastosCRC) * 100) : 0;

                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
                            <span
                              style={{
                                fontSize: 12,
                                color: T.muted2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                              }}
                            >
                              {name}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: T.text,
                                fontFamily: "'DM Mono',monospace",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmtCRC(amt)}
                            </span>
                          </div>

                          <div
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              borderRadius: 4,
                              height: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                height: "100%",
                                background: `linear-gradient(90deg, ${T.emerald}, ${T.sapphire})`,
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="Sin comercios todavía"
                    subtitle="Aquí vas a ver los comercios más pesados de tus gastos en CRC."
                  />
                )}
              </div>
            </div>

            <div
              style={{
                background: T.card,
                borderRadius: 16,
                padding: isMobile ? "1rem" : "1.5rem",
                border: `1px solid ${T.border}`,
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: 3 }}>
                  Gasto por Tarjeta
                </div>
                <div style={{ fontSize: 12, color: T.muted2 }}>
                  Solo CRC · {selectedCycle === "all" ? "Todos los ciclos" : selectedCycle}
                </div>
              </div>

              {spendByCard.length ? (
                <ResponsiveContainer width="100%" height={isMobile ? 240 : 220}>
                  <BarChart data={spendByCard}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="tarjeta" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: T.muted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₡${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Gastos" radius={[8, 8, 0, 0]} fill={T.sapphire} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Sin gastos por tarjeta"
                  subtitle="Cuando existan movimientos CRC asociados a tarjetas, aquí se verán agrupados."
                />
              )}
            </div>
          </div>
        )}

        {/* MOVIMIENTOS */}
        {tab === "transactions" && (
          <div
            style={{
              background: T.card,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              overflow: "hidden",
            }}
          >
            <SectionHeader
              title="Movimientos"
              subtitle={`${visibleTxns.length} movimientos · ${currentSelectionLabel}`}
              isMobile={isMobile}
              action={<SecondaryButton onClick={openMovementModal}>＋ Agregar movimiento</SecondaryButton>}
            />

            {visibleTxns.length === 0 ? (
              <div style={{ padding: isMobile ? "1rem" : "1.5rem" }}>
                <EmptyState
                  title="No hay movimientos en esta selección"
                  subtitle="Registrá uno manual o cambiá el filtro de ciclo/tarjeta."
                  action={<SecondaryButton onClick={openMovementModal}>＋ Agregar movimiento</SecondaryButton>}
                />
              </div>
            ) : isMobile ? (
              <div style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {visibleTxns.map((t, i) => {
                  const typeMeta = getTypeMeta(t.tipo);
                  const category = t.tipo === "gasto" ? getCategory(t.comercio) : null;
                  const card = findCardByAnyValue(t.tarjeta, tarjetasData);

                  return (
                    <div
                      key={i}
                      style={{
                        background: T.card2,
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        padding: "0.9rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          marginBottom: "0.55rem",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              color: T.text,
                              fontWeight: 600,
                              lineHeight: 1.35,
                              marginBottom: 4,
                            }}
                          >
                            {t.comercio}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted2, fontFamily: "'DM Mono',monospace" }}>
                            {t.fecha}
                            {t.hora ? ` · ${t.hora}` : ""}
                          </div>
                        </div>

                        <div
                          style={{
                            fontFamily: "'DM Mono',monospace",
                            fontSize: 13,
                            fontWeight: 700,
                            color: typeMeta.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: typeMeta.bg,
                            border: `1px solid ${typeMeta.color}30`,
                            color: typeMeta.color,
                            borderRadius: 20,
                            padding: "0.24rem 0.55rem",
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {typeMeta.label}
                        </span>

                        {category && (
                          <span
                            style={{
                              background: `${category.color}15`,
                              border: `1px solid ${category.color}30`,
                              color: category.color,
                              borderRadius: 20,
                              padding: "0.24rem 0.55rem",
                              fontSize: 11,
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {category.cat}
                          </span>
                        )}

                        <span
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${T.border}`,
                            color: T.muted2,
                            borderRadius: 20,
                            padding: "0.24rem 0.55rem",
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {card ? getTarjetaDisplay(card) : t.tarjeta || "Sin tarjeta"}
                        </span>

                        <span
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${T.border}`,
                            color: T.muted2,
                            borderRadius: 20,
                            padding: "0.24rem 0.55rem",
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          Corte {t.corte || "—"}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: "0.55rem",
                          fontSize: 11,
                          color: T.muted2,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {t.ciclo || "Sin ciclo"}
                      </div>

                      {t.notas && (
                        <div style={{ marginTop: "0.55rem", fontSize: 12, color: T.muted2 }}>
                          {t.notas}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["Fecha", "Comercio", "Tarjeta", "Corte", "Tipo", "Categoría", "Moneda", "Monto", "Ciclo"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "0.75rem 1rem",
                            textAlign: h === "Monto" ? "right" : "left",
                            fontSize: 11,
                            color: T.muted,
                            fontFamily: "'DM Mono',monospace",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            fontWeight: 500,
                            borderBottom: `1px solid ${T.border}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {visibleTxns.map((t, i) => {
                      const category = t.tipo === "gasto" ? getCategory(t.comercio) : null;
                      const typeMeta = getTypeMeta(t.tipo);
                      const card = findCardByAnyValue(t.tarjeta, tarjetasData);

                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 12,
                              color: T.muted2,
                              fontFamily: "'DM Mono',monospace",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.fecha}
                            {t.hora ? ` · ${t.hora}` : ""}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 13,
                              color: T.text,
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.comercio}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 12,
                              color: T.muted2,
                              fontFamily: "'DM Mono',monospace",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {card ? getTarjetaDisplay(card) : t.tarjeta || "—"}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 12,
                              color: T.muted2,
                              fontFamily: "'DM Mono',monospace",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.corte || "—"}
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span
                              style={{
                                background: typeMeta.bg,
                                border: `1px solid ${typeMeta.color}30`,
                                color: typeMeta.color,
                                borderRadius: 6,
                                padding: "0.2rem 0.6rem",
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {typeMeta.label}
                            </span>
                          </td>

                          <td style={{ padding: "0.85rem 1rem" }}>
                            {category ? (
                              <span
                                style={{
                                  background: `${category.color}15`,
                                  border: `1px solid ${category.color}30`,
                                  color: category.color,
                                  borderRadius: 6,
                                  padding: "0.2rem 0.6rem",
                                  fontSize: 11,
                                  fontFamily: "'DM Mono',monospace",
                                }}
                              >
                                {category.cat}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: T.muted2 }}>—</span>
                            )}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 12,
                              color: T.muted2,
                              fontFamily: "'DM Mono',monospace",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.moneda}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              textAlign: "right",
                              fontSize: 13,
                              fontFamily: "'DM Mono',monospace",
                              fontWeight: 600,
                              color: typeMeta.color,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)}
                          </td>

                          <td
                            style={{
                              padding: "0.85rem 1rem",
                              fontSize: 11,
                              color: T.muted2,
                              fontFamily: "'DM Mono',monospace",
                              whiteSpace: "nowrap",
                              maxWidth: 260,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={t.ciclo}
                          >
                            {t.ciclo || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TARJETAS */}
        {tab === "cards" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: "1rem",
              }}
            >
              <StatCard
                label="Tarjetas activas"
                value={String(tarjetasData.filter((t) => t.activa).length)}
                sub={`${tarjetasData.length} registradas`}
                color={T.violet}
                icon="◌"
              />
              <StatCard
                label="Gasto CRC filtrado"
                value={fmtCRC(totalGastosCRC)}
                sub={selectedCard === "all" ? "Todas las tarjetas" : `Tarjeta ${selectedCard}`}
                color={T.rose}
                icon="₡"
              />
              <StatCard
                label="Gasto USD filtrado"
                value={fmtUSD(totalGastosUSD)}
                sub={selectedCycle === "all" ? "Todos los ciclos" : selectedCycle}
                color={T.sapphire}
                icon="$"
              />
            </div>

            {tarjetasData.length ? (
              <div
                style={{
                  background: T.card,
                  borderRadius: 16,
                  border: `1px solid ${T.border}`,
                  overflow: "hidden",
                }}
              >
                <SectionHeader
                  title="Tarjetas"
                  subtitle={`${tarjetasData.length} tarjetas`}
                  isMobile={isMobile}
                  action={<SecondaryButton onClick={openCardModal}>＋ Agregar tarjeta</SecondaryButton>}
                />

                <div style={{ padding: isMobile ? "0.85rem" : "1rem 1.25rem", display: "grid", gap: "0.85rem" }}>
                  {tarjetasData.map((card, i) => {
                    const last4 = normalizeLast4(card.tarjeta);
                    const cardTxns = txns.filter((t) => normalizeLast4(t.tarjeta) === last4);
                    const cardVisible = visibleTxns.filter((t) => normalizeLast4(t.tarjeta) === last4);
                    const crc = cardVisible.filter((t) => t.tipo === "gasto" && t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
                    const usd = cardVisible.filter((t) => t.tipo === "gasto" && t.moneda === "USD").reduce((a, t) => a + t.monto, 0);
                    const lastTxn = cardTxns[0];

                    return (
                      <div
                        key={i}
                        style={{
                          background: T.card2,
                          border: `1px solid ${T.border}`,
                          borderRadius: 14,
                          padding: isMobile ? "0.95rem" : "1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem",
                            flexDirection: isMobile ? "column" : "row",
                            marginBottom: "0.8rem",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                              {getTarjetaDisplay(card)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: T.muted,
                                fontFamily: "'DM Mono',monospace",
                                marginTop: 3,
                              }}
                            >
                              Corte {card.corte}
                              {card.pago ? ` · Pago ${card.pago}` : ""}
                              {card.activa ? " · Activa" : " · Inactiva"}
                            </div>
                          </div>

                          <div style={{ textAlign: isMobile ? "left" : "right" }}>
                            <div
                              style={{
                                fontSize: 13,
                                color: T.rose,
                                fontFamily: "'DM Mono',monospace",
                                fontWeight: 700,
                              }}
                            >
                              {fmtCRC(crc)}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: T.sapphire,
                                fontFamily: "'DM Mono',monospace",
                                marginTop: 2,
                              }}
                            >
                              {fmtUSD(usd)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                          <span
                            style={{
                              background: T.violet + "15",
                              border: `1px solid ${T.violet}30`,
                              color: T.violet,
                              borderRadius: 20,
                              padding: "0.24rem 0.55rem",
                              fontSize: 11,
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {selectedCycle === "all" ? "Todos los ciclos" : selectedCycle}
                          </span>

                          <span
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: `1px solid ${T.border}`,
                              color: T.muted2,
                              borderRadius: 20,
                              padding: "0.24rem 0.55rem",
                              fontSize: 11,
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {cardTxns.length} movimientos
                          </span>

                          {lastTxn && (
                            <span
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: `1px solid ${T.border}`,
                                color: T.muted2,
                                borderRadius: 20,
                                padding: "0.24rem 0.55rem",
                                fontSize: 11,
                                fontFamily: "'DM Mono',monospace",
                              }}
                            >
                              Último: {lastTxn.fecha}
                            </span>
                          )}
                        </div>

                        {card.notas && (
                          <div style={{ marginTop: 10, fontSize: 12, color: T.muted2 }}>{card.notas}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No hay tarjetas cargadas"
                subtitle="Agregá una tarjeta para manejar corte por tarjeta y filtros más finos."
                action={<SecondaryButton onClick={openCardModal}>＋ Agregar tarjeta</SecondaryButton>}
              />
            )}
          </div>
        )}

        {/* AHORROS */}
        {tab === "savings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "1rem",
              }}
            >
              <StatCard
                label="Total Ahorros CRC"
                value={fmtCRC(totalAhorrosCRC)}
                sub={`${ahorros.filter((a) => a.moneda === "CRC").length} cuentas`}
                color={T.emerald}
                icon="₡"
              />
              <StatCard
                label="Total Ahorros USD"
                value={fmtUSD(totalAhorrosUSD)}
                sub={`${ahorros.filter((a) => a.moneda === "USD").length} cuentas`}
                color={T.sapphire}
                icon="$"
              />
            </div>

            {ahorros.length ? (
              <div
                style={{
                  background: T.card,
                  borderRadius: 16,
                  border: `1px solid ${T.border}`,
                  overflow: "hidden",
                }}
              >
                <SectionHeader
                  title="Saldo por Cuenta"
                  subtitle={`${ahorros.length} cuentas cargadas`}
                  isMobile={isMobile}
                  action={<SecondaryButton onClick={openAccountModal}>＋ Agregar cuenta</SecondaryButton>}
                />

                {ahorros.map((a, i) => {
                  const totalBase = a.moneda === "CRC" ? totalAhorrosCRC : totalAhorrosUSD;
                  const pct = totalBase > 0 ? Math.round((a.saldo / totalBase) * 100) : 0;

                  return (
                    <div
                      key={i}
                      style={{
                        padding: isMobile ? "1rem" : "1rem 1.5rem",
                        borderBottom: i < ahorros.length - 1 ? `1px solid ${T.border}` : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                          marginBottom: 8,
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{a.cuenta}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: T.muted,
                              fontFamily: "'DM Mono',monospace",
                              marginTop: 2,
                            }}
                          >
                            {a.moneda}
                          </div>
                        </div>

                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontFamily: "'DM Mono',monospace",
                              fontWeight: 600,
                              color: a.moneda === "CRC" ? T.emerald : T.sapphire,
                            }}
                          >
                            {a.moneda === "CRC" ? fmtCRC(a.saldo) : fmtUSD(a.saldo)}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{pct}% del total</div>
                        </div>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 4 }}>
                        <div
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: "100%",
                            background: a.moneda === "CRC" ? T.emerald : T.sapphire,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No hay cuentas cargadas"
                subtitle="Agregá una cuenta desde aquí y se guardará en la pestaña Cuentas de tu Google Sheet."
                action={<SecondaryButton onClick={openAccountModal}>＋ Agregar cuenta</SecondaryButton>}
              />
            )}
          </div>
        )}

        {/* DEUDAS */}
        {tab === "debts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "1rem",
              }}
            >
              <StatCard
                label="Deuda Total CRC"
                value={fmtCRC(totalDeudaCRC)}
                sub={`Cuota mensual ${fmtCRC(totalCuotasCRC)}`}
                color={T.rose}
                icon="₡"
              />
              <StatCard
                label="Deuda Total USD"
                value={fmtUSD(totalDeudaUSD)}
                sub={`Cuota mensual ${fmtUSD(totalCuotasUSD)}`}
                color={T.amber}
                icon="$"
              />
            </div>

            {deudas.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <SecondaryButton onClick={openDebtModal}>＋ Agregar deuda</SecondaryButton>
                </div>

                {deudas.map((d, i) => {
                  const totalBase = d.moneda === "CRC" ? totalDeudaCRC : totalDeudaUSD;
                  const progPct = totalBase > 0 ? Math.round((d.saldo / totalBase) * 100) : 0;

                  return (
                    <div
                      key={i}
                      style={{
                        background: T.card,
                        borderRadius: 16,
                        padding: isMobile ? "1rem" : "1.25rem 1.5rem",
                        border: `1px solid ${T.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "0.85rem",
                          gap: "1rem",
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{d.nombre}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: T.muted,
                              fontFamily: "'DM Mono',monospace",
                              marginTop: 3,
                            }}
                          >
                            {d.entidad} · {d.tasa}% · {d.meses} meses restantes
                          </div>
                        </div>

                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontFamily: "'DM Mono',monospace",
                              fontWeight: 700,
                              color: d.tasa === 0 ? T.emerald : T.rose,
                            }}
                          >
                            {d.moneda === "CRC" ? fmtCRC(d.saldo) : fmtUSD(d.saldo)}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted2, marginTop: 2 }}>
                            Cuota: {d.moneda === "CRC" ? fmtCRC(d.cuota) : fmtUSD(d.cuota)}/mes
                          </div>
                        </div>
                      </div>

                      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5 }}>
                        <div
                          style={{
                            width: `${Math.min(progPct, 100)}%`,
                            height: "100%",
                            background: d.tasa === 0 ? T.emerald : T.rose,
                            borderRadius: 4,
                          }}
                        />
                      </div>

                      {d.tasa === 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: T.emerald,
                            marginTop: 6,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          ✓ TASA 0%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No hay deudas cargadas"
                subtitle="Agregá una deuda desde aquí y se guardará en la pestaña Préstamos de tu Google Sheet."
                action={<SecondaryButton onClick={openDebtModal}>＋ Agregar deuda</SecondaryButton>}
              />
            )}
          </div>
        )}
      </div>

      {/* FAB + ACTION MENU */}
      {!isDemo && (
        <div
          ref={actionMenuRef}
          style={{
            position: "fixed",
            bottom: isMobile ? "1rem" : "2rem",
            right: isMobile ? "1rem" : "2rem",
            zIndex: 120,
          }}
        >
          {showActionMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: isMobile ? 62 : 66,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: "0.45rem",
                minWidth: isMobile ? 190 : 220,
                boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              }}
            >
              <button onClick={openMovementModal} style={fabMenuButtonStyle}>
                💸 Agregar movimiento
              </button>
              <button onClick={openCardModal} style={fabMenuButtonStyle}>
                ◌ Agregar tarjeta
              </button>
              <button onClick={openAccountModal} style={fabMenuButtonStyle}>
                ◉ Agregar cuenta
              </button>
              <button onClick={openDebtModal} style={fabMenuButtonStyle}>
                ◫ Agregar deuda
              </button>
            </div>
          )}

          <button
            onClick={() => setShowActionMenu((v) => !v)}
            style={{
              width: isMobile ? 52 : 56,
              height: isMobile ? 52 : 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${T.emerald}, ${T.sapphire})`,
              border: "none",
              color: "#fff",
              fontSize: 26,
              cursor: "pointer",
              boxShadow: `0 4px 24px ${T.emerald}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Agregar"
          >
            +
          </button>
        </div>
      )}

      {/* MOVEMENT MODAL */}
      {showMovementModal && (
        <div
          style={modalBackdropStyle}
          onClick={(e) => e.target === e.currentTarget && setShowMovementModal(false)}
        >
          <div style={modalCardStyle(isMobile)}>
            <div style={modalTitleStyle}>Registrar Movimiento</div>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              {[
                ["gasto", "💸 Gasto"],
                ["ingreso", "💰 Ingreso"],
                ["pago_deuda", "🏦 Pago deuda"],
              ].map(([type, label]) => {
                const active = movementType === type;
                const typeMeta = getTypeMeta(type);

                return (
                  <button
                    key={type}
                    onClick={() => setMovementType(type)}
                    style={{
                      flex: isMobile ? "1 1 100%" : 1,
                      padding: "0.6rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      background: active ? typeMeta.bg : "transparent",
                      border: `1px solid ${active ? `${typeMeta.color}50` : T.border}`,
                      color: active ? typeMeta.color : T.muted2,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Comercio / Descripción</label>
              <input
                type="text"
                value={movementForm.comercio}
                onChange={(e) => setMovementForm((f) => ({ ...f, comercio: e.target.value }))}
                placeholder="Ej: Super Buena Suerte"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Monto</label>
              <input
                type="number"
                value={movementForm.monto}
                onChange={(e) => setMovementForm((f) => ({ ...f, monto: e.target.value }))}
                placeholder="Ej: 5000"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Tarjeta (últimos 4 o nombre)</label>
              <input
                list="financeai-card-options"
                value={movementForm.tarjeta}
                onChange={(e) => setMovementForm((f) => ({ ...f, tarjeta: e.target.value }))}
                placeholder="Ej: 4006"
                style={fieldInputStyle}
              />
              <datalist id="financeai-card-options">
                {tarjetasData.map((card) => (
                  <option key={card.tarjeta} value={getTarjetaDisplay(card)} />
                ))}
              </datalist>
            </div>

            <div
              style={{
                background: T.card2,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              <div style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>
                PREVIEW
              </div>
              <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>
                Tarjeta: <span style={{ color: T.emerald }}>{movementPreview.cardLabel}</span>
              </div>
              <div style={{ fontSize: 12, color: T.text, marginBottom: 4 }}>
                Corte: <span style={{ color: T.amber }}>{movementPreview.cut}</span>
              </div>
              <div style={{ fontSize: 12, color: T.text }}>
                Ciclo: <span style={{ color: T.sapphire }}>{movementPreview.cycle}</span>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Notas (opcional)</label>
              <input
                type="text"
                value={movementForm.notas}
                onChange={(e) => setMovementForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Detalle adicional"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={fieldLabelStyle}>Moneda</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["CRC", "USD"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMovementForm((f) => ({ ...f, moneda: m }))}
                    style={{
                      padding: "0.55rem 1.25rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      background: movementForm.moneda === m ? T.emeraldDim : "transparent",
                      border: `1px solid ${movementForm.moneda === m ? `${T.emerald}50` : T.border}`,
                      color: movementForm.moneda === m ? T.emerald : T.muted2,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexDirection: isMobile ? "column" : "row" }}>
              <button onClick={() => setShowMovementModal(false)} style={cancelButtonStyle}>
                Cancelar
              </button>
              <button
                onClick={handleRegistrarMovimiento}
                disabled={!movementForm.comercio || !movementForm.monto}
                style={primaryButtonStyle(!!movementForm.comercio && !!movementForm.monto)}
              >
                Registrar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD MODAL */}
      {showCardModal && (
        <div
          style={modalBackdropStyle}
          onClick={(e) => e.target === e.currentTarget && setShowCardModal(false)}
        >
          <div style={modalCardStyle(isMobile)}>
            <div style={modalTitleStyle}>Agregar Tarjeta</div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Últimos 4 dígitos</label>
              <input
                type="text"
                value={cardForm.tarjeta}
                onChange={(e) => setCardForm((f) => ({ ...f, tarjeta: e.target.value.replace(/\D/g, "").slice(-4) }))}
                placeholder="Ej: 4006"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Nombre</label>
              <input
                type="text"
                value={cardForm.nombre}
                onChange={(e) => setCardForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: DAVI Principal"
                style={fieldInputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: "0.85rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <label style={fieldLabelStyle}>Día de corte</label>
                <input
                  type="number"
                  value={cardForm.corte}
                  onChange={(e) => setCardForm((f) => ({ ...f, corte: e.target.value }))}
                  placeholder="Ej: 26"
                  style={fieldInputStyle}
                />
              </div>

              <div>
                <label style={fieldLabelStyle}>Día de pago</label>
                <input
                  type="number"
                  value={cardForm.pago}
                  onChange={(e) => setCardForm((f) => ({ ...f, pago: e.target.value }))}
                  placeholder="Ej: 17"
                  style={fieldInputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={fieldLabelStyle}>Notas (opcional)</label>
              <input
                type="text"
                value={cardForm.notas}
                onChange={(e) => setCardForm((f) => ({ ...f, notas: e.target.value }))}
                placeholder="Detalle adicional"
                style={fieldInputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexDirection: isMobile ? "column" : "row" }}>
              <button onClick={() => setShowCardModal(false)} style={cancelButtonStyle}>
                Cancelar
              </button>
              <button
                onClick={handleRegistrarTarjeta}
                disabled={!cardForm.tarjeta || !cardForm.nombre || !cardForm.corte}
                style={primaryButtonStyle(!!cardForm.tarjeta && !!cardForm.nombre && !!cardForm.corte)}
              >
                Guardar tarjeta →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT MODAL */}
      {showAccountModal && (
        <div
          style={modalBackdropStyle}
          onClick={(e) => e.target === e.currentTarget && setShowAccountModal(false)}
        >
          <div style={modalCardStyle(isMobile)}>
            <div style={modalTitleStyle}>Agregar Cuenta</div>

            {[
              { key: "nombre", label: "Nombre de la Cuenta", placeholder: "Ej: Davivienda Colones" },
              { key: "saldoInicial", label: "Saldo Inicial", placeholder: "Ej: 150000", type: "number" },
              { key: "notas", label: "Notas (opcional)", placeholder: "Detalle adicional" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: "1rem" }}>
                <label style={fieldLabelStyle}>{label}</label>
                <input
                  type={type || "text"}
                  value={accountForm[key]}
                  onChange={(e) => setAccountForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={fieldInputStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={fieldLabelStyle}>Moneda</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["CRC", "USD"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setAccountForm((f) => ({ ...f, moneda: m }))}
                    style={{
                      padding: "0.55rem 1.25rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      background: accountForm.moneda === m ? T.emeraldDim : "transparent",
                      border: `1px solid ${accountForm.moneda === m ? `${T.emerald}50` : T.border}`,
                      color: accountForm.moneda === m ? T.emerald : T.muted2,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexDirection: isMobile ? "column" : "row" }}>
              <button onClick={() => setShowAccountModal(false)} style={cancelButtonStyle}>
                Cancelar
              </button>
              <button
                onClick={handleRegistrarCuenta}
                disabled={!accountForm.nombre || !accountForm.saldoInicial}
                style={primaryButtonStyle(!!accountForm.nombre && !!accountForm.saldoInicial)}
              >
                Guardar cuenta →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEBT MODAL */}
      {showDebtModal && (
        <div
          style={modalBackdropStyle}
          onClick={(e) => e.target === e.currentTarget && setShowDebtModal(false)}
        >
          <div style={modalCardStyle(isMobile)}>
            <div style={modalTitleStyle}>Agregar Deuda / Préstamo</div>

            {[
              { key: "nombre", label: "Nombre", placeholder: "Ej: Préstamo Carro" },
              { key: "entidad", label: "Entidad", placeholder: "Ej: DaviBank" },
              { key: "montoOriginal", label: "Monto Original", placeholder: "Ej: 5000000", type: "number" },
              { key: "saldoActual", label: "Saldo Actual", placeholder: "Ej: 4200000", type: "number" },
              { key: "cuotaMensual", label: "Cuota Mensual", placeholder: "Ej: 120000", type: "number" },
              { key: "tasa", label: "Tasa Interés (%)", placeholder: "Ej: 8.5", type: "number" },
              { key: "plazoRestante", label: "Plazo Restante (meses)", placeholder: "Ej: 36", type: "number" },
              { key: "notas", label: "Notas (opcional)", placeholder: "Detalle adicional" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: "1rem" }}>
                <label style={fieldLabelStyle}>{label}</label>
                <input
                  type={type || "text"}
                  value={debtForm[key]}
                  onChange={(e) => setDebtForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={fieldInputStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={fieldLabelStyle}>Moneda</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {["CRC", "USD"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDebtForm((f) => ({ ...f, moneda: m }))}
                    style={{
                      padding: "0.55rem 1.25rem",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      background: debtForm.moneda === m ? T.emeraldDim : "transparent",
                      border: `1px solid ${debtForm.moneda === m ? `${T.emerald}50` : T.border}`,
                      color: debtForm.moneda === m ? T.emerald : T.muted2,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexDirection: isMobile ? "column" : "row" }}>
              <button onClick={() => setShowDebtModal(false)} style={cancelButtonStyle}>
                Cancelar
              </button>
              <button
                onClick={handleRegistrarDeuda}
                disabled={!debtForm.nombre || !debtForm.saldoActual}
                style={primaryButtonStyle(!!debtForm.nombre && !!debtForm.saldoActual)}
              >
                Guardar deuda →
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 4px; }
        input::placeholder { color: #5b647a; }
        select, input { appearance: none; }
        body { margin: 0; background: ${T.bg}; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
};

const modalCardStyle = (isMobile) => ({
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 20,
  padding: isMobile ? "1rem" : "1.5rem",
  width: "100%",
  maxWidth: 470,
  maxHeight: "90vh",
  overflowY: "auto",
});

const modalTitleStyle = {
  fontFamily: "'Syne',sans-serif",
  fontWeight: 700,
  fontSize: "1.08rem",
  marginBottom: "1rem",
};

const fieldLabelStyle = {
  fontSize: 11,
  color: T.muted,
  fontFamily: "'DM Mono',monospace",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

const fieldInputStyle = {
  width: "100%",
  background: T.card2,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: "0.75rem 0.95rem",
  color: T.text,
  fontSize: 13.5,
  outline: "none",
  fontFamily: "'DM Sans',sans-serif",
  boxSizing: "border-box",
};

const cancelButtonStyle = {
  flex: 1,
  padding: "0.8rem",
  borderRadius: 12,
  background: "transparent",
  border: `1px solid ${T.border}`,
  color: T.muted2,
  cursor: "pointer",
  fontSize: 13,
};

const primaryButtonStyle = (enabled) => ({
  flex: 1.4,
  padding: "0.8rem",
  borderRadius: 12,
  cursor: enabled ? "pointer" : "default",
  fontSize: 13,
  fontWeight: 600,
  background: enabled ? `linear-gradient(135deg, ${T.emerald}30, ${T.sapphire}30)` : "transparent",
  border: `1px solid ${enabled ? `${T.emerald}50` : T.border}`,
  color: enabled ? T.emerald : T.muted,
});

const fabMenuButtonStyle = {
  width: "100%",
  textAlign: "left",
  padding: "0.75rem 0.85rem",
  borderRadius: 10,
  background: "transparent",
  border: "none",
  color: T.text,
  cursor: "pointer",
  fontSize: 13,
};