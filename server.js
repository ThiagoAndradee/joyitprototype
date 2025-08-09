// server.js
// Requisitos: npm i express cors dotenv
// Node >= 20 (usa fetch nativo)

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

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

// ---------- ROUTES ----------
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/llm", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const question = (req.body && req.body.question) || "";
    if (!question.trim()) {
      return res.status(400).json({ error: "Empty question" });
    }

    // timeout opcional
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildMessages(question),
        temperature: 0.2,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0,
        // IMPORTANTE: no máximo 4 itens aqui
        stop: ["\nAI", "\nAssistant", "\nUser:", "\n**"]
      }),
      signal: ac.signal
    });

    clearTimeout(t);

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      console.error("OpenAI error:", response.status, txt);
      return res.status(response.status).json({ error: `OpenAI error: ${txt}` });
    }

    const data = await response.json();
    let answer = data?.choices?.[0]?.message?.content || "(no answer)";

    // Pós-processo defensivo: remove rótulos/headers se escaparem
    answer = answer
      .replace(/^\s*(AI|Assistant|User):\s*/gi, "")
      .replace(/^\s*#{1,6}\s.*\n+/g, "")
      .replace(/\n{3,}/g, "\n\n");

    res.json({ answer });
  } catch (err) {
    console.error("LLM call failed:", err && (err.stack || err.message || err));
    res.status(500).json({ error: "LLM call failed" });
  }
});

// ---------- START ----------
const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`SAP Audit Copilot proxy running at http://localhost:${port}`);
});
