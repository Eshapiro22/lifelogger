import { DEFAULT_TRIPLE_T } from "./methodology.js";

export const DEFAULT_SETTINGS = {
  engine: "claudeai",
  claudeUrl: "https://claude.ai/new",
  includePlaybook: true,
  autoSend: true,
  findProof: true,
  apiKey: "",
  model: "claude-opus-5",
  senderName: "",
  senderCompany: "",
  tripleT: DEFAULT_TRIPLE_T,
  playbook: "",
  extraRules: "",
  sequences: [
    {
      id: "default",
      name: "Example sequence — edit me",
      persona: "",
      problem1: "",
      problem2: "",
      solution: "",
      proof: "",
      asset: "",
      cta: "interest",
    },
  ],
};

// Earlier versions saved a Triple Touch definition that always assumed a
// voicemail; swap it for the current default unless the user edited it.
const OLD_TRIPLE_T_PREFIX = "Triple Touch: a call, a voicemail and an email to the same person within ~5 minutes";

export async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  if (settings.tripleT?.startsWith(OLD_TRIPLE_T_PREFIX)) settings.tripleT = DEFAULT_TRIPLE_T;
  return settings;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
