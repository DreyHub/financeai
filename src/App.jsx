import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─────────────────────────────────────────────────────────────
// CONFIGURATION — Replace with your real values
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  CLIENT_ID: "219304870557-pvhr9m5njhn7fgat8r9u6q4hl0sl3m7n.apps.googleusercontent.com",
  SHEET_NAME: "FinanceAI",  // Nombre del Sheet que se buscará o creará en Drive

  TABS: {
    transacciones: "Transacciones",
    cuentas: "Cuentas",
    prestamos: "Préstamos",
    config: "Config",
  },

  COLS: {
    fecha: 0, hora: 1, comercio: 2, tarjeta: 3, moneda: 4, monto: 5, ciclo: 6,
  },

  // Scopes necesarios: leer+escribir Sheets + buscar en Drive
  SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ].join(" "),
};

// Headers de cada tab — estructura canónica
const SHEET_HEADERS = {
  Transacciones: [["Fecha","Hora","Comercio","Tarjeta","Moneda","Monto","Ciclo","Importado","Tipo","Notas"]],
  Cuentas:       [["ID","Nombre de la Cuenta","Moneda","Saldo Inicial","Notas"]],
  "Préstamos":   [["ID","Nombre","Entidad","Moneda","Monto Original","Saldo Actual","Cuota Mensual","Tasa Interés (%)","Plazo Restante (meses)","Notas"]],
  Config:        [["Clave","Valor"]],
};

// ─────────────────────────────────────────────────────────────
// GOOGLE SHEETS & DRIVE API HELPERS
// ─────────────────────────────────────────────────────────────
async function gFetch(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

// Busca el Sheet en Drive, retorna su ID o null
async function findSheet(token) {
  const q = encodeURIComponent(`name='${CONFIG.SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const data = await gFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, token);
  return data.files?.[0]?.id || null;
}

// Crea el Sheet con todas las tabs y headers
async function createSheet(token) {
  const body = {
    properties: { title: CONFIG.SHEET_NAME },
    sheets: Object.keys(SHEET_HEADERS).map((name, i) => ({
      properties: { sheetId: i, title: name, index: i },
    })),
  };
  const sheet = await gFetch("https://sheets.googleapis.com/v4/spreadsheets", token, {
    method: "POST", body: JSON.stringify(body),
  });

  // Insertar headers en cada tab
  await Promise.all(Object.entries(SHEET_HEADERS).map(([tab, headers]) =>
    gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW`, token, {
      method: "POST", body: JSON.stringify({ values: headers }),
    })
  ));

  // Guardar config inicial
  await appendRow(sheet.spreadsheetId, "Config", ["ciclo_inicio_dia", "17"], token);

  return sheet.spreadsheetId;
}

