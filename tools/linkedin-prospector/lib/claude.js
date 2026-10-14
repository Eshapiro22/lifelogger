// Uses Claude to pick the most relevant customer story from YOUR story
// library for each prospect and write the Trust line (and tighten the draft).
// Claude is told to use only facts from the library; when nothing fits it says
// so and the draft keeps its [TRUST] placeholder.
(function (root) {
  const LP = root.LP || (root.LP = {});
  const MODEL = 'claude-opus-5-5';

  const SYSTEM = `You help a B2B account executive write short LinkedIn messages to people who recently accepted their connection request.

Touch 1 is the Triple T in one message (Jason Bay's framework, as taught by 30 Minutes to President's Club):
- Trigger: a specific reason this message is for THIS person (their role, company, industry, or something timely). Never just "thanks for connecting".
- Tension: the problem that trigger creates, in plain problem language.
- Trust: who the rep is in one line (use the provided company line as-is) plus one real customer result from the story library.
- Close with a soft, interest-based question. No hard ask: no "15 minutes", no calendar link, no "book a call".
Touch 2 is a short follow-up with a new angle on the problem and a curious question. Touch 3 is a short, gracious close-the-loop note.

Rules:
- Write only the touch you are asked for.
- Use ONLY customer names, numbers, and outcomes that appear in the provided story library. Never invent or embellish a customer, metric, or quote. On touch 1, if no story fits, set story_id to "none", leave trust_line empty, and keep the literal [TRUST: ...] placeholder. On touches 2 and 3, set story_id to "none".
- Keep any [YOU: ...] placeholder exactly as-is if it's in the draft; don't make up the rep's company.
- Prefer a story from the same industry, then the same persona, then the same problem. If a story is marked as not approved for naming the customer, describe it anonymously (e.g. "a Canadian manufacturer").
- No buzzwords ("single source of truth", "all-in-one", "AI-powered", "seamless", "best-in-class").
- Touch 1: 300 to 600 characters, short paragraphs. Touches 2-3: under 300 characters. Conversational, no emojis, no sign-off.
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
        content: `<prospect>\n${prospect}\n</prospect>\n\n<touch>${row.touch}</touch>\n\n<current_draft>\n${row.draft}\n</current_draft>\n\nWrite touch ${row.touch} for this prospect${row.touch === 1 ? ', picking the best-fitting story' : ''}.`,
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
