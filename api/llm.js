// api/llm.js  (Vercel Serverless Function - Node 20)
export const config = { runtime: "nodejs" };

// ---------- PROMPT ENGINEERING ----------
const SYSTEM_PROMPT = `
You are "SAP Audit Copilot" embedded in SAP UI.

Output rules (STRICT):
- Respond in concise Markdown ONLY.
- No greetings, no speaker labels, no headings unless explicitly asked.
- For list-style questions, start immediately with a short lead line then bullet points with hyphens.
- Prototype mode: when information is missing, INVENT PLAUSIBLE, CONSISTENT DATA. Do not hedge.
- Keep numbers reasonable and internally consistent across the answer.
- No HTML. No code fences unless the user asks for code.
`;

const FEWSHOTS = [
  {
    role: "user",
    content: "q2 deviations"
  },
  {
    role: "assistant",
    content:
`There were 12 identified deviations in revenue recognition for Q2 FY2025.
- 6 late revenue postings (mostly in the last week of June).
- 4 CO-PA manual adjustments without supporting documentation.
- 2 cut-off errors on shipments invoiced next period.`
  },
  {
    role: "user",
    content: "List deviations for Q2 around revenue recognition and propose corrective actions."
  },
  {
    role: "assistant",
    content:
`There were 15 identified deviations in revenue recognition for Q2 FY2025.
- 8 late revenue postings.
- 5 manual CO-PA adjustments lacking supporting documentation.
- 2 instances of incorrect cut-off dates.`
  }
];

function buildMessages(userQuestion, opts = {}) {
  const {
    company = "JoyIT GmbH",
    auditType = "Internal controls (SOX-like)",
    period = "Q2 FY2025",
    artifacts = [
      "S/4HANA: App FBL3N (G/L Line Items)",
      "SAP GRC: Access Risk Analysis Report",
      "Change logs: CO-PA adjustments Q2",
      "Jira: Audit tickets A-1021, A-1056"
    ]
  } = opts;

  const CONTEXT_CARD = `
Company: ${company}
Audit Type: ${auditType}
Period: ${period}
Artifacts:
- ${artifacts.join("\n- ")}
`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: CONTEXT_CARD },
    ...FEWSHOTS,
    { role: "user", content: userQuestion }
  ];
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, options } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    // timeout opcional
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30000);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildMessages(question, options),
        temperature: 0.2,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0,
        stop: ["\nAI", "\nAssistant", "\nUser:", "\n**"]
      }),
      signal: ac.signal
    });

    clearTimeout(t);

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("OpenAI error:", r.status, txt);
      return res.status(r.status).json({ error: `OpenAI error: ${txt}` });
    }

    const data = await r.json();
    let answer = data?.choices?.[0]?.message?.content || "(no answer)";

    // Limpa rótulos/headers
    answer = answer
      .replace(/^\s*(AI|Assistant|User):\s*/gi, "")
      .replace(/^\s*#{1,6}\s.*\n+/g, "")
      .replace(/\n{3,}/g, "\n\n");

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("LLM call failed:", err && (err.stack || err.message || err));
    return res.status(500).json({ error: "LLM call failed" });
  }
}
