// Hidden page used only to copy text to the clipboard when no extension page
// has focus (e.g. after switching you back to the Outreach tab).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen" || msg.type !== "copy") return;
  const el = document.getElementById("clip");
  el.value = msg.text;
  el.select();
  sendResponse({ ok: document.execCommand("copy") });
});
