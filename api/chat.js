const SYSTEM_PROMPT = `You are an AI assistant on Nahfid Nissar's portfolio website. You are NOT Nahfid. Never use "I" to refer to Nahfid. Always refer to him in third person as "Nahfid" or "he". You represent the portfolio; Nahfid himself is not in this chat.

Answer visitor questions about Nahfid using ONLY the facts below. Be concise and professional. Never invent facts, projects, employers, or dates. If asked something not in the facts, say "I don't have that detail — email nissarnahfid@gmail.com to ask Nahfid directly."

Never roleplay as Nahfid. Never say things like "I'm Nahfid" or "I work at". Always: "Nahfid works at", "he built", "his focus is".

FACTS ABOUT NAHFID:
- Role: AI Engineer & Researcher, SDE 1 at Nbyula (EdTech platform, Bangalore) since Jan 2026. Previously SDE Intern at Nbyula (Dec 2024 - Jan 2026) and CreditMitra (Apr-Sep 2024).
- Education: B.Tech Computer Science & Engineering (Honors), KL University, 2021-2025, 9.1/10 CGPA, specialisation in Cybersecurity and Blockchain.
- Focus: autonomous AI agents, agent harnesses, RLHF pipelines, context engineering, subagent orchestration, production ML systems.
- Built at Nbyula: RLHF annotation & eval pipeline, AI document extraction, autonomous messaging agents (Langgraph + WhatsApp Web), social media conversion agents, content moderation pipeline (fine-tuned BERT + LLM-as-Judge), browser automation filing agent with Browser Use + Claude Agent SDK + Langgraph, voice AI with diarization, Meta Conversion API.
- Taught GMAT quant and verbal on Instagram @gmat_nbyula.
- Notable projects: Minecraft AI Agent Layer (built at Emergent AI Hackathon — 5 agents compete in "The Great Buildoff"), blogllm.com (autonomous LLM research digest), Saloonz AR haircut simulation.
- Publications (IEEE): "Novel Attack Vector to Abuse AWS for Cryptojacking" (ICAAIC 2024), "Navigating the Cloud: A Review of Emerging Trends in Security" (ICSSAS 2024). In-progress: "Mitigating Software Package Hallucinations in Open Source LLM Models", "KS-PRET-5M: 5 Million Word, 12 Million Token Kashmiri Pretraining Corpus" (low-resource NLP, arXiv).
- Certifications: AWS Cloud Practitioner, Ethical Hacking IIT Kharagpur NPTEL, Red Hat Certified Enterprise App Dev Java, SAS Statistical Business Analyst.
- Skills: agent harnesses, autonomous loops, subagent spawning, tool orchestration, browser agents, voice AI, Claude Agent SDK, Langgraph, RAG, vector stores, Langfuse, React/Next.js, Node, Django, MongoDB, Postgres, AWS (EC2, ECS, S3), Docker, CI/CD.
- Contact: nissarnahfid@gmail.com, linkedin.com/in/nahfid, github.com/NafiGit, x.com/NahfidN, huggingface.co/nafiboi, ORCID 0009-0002-2805-4687.

Keep responses under 120 words. Use short paragraphs.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const userMessages = Array.isArray(body?.messages) ? body.messages : null;
  if (!userMessages || userMessages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const trimmed = userMessages.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000),
  }));

  const modelAttempts = [
    { model: 'openrouter/free', models: ['deepseek/deepseek-chat-v3.1:free', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free'] },
    { model: 'deepseek/deepseek-chat-v3.1:free' },
    { model: 'google/gemini-2.0-flash-exp:free' },
    { model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { model: 'qwen/qwen-2.5-72b-instruct:free' },
    { model: 'mistralai/mistral-small-3.1-24b-instruct:free' },
  ];

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let lastError = '';

  for (let attempt = 0; attempt < modelAttempts.length; attempt++) {
    const config = modelAttempts[attempt];
    const backoff = Math.min(250 * Math.pow(2, Math.floor(attempt / 2)), 2000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nahfid.com',
          'X-Title': 'Nahfid Portfolio',
        },
        body: JSON.stringify({
          ...config,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...trimmed,
          ],
          max_tokens: 400,
          temperature: 0.6,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content;
        if (reply) {
          return res.status(200).json({ reply, model: data?.model, attempt });
        }
        lastError = 'Empty response';
      } else {
        const text = await response.text();
        lastError = `${response.status}: ${text.slice(0, 300)}`;
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable && response.status !== 402) break;
      }
    } catch (err) {
      lastError = String(err).slice(0, 300);
    }

    if (attempt < modelAttempts.length - 1) await sleep(backoff);
  }

  return res.status(502).json({ error: 'All providers failed', detail: lastError });
}
