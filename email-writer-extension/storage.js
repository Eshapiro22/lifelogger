import { DEFAULT_TRIPLE_T } from "./methodology.js";

export const DEFAULT_SETTINGS = {
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

export async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
