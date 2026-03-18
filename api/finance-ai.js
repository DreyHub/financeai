// api/finance-ai.js
// Vercel Serverless Function — FinanceAI Panel
// Coloca este archivo en: /api/finance-ai.js

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

  // Build financial summary for context
  const gastos = transactions.filter(t => t.tipo === "gasto");
  const ingresos = transactions.filter(t => t.tipo === "ingreso");
  const transferencias = transactions.filter(t => t.tipo === "transferencia");
  const pagosDeuda = transactions.filter(t => t.tipo === "pago_deuda");

  const totalGastosCRC = gastos.filter(t => t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
  const totalGastosUSD = gastos.filter(t => t.moneda === "USD").reduce((a, t) => a + t.monto, 0);
  const totalIngresosCRC = ingresos.filter(t => t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
  const totalIngresosUSD = ingresos.filter(t => t.moneda === "USD").reduce((a, t) => a + t.monto, 0);

  // Top comercios
  const comercioMap = {};
  gastos.filter(t => t.moneda === "CRC").forEach(t => {
    comercioMap[t.comercio] = (comercioMap[t.comercio] || 0) + t.monto;
  });
  const topComercios = Object.entries(comercioMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([n, a]) => `${n}: ${fmtCRC(a)}`).join(", ");

  // Comparison data
  let comparisonContext = "";
  if (comparisonTransactions.length > 0) {
    const prevGastosCRC = comparisonTransactions.filter(t => t.tipo === "gasto" && t.moneda === "CRC").reduce((a, t) => a + t.monto, 0);
    const diff = totalGastosCRC - prevGastosCRC;
    const pct = prevGastosCRC > 0 ? ((diff / prevGastosCRC) * 100).toFixed(1) : "N/A";
    comparisonContext = `\nComparación con ciclo anterior: gastos CRC anteriores ${fmtCRC(prevGastosCRC)}, diferencia ${diff >= 0 ? "+" : ""}${fmtCRC(diff)} (${pct}%)`;
  }

  const dataContext = `
Ciclo: ${cycleLabel} | Tarjeta: ${cardLabel}
Movimientos: ${transactions.length} total (${gastos.length} gastos, ${ingresos.length} ingresos, ${transferencias.length} transferencias, ${pagosDeuda.length} pagos deuda)
Total gastos CRC: ${fmtCRC(totalGastosCRC)} | Total gastos USD: ${fmtUSD(totalGastosUSD)}
Total ingresos CRC: ${fmtCRC(totalIngresosCRC)} | Total ingresos USD: ${fmtUSD(totalIngresosUSD)}
Top comercios: ${topComercios}
${comparisonContext}
Últimas 10 transacciones: ${transactions.slice(0, 10).map(t => `${t.fecha} ${t.comercio} ${t.moneda === "CRC" ? fmtCRC(t.monto) : fmtUSD(t.monto)} (${t.tipo})`).join(" | ")}
`.trim();

  let systemPrompt = "";
  let userMessage = "";

  if (mode === "analyze") {
    systemPrompt = `Sos un asesor financiero personal en Costa Rica. Analizás datos financieros reales del usuario y respondés SOLO en JSON válido sin markdown ni backticks, con esta estructura exacta:
{
  "summary": "Párrafo corto de diagnóstico en español costarricense, máximo 3 oraciones.",
  "totals": {
    "gasto_crc": número,
    "gasto_usd": número,
    "ingreso_crc": número,
    "ingreso_usd": número
  },
  "insights": ["insight 1", "insight 2", "insight 3"],
  "alerts": ["alerta 1 si hay algo preocupante"],
  "recommendations": ["recomendación 1", "recomendación 2"]
}`;
    userMessage = `Analizá estos datos financieros:\n${dataContext}`;

  } else if (mode === "categorize") {
    systemPrompt = `Sos un experto en finanzas personales de Costa Rica. Analizás nombres de comercios y sugerís categorías. Respondés SOLO en JSON válido sin markdown:
{
  "suggestions": [
    {
      "index": 0,
      "comercio": "nombre del comercio",
      "fecha": "fecha",
      "categoria": "Supermercado|Comidas|Transporte|Digital/Subs|Salud|Personal|Seguros|Otros",
      "confidence": 0.95,
      "reason": "razón breve"
    }
  ]
}`;
    const gastosForCategorize = transactions
      .filter(t => t.tipo === "gasto")
      .slice(0, 20)
      .map((t, i) => `${i}. ${t.fecha} | ${t.comercio} | ${t.moneda} ${t.monto}`).join("\n");
    userMessage = `Categorizá estos gastos:\n${gastosForCategorize}`;

  } else if (mode === "ask") {
    systemPrompt = `Sos un asesor financiero personal de Costa Rica. Respondés preguntas sobre datos financieros del usuario en español costarricense. Respondés SOLO en JSON válido sin markdown:
{
  "answer": "respuesta directa en español, máximo 3 oraciones",
  "bullets": ["punto clave 1", "punto clave 2"],
  "referencedTransactions": [
    {"comercio": "...", "fecha": "...", "monto": 0, "moneda": "CRC"}
  ]
}`;
    userMessage = `Datos financieros:\n${dataContext}\n\nPregunta del usuario: ${question}`;

  } else {
    return res.status(400).json({ error: "Invalid mode. Use: analyze, categorize, ask" });
  }

  try {
    let responseText = "";

    // Try Anthropic first
    if (ANTHROPIC_KEY) {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (anthropicRes.ok) {
        const data = await anthropicRes.json();
        responseText = data?.content?.[0]?.text || "";
      }
    }

    // Fallback to OpenAI
    if (!responseText && OPENAI_KEY) {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (openaiRes.ok) {
        const data = await openaiRes.json();
        responseText = data?.choices?.[0]?.message?.content || "";
      }
    }

    if (!responseText) {
      return res.status(500).json({ error: "No se pudo obtener respuesta de la IA." });
    }

    // Parse JSON response
    const clean = responseText.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json(parsed);
    } catch {
      // If not valid JSON, return raw text in answer field
      return res.status(200).json({ answer: responseText, bullets: [], referencedTransactions: [] });
    }

  } catch (err) {
    console.error("finance-ai error:", err);
    return res.status(500).json({ error: err.message || "Error interno del servidor." });
  }
}