// Lee datos de un tab
async function fetchSheetData(sheetId, tab, token) {
  const data = await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}`, token);
  return data.values || [];
}

// Agrega una fila a un tab
async function appendRow(sheetId, tab, row, token) {
  return gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    { method: "POST", body: JSON.stringify({ values: [row] }) }
  );
}

// Parse colones string "₡3.850,00" or "29976310,63" or "3850" → number
function parseMonto(raw) {
  if (!raw) return 0;
  // Remove currency symbols and spaces
  let clean = String(raw).replace(/[₡$\s]/g, "").trim();
  // Handle CR format: periods as thousands separator, comma as decimal
  // e.g. "29.976.310,63" or "29976310,63" or "3.850,00"
  if (clean.includes(",")) {
    // Remove all dots (thousands), replace comma with dot (decimal)
    clean = clean.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(clean) || 0;
}

// Get active cycle based on today (cycles close on day 17)
function getActiveCycle() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // If today is before the 17th, cycle started on 17th of previous month
  // If today is on or after 17th, cycle started on 17th of this month
  let startMonth, startYear, endMonth, endYear;
  if (day < 17) {
    startMonth = month === 0 ? 11 : month - 1;
    startYear = month === 0 ? year - 1 : year;
    endMonth = month;
    endYear = year;
  } else {
    startMonth = month;
    startYear = year;
    endMonth = month === 11 ? 0 : month + 1;
    endYear = month === 11 ? year + 1 : year;
  }

  const pad = (n) => String(n).padStart(2, "0");
  const startStr = `${pad(startYear % 100)}`; // e.g. "26"
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  // Cycle label format: "Feb26-Mar26"
  const cycleLabel = `${monthNames[startMonth]}${startYear % 100}-${monthNames[endMonth]}${endYear % 100}`;
  return cycleLabel;
}

const ACTIVE_CYCLE = getActiveCycle();

function parseTransacciones(rows) {
  // Skip header row(s) — find first row where col 0 looks like a date
  const data = rows.filter(r => r[CONFIG.COLS.fecha] && /\d{1,2}\/\d{1,2}\/\d{4}/.test(r[CONFIG.COLS.fecha]));
  const all = data.map(r => ({
    fecha: (r[CONFIG.COLS.fecha] || "").split(" ")[0], // only date part
    hora: r[CONFIG.COLS.hora] || "",
    comercio: r[CONFIG.COLS.comercio] || "",
    tarjeta: r[CONFIG.COLS.tarjeta] || "",
    moneda: r[CONFIG.COLS.moneda] || "CRC",
    monto: parseMonto(r[CONFIG.COLS.monto]),
    ciclo: r[CONFIG.COLS.ciclo] || "",
  }));
  // Filter to active cycle only
  const filtered = all.filter(t => t.ciclo === ACTIVE_CYCLE);
  const result = filtered.length > 0 ? filtered : all;
  // Sort by date+time descending (most recent first)
  return result.sort((a, b) => {
    const parseDate = (fecha, hora) => {
      const [d, m, y] = fecha.split("/").map(Number);
      // hora format: "18:00" or "18:00:00" or "04:09 PM"
      let h = 0, min = 0;
      if (hora) {
        const isPM = hora.includes("PM");
        const isAM = hora.includes("AM");
        const timePart = hora.replace(/AM|PM/g, "").trim();
        const [hh, mm] = timePart.split(":").map(Number);
        h = hh;
        min = mm || 0;
        if (isPM && h !== 12) h += 12;
        if (isAM && h === 12) h = 0;
      }
      return new Date(y, m - 1, d, h, min).getTime();
    };
    return parseDate(b.fecha, b.hora) - parseDate(a.fecha, a.hora);
  });
}

// ─────────────────────────────────────────────────────────────
// COLORS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
  bg: "#08090F",
  surface: "#0E1118",
  card: "#131720",
  card2: "#181F2E",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  emerald: "#00D4A0",
  emeraldDim: "rgba(0,212,160,0.1)",
  emeraldGlow: "rgba(0,212,160,0.2)",
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
// CATEGORY AUTO-DETECTION
// ─────────────────────────────────────────────────────────────
const CATEGORY_RULES = [
  { keywords: ["SUPER","LICORERA","MAXI","FRESH","WALMART","PRICEMART","PRICE SMART"], cat: "Supermercado", color: T.emerald },
  { keywords: ["RESTAURANTE","BURGER","KFC","PIZZA","SODA","TACO","PAPA JOHN","POLLO"], cat: "Comidas", color: T.sapphire },
  { keywords: ["UBER","PARKING","AUTOPIST","GASOLINA","ESTACION","AUTO"], cat: "Transporte", color: T.amber },
  { keywords: ["AMAZON","PAYPAL","OPENAI","NETFLIX","SPOTIFY","GOOGLE","APPLE","KOLBI","CLARO"], cat: "Digital/Subs", color: T.violet },
  { keywords: ["FARMACIA","CLINICA","MEDIC","HOSPITAL","DENTAL"], cat: "Salud", color: "#34D399" },
  { keywords: ["BARBER","SALON","SPA"], cat: "Personal", color: "#F472B6" },
  { keywords: ["SEGURO","INS"], cat: "Seguros", color: "#60A5FA" },
];

function getCategory(comercio) {
  const upper = comercio.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(k => upper.includes(k))) return rule;
  }
  return { cat: "Otros", color: T.muted2 };
}

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmtCRC = (n) => `₡${Math.round(n).toLocaleString("es-CR").replace(/\s/g, ".")}`;
const fmtUSD = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, delay = 0 }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), delay); }, []);
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: "1.1rem 1.1rem", transition: "all 0.3s", minWidth: 0, overflow: "hidden",
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(12px)",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + "40"; e.currentTarget.style.boxShadow = `0 0 24px ${color}12`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: T.muted, fontFamily: "'DM Mono',monospace" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color + "15", border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{icon}</div>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "clamp(0.95rem, 2vw, 1.35rem)", fontWeight: 600, color, lineHeight: 1.2, marginBottom: "0.4rem", wordBreak: "break-all", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted2 }}>{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.75rem 1rem", fontSize: 12 }}>
      <div style={{ color: T.muted2, marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmtCRC(p.value)}</div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DEMO DATA (shown before Google login)
// ─────────────────────────────────────────────────────────────
const DEMO = {
  transacciones: [
    { fecha:"11/03/2026", comercio:"CI BAYER HEREDIA", moneda:"CRC", monto:3850, ciclo:"Feb26-Mar26" },
    { fecha:"11/03/2026", comercio:"SUPER BUENA SUERTE", moneda:"CRC", monto:1675, ciclo:"Feb26-Mar26" },
    { fecha:"09/03/2026", comercio:"DLC*DIDI San Jose", moneda:"CRC", monto:550, ciclo:"Feb26-Mar26" },
    { fecha:"09/03/2026", comercio:"MINI SUPER LAS DELI", moneda:"CRC", monto:4200, ciclo:"Feb26-Mar26" },
    { fecha:"09/03/2026", comercio:"PRICE SMART ALAJUELA", moneda:"CRC", monto:88328, ciclo:"Feb26-Mar26" },
    { fecha:"09/03/2026", comercio:"ESTACION DE SERVICIO", moneda:"CRC", monto:21624, ciclo:"Feb26-Mar26" },
    { fecha:"09/03/2026", comercio:"Spotify", moneda:"USD", monto:6.99, ciclo:"Feb26-Mar26" },
    { fecha:"08/03/2026", comercio:"MI CLARO EXPRESS", moneda:"CRC", monto:11373, ciclo:"Feb26-Mar26" },
    { fecha:"08/03/2026", comercio:"APP KOLBI ICE", moneda:"CRC", monto:30505, ciclo:"Feb26-Mar26" },
    { fecha:"08/03/2026", comercio:"SUPER BUENA SUERTE", moneda:"CRC", monto:4450, ciclo:"Feb26-Mar26" },
    { fecha:"07/03/2026", comercio:"AL TOQUE FAST FOOD", moneda:"CRC", monto:7800, ciclo:"Feb26-Mar26" },
    { fecha:"07/03/2026", comercio:"MAXIPALI NARANJO", moneda:"CRC", monto:37744, ciclo:"Feb26-Mar26" },
    { fecha:"06/03/2026", comercio:"EBA*AMAZON Washington", moneda:"CRC", monto:30081, ciclo:"Feb26-Mar26" },
    { fecha:"06/03/2026", comercio:"RESTAURANTE DON TACO", moneda:"CRC", monto:4600, ciclo:"Feb26-Mar26" },
    { fecha:"04/03/2026", comercio:"IES KAVERNO BARBER", moneda:"CRC", monto:16000, ciclo:"Feb26-Mar26" },
    { fecha:"04/03/2026", comercio:"KFC MULTIPLAZA", moneda:"CRC", monto:6340, ciclo:"Feb26-Mar26" },
    { fecha:"04/03/2026", comercio:"AUTO PARKING SAN JO", moneda:"CRC", monto:1600, ciclo:"Feb26-Mar26" },
    { fecha:"24/02/2026", comercio:"OPENAI SAN FRANCISCO", moneda:"USD", monto:10, ciclo:"Feb26-Mar26" },
    { fecha:"25/02/2026", comercio:"DLC*UBER RIDES", moneda:"CRC", monto:2999, ciclo:"Feb26-Mar26" },
    { fecha:"27/02/2026", comercio:"PAPA JOHNS FT NARANJO", moneda:"CRC", monto:13490, ciclo:"Feb26-Mar26" },
  ],
  ahorros: [
    { cuenta:"Davibank Colones", moneda:"CRC", saldo:853460.44 },
    { cuenta:"Aseibm", moneda:"CRC", saldo:9770779.66 },
    { cuenta:"FCL", moneda:"CRC", saldo:1886964.41 },
    { cuenta:"BNCR Casa", moneda:"CRC", saldo:11158.58 },
    { cuenta:"BNCR Flujo", moneda:"CRC", saldo:3083.70 },
    { cuenta:"BNCR Dolares", moneda:"USD", saldo:2.03 },
  ],
  deudas: [
    { nombre:"Préstamo Carro", entidad:"DAVIbank", moneda:"USD", saldo:24093.36, cuota:669.28, tasa:10.75, meses:55 },
    { nombre:"Préstamo Casa", entidad:"BN", moneda:"CRC", saldo:29976310.63, cuota:227762.40, tasa:8.30, meses:320 },
    { nombre:"Tasa 0 #1", entidad:"DAVIbank", moneda:"CRC", saldo:404057.66, cuota:20202.88, tasa:0, meses:20 },
    { nombre:"Tasa 0 #2", entidad:"DAVIbank", moneda:"CRC", saldo:238673.56, cuota:29834.19, tasa:0, meses:8 },
    { nombre:"Tasa 0 #3", entidad:"DAVIbank", moneda:"USD", saldo:845.17, cuota:42.26, tasa:0, meses:20 },
    { nombre:"ASEIBM CREDITO", entidad:"Aseibm", moneda:"CRC", saldo:155804.75, cuota:53020.65, tasa:8.78, meses:3 },
  ],
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(null);
  const [sheetId, setSheetId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState(""); // message during setup
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [txns, setTxns] = useState(DEMO.transacciones);
  const [ahorrosData, setAhorrosData] = useState(DEMO.ahorros);
  const [deudasData, setDeudasData] = useState(DEMO.deudas);
  const [isDemo, setIsDemo] = useState(true);
  const [gsLoaded, setGsLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("gasto"); // gasto | ingreso | deuda
  const [modalForm, setModalForm] = useState({ comercio: "", monto: "", moneda: "CRC", notas: "" });

  // Load Google Identity Services
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => setGsLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleGoogleLogin = () => {
    if (!gsLoaded || !window.google) return;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp.error) { setError(resp.error); return; }
        const tk = resp.access_token;
        setToken(tk);
        setLoading(true);
        setError(null);
        try {
          // 1. Buscar Sheet existente en Drive
          setSetupStatus("🔍 Buscando tu Sheet de FinanceAI...");
          let sid = await findSheet(tk);

          // 2. Si no existe, crearlo
          if (!sid) {
            setSetupStatus("✨ Creando tu Sheet por primera vez...");
            sid = await createSheet(tk);
            setSetupStatus("✅ Sheet creado exitosamente");
          } else {
            setSetupStatus("✅ Sheet encontrado");
          }
          setSheetId(sid);

          // 3. Cargar datos
          setSetupStatus("📊 Cargando tus datos...");
          const [txnRows, cuentasRows, prestamosRows] = await Promise.all([
            fetchSheetData(sid, CONFIG.TABS.transacciones, tk),
            fetchSheetData(sid, CONFIG.TABS.cuentas, tk),
            fetchSheetData(sid, CONFIG.TABS.prestamos, tk),
          ]);

          const parsed = parseTransacciones(txnRows);
          if (parsed.length > 0) { setTxns(parsed); setIsDemo(false); }

          const cuentasParsed = cuentasRows.slice(1)
            .filter(r => r[1] && r[2] && r[3])
            .map(r => ({ cuenta: r[1], moneda: r[2], saldo: parseMonto(r[3]) }));
          if (cuentasParsed.length > 0) setAhorrosData(cuentasParsed);

          const prestamosParsed = prestamosRows.slice(1)
            .filter(r => r[1] && r[5])
            .map(r => ({
              nombre: r[1], entidad: r[2] || "", moneda: r[3] || "CRC",
              saldo: parseMonto(r[5]), cuota: parseMonto(r[6]),
              tasa: parseFloat(String(r[7]).replace(",", ".")) || 0,
              meses: parseInt(r[8]) || 0,
            }));
          if (prestamosParsed.length > 0) setDeudasData(prestamosParsed);

          setIsDemo(false);
        } catch (e) {
          setError(`Error: ${e.message}`);
          console.error(e);
        }
        setSetupStatus("");
        setLoading(false);
      },
    });
    client.requestAccessToken();
  };

  // ── Registrar movimiento manual ────────────────────────────
  const handleRegistrar = async () => {
    if (!token || !sheetId || !modalForm.monto || !modalForm.comercio) return;
    const now = new Date();
    const fecha = `${now.getDate().toString().padStart(2,"0")}/${(now.getMonth()+1).toString().padStart(2,"0")}/${now.getFullYear()}`;
    const hora = now.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
    const row = [
      fecha, hora, modalForm.comercio, "Manual",
      modalForm.moneda, modalForm.monto, ACTIVE_CYCLE,
      new Date().toISOString(), modalType, modalForm.notas,
    ];
    try {
      await appendRow(sheetId, CONFIG.TABS.transacciones, row, token);
      // Refresh transactions
      const txnRows = await fetchSheetData(sheetId, CONFIG.TABS.transacciones, token);
      const parsed = parseTransacciones(txnRows);
      if (parsed.length > 0) setTxns(parsed);
      setShowModal(false);
      setModalForm({ comercio: "", monto: "", moneda: "CRC", notas: "" });
    } catch(e) {
      setError(`Error al registrar: ${e.message}`);
    }
  };

  // ── Derived data ──────────────────────────────────────────
  const crcTxns = txns.filter(t => t.moneda === "CRC");
  const usdTxns = txns.filter(t => t.moneda === "USD");
  const totalCRC = crcTxns.reduce((a, t) => a + t.monto, 0);
  const totalUSD = usdTxns.reduce((a, t) => a + t.monto, 0);

  // Categories
  const catMap = {};
  crcTxns.forEach(t => {
    const { cat, color } = getCategory(t.comercio);
    if (!catMap[cat]) catMap[cat] = { cat, color, total: 0, count: 0 };
    catMap[cat].total += t.monto;
    catMap[cat].count++;
  });
  const categories = Object.values(catMap).sort((a, b) => b.total - a.total);

  // Top comercios
  const comercioMap = {};
  crcTxns.forEach(t => {
    const k = t.comercio.substring(0, 20);
    if (!comercioMap[k]) comercioMap[k] = 0;
    comercioMap[k] += t.monto;
  });
  const topComercios = Object.entries(comercioMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Spending by day (last 10 days)
  const dayMap = {};
  crcTxns.forEach(t => {
    const d = t.fecha?.split("/").slice(0, 2).join("/") || "?";
    if (!dayMap[d]) dayMap[d] = 0;
    dayMap[d] += t.monto;
  });
  const dailyData = Object.entries(dayMap).slice(-10).map(([day, amt]) => ({ day, amt }));

  const ahorros = ahorrosData;
  const deudas = deudasData;
  const totalAhorrosCRC = ahorros.filter(a => a.moneda === "CRC").reduce((s, a) => s + a.saldo, 0);
  const totalAhorrosUSD = ahorros.filter(a => a.moneda === "USD").reduce((s, a) => s + a.saldo, 0);

  // Deudas totals
  const totalDeudaCRC = deudas.filter(d => d.moneda === "CRC").reduce((s, d) => s + d.saldo, 0);
  const totalDeudaUSD = deudas.filter(d => d.moneda === "USD").reduce((s, d) => s + d.saldo, 0);

  const tabs = [
    { id: "overview", label: "Resumen", icon: "◈" },
    { id: "transactions", label: "Movimientos", icon: "◎" },
    { id: "savings", label: "Ahorros", icon: "◉" },
    { id: "debts", label: "Deudas", icon: "◫" },
    { id: "chat", label: "Chat IA", icon: "◎" },
  ];

  // ── Chat state ──────────────────────────────────────────────
  const [chatMsgs, setChatMsgs] = useState([
    { role: "assistant", text: `¡Hola! Soy tu asesor financiero IA. Ya tengo acceso a tu ciclo **${ACTIVE_CYCLE}**. ¿Qué quieres saber sobre tus finanzas?` }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  // Build financial context from real data
  const buildContext = () => {
    const topCats = categories.slice(0, 5).map(c => `${c.cat}: ${fmtCRC(c.total)}`).join(", ");
    const topComerciosList = topComercios.slice(0, 5).map(([n, a]) => `${n}: ${fmtCRC(a)}`).join(", ");
    const cuentasList = ahorros.map(a => `${a.cuenta} (${a.moneda}): ${a.moneda === "CRC" ? fmtCRC(a.saldo) : fmtUSD(a.saldo)}`).join(", ");
    const deudaList = deudas.map(d => `${d.nombre} ${d.entidad} ${d.moneda === "CRC" ? fmtCRC(d.saldo) : fmtUSD(d.saldo)} cuota ${d.moneda === "CRC" ? fmtCRC(d.cuota) : fmtUSD(d.cuota)}/mes tasa ${d.tasa}% ${d.meses} meses`).join(" | ");
    const totalCuotasCRC = deudas.filter(d => d.moneda === "CRC").reduce((s, d) => s + d.cuota, 0);
    const totalCuotasUSD = deudas.filter(d => d.moneda === "USD").reduce((s, d) => s + d.cuota, 0);
    return `Datos financieros reales del usuario para el ciclo ${ACTIVE_CYCLE}:
