const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const CATEGORY_ENUM = [
  "Supermercado",
  "Comidas",
  "Transporte",
  "Digital/Subs",
  "Salud",
  "Personal",
  "Seguros",
  "Hogar",
  "Mascotas",
  "Servicios",
  "Otros",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeString(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function safeNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeTransactions(items = [], limit = 150) {
  return items.slice(0, limit).map((t, index) => ({
    index,
    fecha: safeString(t.fecha, 20),
    hora: safeString(t.hora, 20),
    comercio: safeString(t.comercio, 120),
    tarjeta: safeString(t.tarjeta, 20),
    moneda: safeString(t.moneda || "CRC", 10).toUpperCase(),
    monto: safeNumber(t.monto),
    corte: safeString(t.corte, 10),
    ciclo: safeString(t.ciclo, 120),
    tipo: safeString(t.tipo || "gasto", 30),
    notas: safeString(t.notas, 200),
  }));
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      return "";
    })
    .join("");
}

async function callStructuredOpenAI({ system, user, schemaName, schema }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Falta OPENAI_API_KEY en variables de entorno.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      "Error llamando OpenAI.";
    throw new Error(msg);
  }

  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error("Respuesta vacía del modelo.");
  if (message.refusal) throw new Error(message.refusal);

  const raw = contentToText(message.content);
  if (!raw) throw new Error("No vino contenido JSON del modelo.");

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("No se pudo parsear el JSON devuelto por OpenAI.");
  }
}

const ANALYZE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    insights: {
      type: "array",
      items: { type: "string" },
    },
    alerts: {
      type: "array",
      items: { type: "string" },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
    },
    totals: {
      type: "object",
      additionalProperties: false,
      properties: {
        gasto_crc: { type: "number" },
        gasto_usd: { type: "number" },
        ingreso_crc: { type: "number" },
        ingreso_usd: { type: "number" },
      },
      required: ["gasto_crc", "gasto_usd", "ingreso_crc", "ingreso_usd"],
    },
  },
  required: ["summary", "insights", "alerts", "recommendations", "totals"],
};

const CATEGORIZE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "number" },
          comercio: { type: "string" },
          fecha: { type: "string" },
          categoria: {
            type: "string",
            enum: CATEGORY_ENUM,
          },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["index", "comercio", "fecha", "categoria", "confidence", "reason"],
      },
    },
  },
  required: ["suggestions"],
};

const ASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    bullets: {
      type: "array",
      items: { type: "string" },
    },
    referencedTransactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          comercio: { type: "string" },
          fecha: { type: "string" },
          monto: { type: "number" },
          moneda: { type: "string" },
        },
        required: ["comercio", "fecha", "monto", "moneda"],
      },
    },
  },
  required: ["answer", "bullets", "referencedTransactions"],
};

function buildAnalyzePrompt({ cycleLabel, cardLabel, transactions, comparisonTransactions }) {
  return JSON.stringify(
    {
      objetivo:
        "Analiza el ciclo financiero actual. Usa solo los datos entregados. No inventes números ni transacciones.",
      contexto: {
        ciclo: cycleLabel || "Selección actual",
        tarjeta: cardLabel || "Todas las tarjetas",
      },
      reglas: [
        "El summary debe ser corto y directo.",
        "insights debe traer hallazgos útiles y concretos.",
        "alerts solo si realmente ves algo raro, concentrado o riesgoso.",
        "recommendations debe ser accionable, no genérico.",
        "totals debe separar gasto/ingreso por moneda.",
      ],
      transacciones_actuales: transactions,
      transacciones_comparacion: comparisonTransactions,
    },
    null,
    2
  );
}

function buildCategorizePrompt({ cycleLabel, cardLabel, transactions }) {
  return JSON.stringify(
    {
      objetivo:
        "Sugiere categorías para movimientos financieros. Usa solo estas categorías permitidas.",
      categorias_permitidas: CATEGORY_ENUM,
      contexto: {
        ciclo: cycleLabel || "Selección actual",
        tarjeta: cardLabel || "Todas las tarjetas",
      },
      reglas: [
        "No inventes comercios.",
        "confidence debe ser entre 0 y 1.",
        "reason debe ser breve y claro.",
      ],
      transacciones: transactions,
    },
    null,
    2
  );
}

function buildAskPrompt({ question, cycleLabel, cardLabel, transactions }) {
  return JSON.stringify(
    {
      objetivo:
        "Responde preguntas sobre las finanzas del usuario usando solo las transacciones entregadas.",
      pregunta: question,
      contexto: {
        ciclo: cycleLabel || "Selección actual",
        tarjeta: cardLabel || "Todas las tarjetas",
      },
      reglas: [
        "No inventes datos.",
        "Si no alcanza la información, dilo claramente.",
        "bullets debe resumir soporte concreto.",
        "referencedTransactions debe incluir solo ejemplos realmente usados.",
      ],
      transacciones: transactions,
    },
    null,
    2
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = safeString(body?.mode, 20);

    const transactions = sanitizeTransactions(body?.transactions || [], 150);
    const comparisonTransactions = sanitizeTransactions(body?.comparisonTransactions || [], 120);
    const cycleLabel = safeString(body?.cycleLabel, 120);
    const cardLabel = safeString(body?.cardLabel, 120);
    const question = safeString(body?.question, 500);

    if (!mode) {
      return json({ error: "Falta mode." }, 400);
    }

    if (!transactions.length) {
      return json({ error: "No hay transacciones para analizar." }, 400);
    }

    if (mode === "analyze") {
      const result = await callStructuredOpenAI({
        system:
          "Eres un analista financiero personal. Respondes de forma concreta, útil y accionable. Nunca inventas datos.",
        user: buildAnalyzePrompt({
          cycleLabel,
          cardLabel,
          transactions,
          comparisonTransactions,
        }),
        schemaName: "finance_cycle_analysis",
        schema: ANALYZE_SCHEMA,
      });

      return json(result);
    }

    if (mode === "categorize") {
      const result = await callStructuredOpenAI({
        system:
          "Clasificas movimientos financieros personales con criterio práctico y consistente. Nunca usas categorías fuera de la lista permitida.",
        user: buildCategorizePrompt({
          cycleLabel,
          cardLabel,
          transactions,
        }),
        schemaName: "finance_category_suggestions",
        schema: CATEGORIZE_SCHEMA,
      });

      return json(result);
    }

    if (mode === "ask") {
      if (!question) {
        return json({ error: "Falta question." }, 400);
      }

      const result = await callStructuredOpenAI({
        system:
          "Eres un analista de finanzas personales. Respondes preguntas con base en transacciones reales y con lenguaje claro.",
        user: buildAskPrompt({
          question,
          cycleLabel,
          cardLabel,
          transactions,
        }),
        schemaName: "finance_question_answer",
        schema: ASK_SCHEMA,
      });

      return json(result);
    }

    return json({ error: "mode no soportado." }, 400);
  } catch (error) {
    return json(
      {
        error: error?.message || "Error interno en finance-ai.",
      },
      500
    );
  }
}