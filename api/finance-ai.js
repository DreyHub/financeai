// api/finance-ai.js — con categorización IA mejorada
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY    = process.env.OPENAI_API_KEY;

  if (!ANTHROPIC_KEY && !OPENAI_KEY) {
    return res.status(500).json({ error: "No AI API key configured." });
  }

  const { mode, cycleLabel, cardLabel, transactions = [], comparisonTransactions = [], question } = req.body;

  const fmtCRC = (n) => `₡${Math.round(Number(n || 0)).toLocaleString("es-CR")}`;
  const fmtUSD = (n) => `$${Number(n || 0).toFixed(2)}`;

  const CATEGORIAS = [
    "Supermercado", "Comidas", "Transporte", "Digital/Subs",
    "Salud", "Personal", "Seguros", "Educación", "Entretenimiento",
    "Ropa", "Hogar", "Viajes", "Combustible", "Farmacia", "Otros"
  ];

  async function callAI(systemPrompt, userMessage, maxTokens = 1500) {
    let responseText = "";

    if (ANTHROPIC_KEY) {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userMessage }] }),
        });
        if (r.ok) { const d = await r.json(); responseText = d?.content?.[0]?.text || ""; }
      } catch {}
    }

    if (!responseText && OPENAI_KEY) {
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: maxTokens, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }] }),
        });
        if (r.ok) { const d = await r.json(); responseText = d?.choices?.[0]?.message?.content || ""; }
      } catch {}
    }

    return responseText;
  }

  function parseJSON(text) {
    try { return JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { return null; }
  }

  const gastos = transactions.filter(t => t.tipo === "gasto");
  const ingresos = transactions.filter(t => t.tipo === "ingreso");
  const transferencias = transactions.filter(t => t.tipo === "transferencia");
  const pagosDeuda = transactions.filter(t => t.tipo === "pago_deuda");
  const totalGastosCRC = gastos.filter(t => t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
  const totalGastosUSD = gastos.filter(t => t.moneda === "USD").reduce((a, t) => a + t.monto, 0);
  const totalIngresosCRC = ingresos.filter(t => t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
  const totalIngresosUSD = ingresos.filter(t => t.moneda === "USD").reduce((a, t) => a + t.monto, 0);

  const comercioMap = {};
  gastos.filter(t => t.moneda === "CRC").forEach(t => { comercioMap[t.comercio] = (comercioMap[t.comercio] || 0) + t.monto; });
  const topComercios = Object.entries(comercioMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, a]) => `${n}: ${fmtCRC(a)}`).join(", ");

  let comparisonContext = "";
  if (comparisonTransactions.length > 0) {
    const prevGastosCRC = comparisonTransactions.filter(t => t.tipo === "gasto" && t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
    const diff = totalGastosCRC - prevGastosCRC;
    const pct = prevGastosCRC > 0 ? ((diff / prevGastosCRC) * 100).toFixed(1) : "N/A";
    comparisonContext = `\nComparación ciclo anterior: ${fmtCRC(prevGastosCRC)}, diferencia ${diff >= 0 ? "+" : ""}${fmtCRC(diff)} (${pct}%)`;
  }

  const dataContext = `Ciclo: ${cycleLabel} | Tarjeta: ${cardLabel}
Movimientos: ${transactions.length} (${gastos.length} gastos, ${ingresos.length} ingresos, ${transferencias.length} transferencias, ${pagosDeuda.length} pagos deuda)
Total gastos CRC: ${fmtCRC(totalGastosCRC)} | USD: ${fmtUSD(totalGastosUSD)}
Total ingresos CRC: ${fmtCRC(totalIngresosCRC)} | USD: ${fmtUSD(totalIngresosUSD)}
Top comercios: ${topComercios}${comparisonContext}
Últimas 10: ${transactions.slice(0, 10).map(t => `${t.fecha} ${t.comercio} ${t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)} (${t.tipo})`).join(" | ")}`;

  try {
    if (mode === "analyze") {
      const text = await callAI(
        `Sos un asesor financiero de Costa Rica. Respondé SOLO en JSON válido sin markdown:
{"summary":"diagnóstico breve en español costarricense","totals":{"gasto_crc":0,"gasto_usd":0,"ingreso_crc":0,"ingreso_usd":0},"insights":[],"alerts":[],"recommendations":[]}`,
        `Analizá:\n${dataContext}`
      );
      if (!text) return res.status(500).json({ error: "Sin respuesta de IA." });
      const parsed = parseJSON(text);
      return res.status(200).json(parsed || { summary: text, totals: {}, insights: [], alerts: [], recommendations: [] });

    } else if (mode === "categorize") {
      const gastosParaCat = transactions.filter(t => t.tipo === "gasto").slice(0, 30);
      if (!gastosParaCat.length) return res.status(200).json({ suggestions: [], categorias: CATEGORIAS });

      const comerciosUnicos = [...new Set(gastosParaCat.map(t => t.comercio))];

      const text = await callAI(
        `Sos experto en comercios de Costa Rica y categorización financiera.
Categorizá cada comercio en UNA de estas categorías EXACTAS: ${CATEGORIAS.join(", ")}.

Criterios para Costa Rica:
- Super, Maxipali, PriceSmart, Walmart, minisuper, licorera → Supermercado
- Restaurante, soda, burger, KFC, pizza, taco, pollo, fast food, cafetería → Comidas
- Uber, Didi, parqueo, autopista → Transporte
- Gasolinera, estación de servicio, combustible → Combustible
- Netflix, Spotify, Amazon, Google, Apple, OpenAI, Kolbi, Claro, internet → Digital/Subs
- Farmacia → Farmacia
- Clínica, hospital, dental, médico → Salud
- Barber, salón, spa → Personal
- Seguro, INS → Seguros
- Teatro, cine, evento → Entretenimiento
- Ropa, calzado, tienda de ropa → Ropa
- Para nombres que no reconocés, inferí por contexto del nombre

Respondé SOLO en JSON sin markdown:
{"categorias":{"NOMBRE_COMERCIO":{"categoria":"Categoría","confidence":0.95,"reason":"razón breve"}}}`,
        `Comercios a categorizar:\n${comerciosUnicos.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
        2000
      );

      const parsed = parseJSON(text);
      const categoriasMap = parsed?.categorias || {};

      const suggestions = gastosParaCat.map((t, i) => {
        const match = categoriasMap[t.comercio];
        return {
          index: i,
          comercio: t.comercio,
          fecha: t.fecha,
          monto: t.monto,
          moneda: t.moneda,
          categoriaActual: t.categoria || "",
          categoria: match?.categoria || (t.categoria && t.categoria !== "Otros" ? t.categoria : "Otros"),
          confidence: match?.confidence || (t.categoria && t.categoria !== "Otros" ? 1 : 0.3),
          reason: match?.reason || (t.categoria && t.categoria !== "Otros" ? "Ya categorizado" : "No determinado"),
        };
      });

      return res.status(200).json({ suggestions, categorias: CATEGORIAS });

    } else if (mode === "ask") {
      const text = await callAI(
        `Sos un asesor financiero de Costa Rica. Respondé en español costarricense. SOLO JSON sin markdown:
{"answer":"respuesta directa máximo 3 oraciones","bullets":[],"referencedTransactions":[]}`,
        `Datos:\n${dataContext}\n\nPregunta: ${question}`
      );
      if (!text) return res.status(500).json({ error: "Sin respuesta de IA." });
      const parsed = parseJSON(text);
      return res.status(200).json(parsed || { answer: text, bullets: [], referencedTransactions: [] });

    } else {
      return res.status(400).json({ error: "Invalid mode." });
    }
  } catch (err) {
    console.error("finance-ai error:", err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}