- Gastos CRC: ${fmtCRC(totalCRC)} (${crcTxns.length} transacciones)
- Gastos USD: ${fmtUSD(totalUSD)} (${usdTxns.length} transacciones)
- Categorías de gasto: ${topCats}
- Top comercios: ${topComerciosList}
- Cuentas de ahorro: ${cuentasList}
- Total ahorros CRC: ${fmtCRC(totalAhorrosCRC)} | USD: ${fmtUSD(totalAhorrosUSD)}
- Deudas: ${deudaList}
- Cuota mensual total CRC: ${fmtCRC(totalCuotasCRC)} | USD: ${fmtUSD(totalCuotasUSD)}
- Últimas 5 transacciones: ${txns.slice(0, 5).map(t => `${t.fecha} ${t.comercio} ${t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)}`).join(" | ")}`;
  };

  const sendChat = async (text) => {
    const msg = text || chatInput;
    if (!msg.trim() || chatLoading) return;
    setChatInput("");
    const newMsgs = [...chatMsgs, { role: "user", text: msg }];
    setChatMsgs(newMsgs);
    setChatLoading(true);
    try {
      const apiMessages = newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
      const systemPrompt = `Eres un asesor financiero personal inteligente llamado FinanceAI. Responde SIEMPRE en español costarricense. Sé conciso (máximo 4 oraciones salvo que pidan detalle). Usa los datos reales del usuario. Da consejos accionables y específicos con sus números reales. Usa ₡ para colones y $ para dólares.\n\n${buildContext()}`;
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, system: systemPrompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setChatMsgs(m => [...m, { role: "assistant", text: data.text || "No pude procesar eso." }]);
    } catch {
      setChatMsgs(m => [...m, { role: "assistant", text: "⚠️ No se pudo conectar al backend. Asegurate de que server.js esté corriendo en puerto 3001." }]);
    }
    setChatLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 70% 40% at 15% 0%, rgba(0,212,160,0.05) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 85% 100%, rgba(59,142,255,0.04) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem 3rem" }}>

        {/* ── HEADER ── */}
        <div style={{ padding: "1.75rem 0 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", borderBottom: `1px solid ${T.border}`, marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: isDemo ? T.amber : T.emerald, boxShadow: `0 0 8px ${isDemo ? T.amber : T.emerald}` }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: isDemo ? T.amber : T.emerald }}>
                {isDemo ? "DEMO — Datos de ejemplo" : "CONECTADO — Google Sheet real"}
              </span>
            </div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
              Finance<span style={{ color: T.emerald }}>AI</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 400, color: T.muted2, marginLeft: "0.75rem" }}>· Ciclo {ACTIVE_CYCLE}</span>
            </h1>
          </div>

          {!token ? (
            <button onClick={handleGoogleLogin} disabled={!gsLoaded} style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              background: T.card, border: `1px solid ${T.emerald}40`,
              color: T.text, borderRadius: 12, padding: "0.7rem 1.25rem",
              cursor: gsLoaded ? "pointer" : "default", fontSize: "0.85rem", fontWeight: 500,
              transition: "all 0.2s", boxShadow: `0 0 20px ${T.emerald}10`,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.emerald; e.currentTarget.style.boxShadow = `0 0 24px ${T.emerald}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.emerald + "40"; e.currentTarget.style.boxShadow = `0 0 20px ${T.emerald}10`; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Conectar Google Sheet
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.emeraldDim, border: `1px solid ${T.emerald}30`, borderRadius: 10, padding: "0.5rem 1rem" }}>
              <span style={{ fontSize: 12, color: T.emerald, fontFamily: "'DM Mono',monospace" }}>✓ Sheet conectado</span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: T.roseDim, border: `1px solid ${T.rose}30`, borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 13, color: T.rose }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ background: T.sapphireDim, border: `1px solid ${T.sapphire}30`, borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 13, color: T.sapphire, fontFamily: "'DM Mono',monospace" }}>
            {setupStatus || "⟳ Cargando..."}
          </div>
        )}

        {/* Ready to connect */}
        {isDemo && (
          <div style={{ background: T.amberDim, border: `1px solid ${T.amber}30`, borderRadius: 12, padding: "0.85rem 1.25rem", marginBottom: "1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div style={{ fontSize: 13, color: T.muted2 }}>Viendo datos de demo. Haz click en <span style={{ color: T.amber, fontWeight: 600 }}>Conectar Google Sheet</span> arriba para ver tus datos reales.</div>
          </div>
        )}

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 4, marginBottom: "1.5rem", width: "fit-content" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? T.emeraldDim : "transparent",
              border: `1px solid ${tab === t.id ? T.emerald + "40" : "transparent"}`,
              color: tab === t.id ? T.emerald : T.muted2,
              borderRadius: 10, padding: "0.5rem 1.1rem",
              fontFamily: "'DM Mono',monospace", fontSize: 12, cursor: "pointer",
              letterSpacing: "0.06em", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "1rem" }}>
              <StatCard label="Gastos Ciclo CRC" value={fmtCRC(totalCRC)} sub={`${crcTxns.length} transacciones`} color={T.emerald} icon="₡" delay={0} />
              <StatCard label="Gastos Ciclo USD" value={fmtUSD(totalUSD)} sub={`${usdTxns.length} transacciones`} color={T.sapphire} icon="$" delay={80} />
              <StatCard label="Ahorros CRC" value={fmtCRC(totalAhorrosCRC)} sub={`${ahorros.filter(a => a.moneda === "CRC").length} cuentas`} color={T.amber} icon="◈" delay={160} />
              <StatCard label="Deuda Total CRC" value={fmtCRC(totalDeudaCRC)} sub="Préstamos activos" color={T.rose} icon="◫" delay={240} />
            </div>

            {/* Spending by day */}
            <div style={{ background: T.card, borderRadius: 16, padding: "1.5rem", border: `1px solid ${T.border}` }}>
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: 3 }}>Gastos por Día</div>
                <div style={{ fontSize: 12, color: T.muted2 }}>CRC · Ciclo actual</div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="gEmerald" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.emerald} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={T.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₡${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amt" name="Gastos" stroke={T.emerald} strokeWidth={2} fill="url(#gEmerald)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Categories + Top comercios */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

              <div style={{ background: T.card, borderRadius: 16, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Por Categoría</div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={categories} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={3} dataKey="total">
                      {categories.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fmtCRC(v)} contentStyle={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                  {categories.slice(0, 4).map((c, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: T.muted2 }}>{c.cat}</span>
                      </div>
                      <span style={{ fontSize: 12, color: T.text, fontFamily: "'DM Mono',monospace" }}>{fmtCRC(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: T.card, borderRadius: 16, padding: "1.5rem", border: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem", marginBottom: "1.25rem" }}>Top Comercios</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {topComercios.map(([name, amt], i) => {
                    const pct = Math.round((amt / totalCRC) * 100);
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T.muted2, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          <span style={{ fontSize: 12, color: T.text, fontFamily: "'DM Mono',monospace" }}>{fmtCRC(amt)}</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${T.emerald}, ${T.sapphire})`, borderRadius: 4, transition: "width 1s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {tab === "transactions" && (
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem" }}>Movimientos del Ciclo</div>
                <div style={{ fontSize: 12, color: T.muted2, marginTop: 2 }}>{txns.length} transacciones · Feb26–Mar26</div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.emerald }}>{fmtCRC(totalCRC)}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Fecha", "Comercio", "Categoría", "Moneda", "Monto"].map(h => (
                      <th key={h} style={{ padding: "0.75rem 1.25rem", textAlign: h === "Monto" ? "right" : "left", fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => {
                    const { cat, color } = getCategory(t.comercio);
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "0.85rem 1.25rem", fontSize: 12, color: T.muted2, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{t.fecha}</td>
                        <td style={{ padding: "0.85rem 1.25rem", fontSize: 13, color: T.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.comercio}</td>
                        <td style={{ padding: "0.85rem 1.25rem" }}>
                          <span style={{ background: color + "15", border: `1px solid ${color}30`, color, borderRadius: 6, padding: "0.2rem 0.6rem", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{cat}</span>
                        </td>
                        <td style={{ padding: "0.85rem 1.25rem", fontSize: 12, color: T.muted2, fontFamily: "'DM Mono',monospace" }}>{t.moneda}</td>
                        <td style={{ padding: "0.85rem 1.25rem", textAlign: "right", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: T.text }}>
                          {t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SAVINGS TAB ── */}
        {tab === "savings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <StatCard label="Total Ahorros CRC" value={fmtCRC(totalAhorrosCRC)} sub={`${ahorros.filter(a => a.moneda === "CRC").length} cuentas`} color={T.emerald} icon="₡" />
              <StatCard label="Total Ahorros USD" value={fmtUSD(totalAhorrosUSD)} sub={`${ahorros.filter(a => a.moneda === "USD").length} cuentas`} color={T.sapphire} icon="$" />
            </div>
            <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem" }}>Saldo por Cuenta</div>
              </div>
              {ahorros.map((a, i) => {
                const pct = a.moneda === "CRC" ? Math.round((a.saldo / totalAhorrosCRC) * 100) : Math.round((a.saldo / totalAhorrosUSD) * 100);
                return (
                  <div key={i} style={{ padding: "1rem 1.5rem", borderBottom: i < ahorros.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{a.cuenta}</div>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{a.moneda}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontFamily: "'DM Mono',monospace", fontWeight: 600, color: T.emerald }}>{a.moneda === "CRC" ? fmtCRC(a.saldo) : fmtUSD(a.saldo)}</div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{pct}% del total</div>
                      </div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 4 }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: a.moneda === "CRC" ? T.emerald : T.sapphire, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DEBTS TAB ── */}
        {tab === "debts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <StatCard label="Deuda Total CRC" value={fmtCRC(totalDeudaCRC)} sub="Cuota mensual total" color={T.rose} icon="₡" />
              <StatCard label="Deuda Total USD" value={fmtUSD(totalDeudaUSD)} sub="Préstamos en dólares" color={T.amber} icon="$" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {deudas.map((d, i) => {
                const progPct = Math.round(((d.moneda === "CRC" ? totalDeudaCRC : totalDeudaUSD) > 0 ? (d.saldo / (d.moneda === "CRC" ? totalDeudaCRC : totalDeudaUSD)) * 100 : 0));
                return (
                  <div key={i} style={{ background: T.card, borderRadius: 16, padding: "1.25rem 1.5rem", border: `1px solid ${T.border}`, transition: "border-color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = T.rose + "30"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.85rem" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{d.nombre}</div>
                        <div style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{d.entidad} · {d.tasa}% · {d.meses} meses restantes</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontFamily: "'DM Mono',monospace", fontWeight: 700, color: T.rose }}>{d.moneda === "CRC" ? fmtCRC(d.saldo) : fmtUSD(d.saldo)}</div>
                        <div style={{ fontSize: 11, color: T.muted2, marginTop: 2 }}>Cuota: {d.moneda === "CRC" ? fmtCRC(d.cuota) : fmtUSD(d.cuota)}/mes</div>
                      </div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5 }}>
                      <div style={{ width: `${Math.min(progPct, 100)}%`, height: "100%", background: d.tasa === 0 ? T.emerald : T.rose, borderRadius: 4 }} />
                    </div>
                    {d.tasa === 0 && <div style={{ fontSize: 10, color: T.emerald, marginTop: 4, fontFamily: "'DM Mono',monospace" }}>✓ TASA 0%</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden", display: "flex", flexDirection: "column", height: 560 }}>

            {/* Chat header */}
            <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: T.emeraldDim, border: `1px solid ${T.emerald}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◎</div>
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: T.text, fontFamily: "'Syne',sans-serif" }}>Asesor Financiero IA</div>
                <div style={{ fontSize: 11, color: T.emerald, fontFamily: "'DM Mono',monospace" }}>● Conoce tu ciclo {ACTIVE_CYCLE} completo</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "assistant" && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: T.emeraldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>◎</div>
                  )}
                  <div style={{
                    maxWidth: "75%",
                    background: m.role === "user" ? `rgba(0,212,160,0.12)` : T.card2,
                    border: `1px solid ${m.role === "user" ? T.emerald + "30" : T.border}`,
                    borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    padding: "0.75rem 1rem",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: m.role === "user" ? "#d1fae5" : T.muted2,
                    whiteSpace: "pre-wrap",
                  }}>{m.text}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: T.emeraldDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>◎</div>
                  <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: "16px 16px 16px 4px", padding: "0.75rem 1rem", display: "flex", gap: 4 }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.emerald, animation: "bounce 1s infinite", animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions */}
            <div style={{ padding: "0 1.25rem 0.6rem", display: "flex", gap: "0.4rem", overflowX: "auto", scrollbarWidth: "none" }}>
              {["¿En qué gasto más?", "¿Cómo bajo mis gastos?", "¿Cuánto debo en total?", "Resumen del ciclo", "¿En qué invierto mis ahorros?"].map((s, i) => (
                <button key={i} onClick={() => sendChat(s)} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 20, padding: "0.3rem 0.85rem", color: T.muted2, fontSize: "0.68rem", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono',monospace", flexShrink: 0, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.emerald + "50"; e.currentTarget.style.color = T.emerald; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted2; }}
                >{s}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: "0.5rem 1.25rem 1.25rem", display: "flex", gap: "0.6rem" }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Pregunta lo que quieras sobre tus finanzas..."
                style={{ flex: 1, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0.75rem 1rem", color: T.text, fontSize: 13.5, outline: "none", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.2s" }}
                onFocus={e => e.target.style.borderColor = T.emerald + "50"}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()} style={{ background: chatInput.trim() ? T.emeraldDim : "transparent", border: `1px solid ${chatInput.trim() ? T.emerald + "50" : T.border}`, borderRadius: 12, padding: "0.75rem 1.1rem", color: chatInput.trim() ? T.emerald : T.muted, cursor: chatInput.trim() ? "pointer" : "default", fontSize: 18, transition: "all 0.2s" }}>→</button>
            </div>
          </div>
        )}

      </div>
      {/* ── FAB BUTTON ── */}
      {!isDemo && (
        <button onClick={() => setShowModal(true)} style={{
          position: "fixed", bottom: "2rem", right: "2rem", zIndex: 100,
          width: 56, height: 56, borderRadius: "50%",
          background: `linear-gradient(135deg, ${T.emerald}, ${T.sapphire})`,
          border: "none", color: "#fff", fontSize: 26, cursor: "pointer",
          boxShadow: `0 4px 24px ${T.emerald}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          title="Registrar movimiento"
        >+</button>
      )}

      {/* ── MODAL REGISTRO ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: "1.75rem", width: "100%", maxWidth: 420 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1.25rem" }}>Registrar Movimiento</div>

            {/* Type selector */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {[["gasto","💸 Gasto"], ["ingreso","💰 Ingreso"], ["deuda","🏦 Pago Deuda"]].map(([type, label]) => (
                <button key={type} onClick={() => setModalType(type)} style={{
                  flex: 1, padding: "0.5rem", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: modalType === type ? (type === "gasto" ? T.roseDim : type === "ingreso" ? T.emeraldDim : T.amberDim) : "transparent",
                  border: `1px solid ${modalType === type ? (type === "gasto" ? T.rose : type === "ingreso" ? T.emerald : T.amber) + "50" : T.border}`,
                  color: modalType === type ? (type === "gasto" ? T.rose : type === "ingreso" ? T.emerald : T.amber) : T.muted2,
                  transition: "all 0.15s",
                }}>{label}</button>
              ))}
            </div>

            {/* Form fields */}
            {[
              { key: "comercio", label: "Comercio / Descripción", placeholder: "Ej: Super Buena Suerte" },
              { key: "monto", label: "Monto", placeholder: "Ej: 5000", type: "number" },
              { key: "notas", label: "Notas (opcional)", placeholder: "Cualquier detalle" },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>{label}</label>
                <input type={type || "text"} value={modalForm[key]} onChange={e => setModalForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: "100%", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "0.7rem 1rem", color: T.text, fontSize: 13.5, outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = T.emerald + "60"}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>
            ))}

            {/* Moneda selector */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Moneda</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["CRC", "USD"].map(m => (
                  <button key={m} onClick={() => setModalForm(f => ({ ...f, moneda: m }))} style={{
                    padding: "0.5rem 1.25rem", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: modalForm.moneda === m ? T.emeraldDim : "transparent",
                    border: `1px solid ${modalForm.moneda === m ? T.emerald + "50" : T.border}`,
                    color: modalForm.moneda === m ? T.emerald : T.muted2, transition: "all 0.15s",
                  }}>{m}</button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: 12, background: "transparent", border: `1px solid ${T.border}`, color: T.muted2, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={handleRegistrar} disabled={!modalForm.comercio || !modalForm.monto} style={{
                flex: 2, padding: "0.75rem", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: modalForm.comercio && modalForm.monto ? `linear-gradient(135deg, ${T.emerald}30, ${T.sapphire}30)` : "transparent",
                border: `1px solid ${modalForm.comercio && modalForm.monto ? T.emerald + "50" : T.border}`,
                color: modalForm.comercio && modalForm.monto ? T.emerald : T.muted, transition: "all 0.2s",
              }}>Registrar →</button>
            </div>
          </div>
        </div>
      )}

      <style>{`* { box-sizing: border-box; } *::-webkit-scrollbar { width: 4px; height: 4px; } *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; } @keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-3px);opacity:1} } input::placeholder{color:#4b5563}`}</style>
    </div>
  );
}