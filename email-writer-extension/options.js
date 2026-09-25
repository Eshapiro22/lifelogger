import { loadSettings, saveSettings } from "./storage.js";

const $ = (id) => document.getElementById(id);
const SIMPLE = ["apiKey", "model", "senderName", "senderCompany", "tripleT", "extraRules"];

function addSequence(seq = {}) {
  const node = $("seq-tpl").content.firstElementChild.cloneNode(true);
  node.dataset.id = seq.id || crypto.randomUUID();
  node.querySelectorAll("[data-k]").forEach((el) => {
    el.value = seq[el.dataset.k] ?? (el.dataset.k === "cta" ? "interest" : "");
  });
  node.querySelector(".remove").addEventListener("click", () => node.remove());
  $("sequences").appendChild(node);
}

async function init() {
  const s = await loadSettings();
  SIMPLE.forEach((k) => ($(k).value = s[k] ?? ""));
  s.sequences.forEach(addSequence);
  $("add-seq").addEventListener("click", () => addSequence({ name: "New sequence" }));
  $("save").addEventListener("click", save);
}

async function save() {
  const sequences = [...document.querySelectorAll(".seq")].map((node) => {
    const seq = { id: node.dataset.id };
    node.querySelectorAll("[data-k]").forEach((el) => (seq[el.dataset.k] = el.value.trim()));
    return seq;
  });
  if (!sequences.length) {
    $("status").textContent = "Add at least one sequence.";
    return;
  }
  const settings = Object.fromEntries(SIMPLE.map((k) => [k, $(k).value.trim()]));
  await saveSettings({ ...settings, sequences });
  $("status").textContent = "Saved.";
}

init();
