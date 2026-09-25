// Clicking the toolbar icon opens the side panel next to whatever tab is active (e.g. Nooks).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));
