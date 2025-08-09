// api/llm.js  (Vercel Serverless Function - Node 20)
export const config = { runtime: "nodejs20.x" };

const SYSTEM_PROMPT = `
You are "SAP Audit Copilot", an enterprise-grade assistant embedded in SAP UI.
Your purpose: assist auditors during SAP compliance audits by answering questions,
summarizing findings, and proposing actions based only on provided context.
- If data is missing, say you don't have enough context and ask for specifics.
- Concise, bullet-first, with: Short Answer, Findings, Recommended Actions,
  Risks & Compliance Notes, Evidence & Source Hints, Next Steps.
- Markdown output. No HTML.
`;

function buildMessages(userQuestion) {
  const context = `
Company: JoyIT
Audit Type: Internal controls (SOX-like)
Period: Q2 FY2025
Artifacts:
- S/4HANA: App FBL3N (G/L Line Items)
- SAP GRC: Access Risk Analysis Report
- Change logs: CO-PA adjustments Q2
- Jira: Audit tickets A-1021, A-1056
`;
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: context },
    {
      role: "user",
      content: "List deviations for Q2 around revenue recognition and propose corrective actions."
    },
    {
      role: "assistant",
      content: `**Short Answer**
Preliminary deviations likely relate to late revenue postings and missing evidence.

**Findings**
- Potential cut-off issues in late June.
- Manual CO-PA adjustments with no attachment.

**Recommended Actions**
- Reconcile postings vs. shipping; enforce dual-approval.

**Evidence & Source Hints**
- S/4HANA FBL3N (June 25–30), tickets A-1021/A-1056.

**Next Steps (Checklist)**
- [ ] Pull FBL3N
- [ ] Match with shipping
- [ ] Attach proof`
    },
    { role: "user", content: userQuestion || "" }
  ];
}

export default async function handler(req, res) {
  // CORS (não precisa se UI e API estão no mesmo domínio, mas deixei seguro)
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
    const { question } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildMessages(question),
        temperature: 0.1,
        top_p: 0.9
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: `OpenAI error: ${txt}` });
    }

    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content || "(no answer)";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "LLM call failed" });
  }
}
