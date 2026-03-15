import { useMemo, useState } from "react";

const FALLBACK_THEME = {
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
  text: "#EEF2FF",
  muted: "#4B5675",
  muted2: "#8892AA",
};

function sanitizeTransactions(items = []) {
  return items.slice(0, 150).map((t) => ({
    fecha: t.fecha || "",
    hora: t.hora || "",
    comercio: t.comercio || "",
    tarjeta: t.tarjeta || "",
    moneda: String(t.moneda || "CRC").toUpperCase(),
    monto: Number(t.monto || 0),
    corte: t.corte || "",
    ciclo: t.ciclo || "",
    tipo: t.tipo || "gasto",
    notas: t.notas || "",
  }));
}

function fmtCRC(n) {
  return `₡${Math.round(Number(n || 0)).toLocaleString("es-CR").replace(/\s/g, ".")}`;
}

function fmtUSD(n) {
  return `$${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SectionCard({ theme, title, children }) {
  return (
    <div
      style={{
        background: theme.card2,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        padding: "1rem",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: theme.muted,
          fontFamily: "'DM Mono',monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export default function FinanceAIPanel({
  theme = FALLBACK_THEME,
  isMobile = false,
  transactions = [],
  comparisonTransactions = [],
  cycleLabel = "Selección actual",
  cardLabel = "Todas las tarjetas",
}) {
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [qa, setQa] = useState(null);

  const currentData = useMemo(() => sanitizeTransactions(transactions), [transactions]);
  const comparisonData = useMemo(
    () => sanitizeTransactions(comparisonTransactions),
    [comparisonTransactions]
  );

  async function callAI(payload) {
    const res = await fetch("/api/finance-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Falló finance-ai.");
    }

    return data;
  }

  async function handleAnalyze() {
    try {
      setError("");
      setLoading("analyze");
      const data = await callAI({
        mode: "analyze",
        cycleLabel,
        cardLabel,
        transactions: currentData,
        comparisonTransactions: comparisonData,
      });
      setAnalysis(data);
    } catch (err) {
      setError(err.message || "No se pudo analizar.");
    } finally {
      setLoading("");
    }
  }

  async function handleCategorize() {
    try {
      setError("");
      setLoading("categorize");
      const data = await callAI({
        mode: "categorize",
        cycleLabel,
        cardLabel,
        transactions: currentData.filter((t) => t.tipo === "gasto"),
      });
      setSuggestions(data?.suggestions || []);
    } catch (err) {
      setError(err.message || "No se pudo sugerir categorías.");
    } finally {
      setLoading("");
    }
  }

  async function handleAsk() {
    try {
      if (!question.trim()) return;
      setError("");
      setLoading("ask");
      const data = await callAI({
        mode: "ask",
        cycleLabel,
        cardLabel,
        question,
        transactions: currentData,
      });
      setQa(data);
    } catch (err) {
      setError(err.message || "No se pudo responder la pregunta.");
    } finally {
      setLoading("");
    }
  }

  const totalMovs = currentData.length;
  const quickQuestions = [
    "¿En qué gasté más este ciclo?",
    "¿Qué tarjeta usé más?",
    "¿Hay algo raro o anormal?",
    "¿Qué comercios pesan más?",
  ];

  return (
    <div
      style={{
        background: theme.card,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        padding: isMobile ? "1rem" : "1.25rem 1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexDirection: isMobile ? "column" : "row",
          marginBottom: "1rem",
        }}
      >
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "1rem" }}>
            AI del ciclo
          </div>
          <div style={{ fontSize: 12, color: theme.muted2, marginTop: 2 }}>
            {cycleLabel} · {cardLabel} · {totalMovs} movimientos
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={handleAnalyze}
            disabled={!currentData.length || !!loading}
            style={actionBtn(theme, loading === "analyze")}
          >
            {loading === "analyze" ? "Analizando..." : "Analizar ciclo"}
          </button>
          <button
            onClick={handleCategorize}
            disabled={!currentData.length || !!loading}
            style={actionBtn(theme, loading === "categorize")}
          >
            {loading === "categorize" ? "Pensando..." : "Sugerir categorías"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: theme.roseDim,
            border: `1px solid ${theme.rose}30`,
            color: theme.rose,
            borderRadius: 12,
            padding: "0.75rem 0.9rem",
            marginBottom: "1rem",
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {analysis && (
        <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
          <SectionCard theme={theme} title="Resumen">
            <div style={{ color: theme.text, fontSize: 14, lineHeight: 1.5 }}>
              {analysis.summary}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))",
                gap: "0.65rem",
                marginTop: "0.9rem",
              }}
            >
              <MiniStat theme={theme} label="Gasto CRC" value={fmtCRC(analysis.totals?.gasto_crc)} color={theme.rose} />
              <MiniStat theme={theme} label="Gasto USD" value={fmtUSD(analysis.totals?.gasto_usd)} color={theme.sapphire} />
              <MiniStat theme={theme} label="Ingreso CRC" value={fmtCRC(analysis.totals?.ingreso_crc)} color={theme.emerald} />
              <MiniStat theme={theme} label="Ingreso USD" value={fmtUSD(analysis.totals?.ingreso_usd)} color={theme.amber} />
            </div>
          </SectionCard>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))",
              gap: "1rem",
            }}
          >
            <SectionCard theme={theme} title="Insights">
              <SimpleList items={analysis.insights} color={theme.text} />
            </SectionCard>

            <SectionCard theme={theme} title="Alertas">
              <SimpleList items={analysis.alerts} color={theme.amber} empty="No se detectaron alertas importantes." />
            </SectionCard>

            <SectionCard theme={theme} title="Recomendaciones">
              <SimpleList items={analysis.recommendations} color={theme.emerald} />
            </SectionCard>
          </div>
        </div>
      )}

      <div
        style={{
          background: theme.card2,
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: theme.muted,
            fontFamily: "'DM Mono',monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.75rem",
          }}
        >
          Pregúntale a tu data
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              style={{
                padding: "0.4rem 0.7rem",
                borderRadius: 999,
                border: `1px solid ${theme.border}`,
                background: "transparent",
                color: theme.muted2,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {q}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
            gap: "0.6rem",
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ej: ¿cuánto llevo gastado en restaurantes?"
            style={{
              width: "100%",
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: "0.75rem 0.9rem",
              color: theme.text,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleAsk}
            disabled={!question.trim() || !!loading || !currentData.length}
            style={actionBtn(theme, loading === "ask")}
          >
            {loading === "ask" ? "Respondiendo..." : "Preguntar"}
          </button>
        </div>

        {qa && (
          <div style={{ marginTop: "0.9rem" }}>
            <div style={{ color: theme.text, fontSize: 14, lineHeight: 1.5, marginBottom: "0.75rem" }}>
              {qa.answer}
            </div>

            {qa.bullets?.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <SimpleList items={qa.bullets} color={theme.muted2} />
              </div>
            )}

            {qa.referencedTransactions?.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {qa.referencedTransactions.map((item, idx) => (
                  <div
                    key={`${item.comercio}-${idx}`}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 10,
                      padding: "0.65rem 0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
                    <div style={{ color: theme.text, fontSize: 12 }}>{item.comercio}</div>
                    <div
                      style={{
                        color: theme.muted2,
                        fontSize: 11,
                        fontFamily: "'DM Mono',monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.fecha} · {item.moneda === "USD" ? fmtUSD(item.monto) : fmtCRC(item.monto)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {suggestions?.length > 0 && (
        <SectionCard theme={theme} title="Sugerencias de categoría">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {suggestions.slice(0, 15).map((s) => (
              <div
                key={`${s.index}-${s.comercio}`}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 12,
                  padding: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexDirection: isMobile ? "column" : "row",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ color: theme.text, fontSize: 13, fontWeight: 600 }}>{s.comercio}</div>
                  <div
                    style={{
                      color: theme.muted2,
                      fontSize: 11,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {s.fecha} · {(s.confidence * 100).toFixed(0)}%
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: 6 }}>
                  <span
                    style={{
                      background: theme.sapphireDim,
                      border: `1px solid ${theme.sapphire}30`,
                      color: theme.sapphire,
                      borderRadius: 999,
                      padding: "0.22rem 0.55rem",
                      fontSize: 11,
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {s.categoria}
                  </span>
                </div>

                <div style={{ color: theme.muted2, fontSize: 12 }}>{s.reason}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function MiniStat({ theme, label, value, color }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: theme.muted,
          fontFamily: "'DM Mono',monospace",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color,
          fontWeight: 700,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SimpleList({ items = [], color = "#fff", empty = "Sin datos." }) {
  if (!items?.length) {
    return <div style={{ color: "#8892AA", fontSize: 12 }}>{empty}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start" }}>
          <span style={{ color, marginTop: 2 }}>•</span>
          <span style={{ color, fontSize: 13, lineHeight: 1.45 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function actionBtn(theme, active) {
  return {
    padding: "0.7rem 0.95rem",
    borderRadius: 10,
    border: `1px solid ${active ? `${theme.emerald}40` : theme.border}`,
    background: active ? theme.emeraldDim : theme.card2,
    color: active ? theme.emerald : theme.text,
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
  };
}