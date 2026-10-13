// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));

// Clipboard writes that must work even when the side panel isn't focused.
async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "Copy the drafted email so you can paste it into Outreach.",
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "copy" || msg.target === "offscreen") return;
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "copy", text: msg.text }))
    .then((res) => sendResponse(res || { ok: false }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // async response
});
