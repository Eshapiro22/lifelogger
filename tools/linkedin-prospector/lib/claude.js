// Uses Claude to pick the most relevant customer story from YOUR story
// library for each prospect and write the Trust line (and tighten the draft).
// Claude is told to use only facts from the library; when nothing fits it says
// so and the draft keeps its [TRUST] placeholder.
(function (root) {
  const LP = root.LP || (root.LP = {});
  const MODEL = 'claude-opus-5-5';

  const SYSTEM = `You help a B2B account executive write short LinkedIn messages to new connections using the Triple T framework:
- Trigger: the first line makes it obvious the message is meant for this specific person (their role, company, industry, or that you just connected).
- Tension: name the problem that trigger creates, in plain problem language. No buzzwords ("single source of truth", "all-in-one", "AI-powered", "seamless", "best-in-class").
- Trust: one or two sentences of proof from a real customer story or data point. Not a product explanation.
Then a low-pressure, interest-based question as the close.

Rules:
- Use ONLY customer names, numbers, and outcomes that appear in the provided story library. Never invent or embellish a customer, metric, or quote. If no story is a reasonable fit for this prospect, set story_id to "none", leave trust_line empty, and keep the literal [TRUST: ...] placeholder in the message.
- Prefer a story from the same industry/vertical, then the same persona (e.g. finance leaders), then the same problem.
- If a story is marked as not approved for naming the customer, describe it anonymously (e.g. "a Canadian manufacturer").
- Keep the message under 600 characters, conversational, no emojis, no subject line, signed off with nothing (LinkedIn shows the sender).
- Keep the rep's draft structure and voice; change only what's needed.`;

  const SCHEMA = {
    type: 'object',
    properties: {
      story_id: { type: 'string', description: 'ID of the chosen story from the library, or "none"' },
      trust_line: { type: 'string' },
      message: { type: 'string' },
      why: { type: 'string', description: 'One sentence: why this story fits this prospect (or why none fit)' },
    },
    required: ['story_id', 'trust_line', 'message', 'why'],
    additionalProperties: false,
  };

  // Library text -> [{id, text}]. Stories are separated by lines of "---".
  function parseStories(text) {
    return String(text || '').split(/^\s*---+\s*$/m).map(s => s.trim()).filter(Boolean)
      .map((text, i) => ({ id: 'S' + (i + 1), text }));
  }

  let client = null, clientKey = '';
  function getClient(apiKey) {
    if (!apiKey) throw new Error('Add your Anthropic API key in Settings first.');
    if (!client || clientKey !== apiKey) {
      // The key lives in this extension's local storage on your machine only.
      client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      clientKey = apiKey;
    }
    return client;
  }

  // row: a buildRows() row. Returns {story_id, trust_line, message, why}.
  async function draftWithClaude(row, settings) {
    const stories = parseStories(settings.stories);
    if (!stories.length) throw new Error('Add customer stories in Settings first.');
    const p = row.person, a = row.cls.account || {};
    const prospect = [
      `Name: ${p.name}`,
      `Headline/title: ${p.title || p.headline || 'unknown'}`,
      `Company: ${row.cls.company || p.company || 'unknown'}`,
      `Account vertical: ${a.vertical || 'unknown'} / ${a.subVertical || 'unknown'}`,
      `Location: ${[a.city, a.state].filter(Boolean).join(', ') || 'unknown'}`,
      `Employees: ${a.employees || 'unknown'}`,
      `Persona bucket: ${row.persona.label}`,
    ].join('\n');
    const library = stories.map(s => `<story id="${s.id}">\n${s.text}\n</story>`).join('\n');

    const response = await getClient(settings.anthropicKey).beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: [{ type: 'text', text: SYSTEM }, { type: 'text', text: `<story_library>\n${library}\n</story_library>`, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `<prospect>\n${prospect}\n</prospect>\n\n<current_draft>\n${row.draft}\n</current_draft>\n\nPick the best-fitting story and return the improved message.`,
      }],
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined this request.');
    if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of room; try again.');
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const out = JSON.parse(text);
    const story = stories.find(s => s.id === out.story_id);
    return { ...out, story: story ? story.text.split('\n')[0].slice(0, 80) : '' };
  }

  Object.assign(LP, { parseStories, draftWithClaude });
})(typeof globalThis !== 'undefined' ? globalThis : this);
