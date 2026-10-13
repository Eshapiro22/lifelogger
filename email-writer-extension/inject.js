// Functions injected into the page with chrome.scripting.executeScript. Each one
// must be self-contained: executeScript serializes the function source, so
// nothing from this module's scope is available inside it.

// Runs in every frame. Reports what this frame can offer so the side panel can
// pick where to write the subject and the body.
export function probeFrame() {
  // On screen, not just in the DOM: Outreach can keep the previous task's
  // editor in the page (slid off screen) after you complete it.
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
    return shown && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const isSubject = (el) =>
    /subject/i.test(
      [el.name, el.placeholder, el.id, el.getAttribute("aria-label"), el.getAttribute("data-testid")].join(" ")
    );
  const deepActive = () => {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a;
  };
  const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA") && !isSubject(el);

  const subject = [...document.querySelectorAll("input")].find((el) => visible(el) && isSubject(el));
  const active = deepActive();
  const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')]
    .filter((el) => visible(el) && editable(el) && !el.parentElement?.closest('[contenteditable="true"]'));
  const area = Math.max(0, ...editors.map((el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height));
  return {
    hasSubject: Boolean(subject),
    focusedEditor: editable(active) && (active.isContentEditable || active.tagName === "TEXTAREA") && visible(active),
    editorArea: area,
    isTop: window === window.top,
  };
}

// Writes the subject into the first visible subject input in this frame.
export function fillSubject(subject) {
  const el = [...document.querySelectorAll("input")].find(
    (i) =>
      (() => {
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
      })() &&
      /subject/i.test([i.name, i.placeholder, i.id, i.getAttribute("aria-label"), i.getAttribute("data-testid")].join(" "))
  );
  if (!el) return false;
  el.focus();
  // Use the native setter so React-controlled inputs register the change.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, subject);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// Replaces the body in this frame's focused editor (or its largest visible
// editor). Tries a synthetic paste first, which rich-text editors handle
// through their own paste pipeline, then falls back to insertHTML.
// Puts the body into the on-screen editor without ever changing its HTML
// ourselves: editors like Outreach's keep their own copy of the text and error
// if the page changes underneath them. So: select all, then hand the editor a
// paste event it processes itself. If it ignores the paste we stop and report
// it (the caller can then type it in for real, or ask you to press Ctrl+V).
export async function fillBody(body) {
  try {
    const editor = (function () {
      const onScreen = (el) => {
        const r = el.getBoundingClientRect();
        const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
        return shown && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
      };
      const isSubject = (el) => /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label")].join(" "));
      const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA") && !isSubject(el) && onScreen(el);
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      let ed = editable(active) ? active : null;
      if (!ed) {
        const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
        ed = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')].filter(editable).sort((a, b) => area(b) - area(a))[0];
      }
      while (ed?.parentElement?.isContentEditable) ed = ed.parentElement;
      return ed || null;
    })();
    if (!editor) return { ok: false, method: "none", error: "no on-screen editor found" };

    if (editor.tagName === "TEXTAREA") {
      editor.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(editor, body);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true, method: "textarea" };
    }

    const norm = (t) => t.replace(/\s+/g, " ").trim();
    const probe = norm(body).slice(0, 25);
    const landed = () => norm(editor.innerText).includes(probe);
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = body.replace(/\r/g, "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("<p><br></p>");

    // The selection was set by selectEditorBody (everything above your signature).
    const dt = new DataTransfer();
    dt.setData("text/plain", body);
    dt.setData("text/html", html);
    const notHandled = editor.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    for (let i = 0; i < 10 && !landed(); i++) await new Promise((r) => setTimeout(r, 100));
    if (landed()) return { ok: true, method: "paste" };
    return { ok: false, method: "paste", needsTyping: true, pasteHandled: !notHandled, error: "the editor didn't take the paste" };
  } catch (err) {
    return { ok: false, method: "error", error: String((err && err.message) || err) };
  }
}

// Focuses the on-screen editor and selects its contents, ready for real
// (debugger) typing to replace them. Returns whether one was found.
export function focusEditor() {
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
    return shown && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const isSubject = (el) => /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label")].join(" "));
  const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA") && !isSubject(el) && onScreen(el);
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  let ed = editable(active) ? active : null;
  if (!ed) {
    const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
    ed = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')].filter(editable).sort((a, b) => area(b) - area(a))[0];
  }
  while (ed?.parentElement?.isContentEditable) ed = ed.parentElement;
  if (!ed) return false;
  ed.focus();
  if (ed.tagName === "TEXTAREA") ed.select();
  else document.execCommand("selectAll", false, null);
  return true;
}

// Text of the on-screen editor (to confirm typing landed).
export function editorText() {
  const eds = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  });
  return eds.map((el) => (el.tagName === "TEXTAREA" ? el.value : el.innerText)).join("\n");
}

// Reads the selection, or the visible text, from the top frame.
export function readPage() {
  const sel = window.getSelection()?.toString().trim();
  return sel || document.body.innerText.slice(0, 6000);
}

// claude.ai: puts the prompt into the message box without sending it.
export function pasteIntoClaude(text) {
  const box =
    document.querySelector('div[contenteditable="true"].ProseMirror') ||
    document.querySelector('[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]') ||
    document.querySelector("textarea");
  if (!box) return false;
  box.focus();
  if (box.tagName === "TEXTAREA") {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("insertText", false, text);
  }
  const content = box.tagName === "TEXTAREA" ? box.value : box.innerText;
  return content.trim().length > 0;
}

// claude.ai: returns candidate reply texts, newest first. Code blocks come
// first, then the page text as a fallback; the panel parses the first one
// that holds a JSON object.
export function readClaudeReply() {
  const blocks = [...document.querySelectorAll("pre, code")].map((el) => el.innerText).reverse();
  return [...blocks, document.body.innerText];
}

// Outreach task page: collects labeled prospect fields, mailto links, the
// email being composed (subject + body) and the visible text of this frame.
export function readOutreachTask() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const LABELS = {
    name: /^(name|full name|prospect name)$/i,
    title: /^(title|job title|position|role)$/i,
    company: /^(company|account|account name|organization)$/i,
    email: /^(email|email address|to|recipient)$/i,
  };
  const labels = {};
  for (const el of document.querySelectorAll("dt, th, label, span, div, p, h4, h5, h6, strong")) {
    if (el.children.length > 1 || !visible(el)) continue;
    const own = (el.textContent || "").trim().replace(/:$/, "");
    if (!own || own.length > 20) continue;
    for (const [key, re] of Object.entries(LABELS)) {
      if (labels[key] || !re.test(own)) continue;
      let value = el.nextElementSibling?.innerText || "";
      if (!value.trim()) value = (el.parentElement?.innerText || "").replace(el.textContent, "");
      value = value.trim().split("\n")[0].trim();
      // Skip table headers and other labels picked up as values.
      if (/^(local time|due|title|company|account|email|name|contact|step)$/i.test(value)) continue;
      if (value && value.length <= 120) labels[key] = value;
    }
  }
  const mailtos = [...document.querySelectorAll('a[href^="mailto:"]')]
    .map((a) => decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]))
    .filter(Boolean);

  const isSubject = (el) =>
    /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label"), el.getAttribute("data-testid")].join(" "));
  // The open task's fields: only what's on screen (a completed task can linger off screen).
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return visible(el) && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const subjectEl = [...document.querySelectorAll("input")].find((el) => onScreen(el) && isSubject(el));
  const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')]
    .filter((el) => onScreen(el) && !isSubject(el) && !el.parentElement?.closest('[contenteditable="true"]'));
  const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
  const editor = editors.sort((a, b) => area(b) - area(a))[0];

  // Task rows: each prospect link, grown to the largest ancestor that still
  // belongs to only that prospect (the row), with its account and step links.
  const pid = (href) => (href.match(/\/prospects\/(\d+)/) || [])[1];
  const rows = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/prospects/"]')) {
    const id = pid(a.getAttribute("href") || "");
    const name = (a.innerText || "").trim();
    if (!id || !name || /^step\b/i.test(name) || /\/sequences\//.test(a.getAttribute("href")) || seen.has(id) || !visible(a)) continue;
    let row = a;
    for (let i = 0; i < 10 && row.parentElement; i++) {
      const ids = new Set([...row.parentElement.querySelectorAll('a[href*="/prospects/"]')].map((x) => pid(x.getAttribute("href") || "")).filter(Boolean));
      if (ids.size > 1) break;
      row = row.parentElement;
    }
    seen.add(id);
    const account = row.querySelector('a[href*="/accounts/"]');
    const seqLinks = [...row.querySelectorAll('a[href*="/sequences/"]')].map((x) => (x.innerText || "").trim());
    const rect = a.getBoundingClientRect();
    const shown = (a.checkVisibility ? a.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true) && !a.closest('[aria-hidden="true"], [hidden], [inert]');
    rows.push({
      top: Math.round(rect.top),
      onScreen: shown && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth,
      url: a.href,
      fullName: name,
      company: (account?.innerText || "").trim(),
      stepText: seqLinks.find((t) => /^step\b/i.test(t)) || "",
      sequence: seqLinks.find((t) => t && !/^step\b/i.test(t)) || "",
      mailto: [...row.querySelectorAll('a[href^="mailto:"]')].map((m) => m.getAttribute("href").slice(7).split("?")[0])[0] || "",
      text: (row.innerText || "").trim().slice(0, 1500),
    });
  }

  return {
    isTop: window === window.top,
    url: location.href,
    editorTop: (() => {
      const e = editors.sort((a, b) => area(b) - area(a))[0];
      return e ? Math.round(e.getBoundingClientRect().top) : null;
    })(),
    rows,
    labels,
    mailtos,
    subject: subjectEl?.value || "",
    body: editor ? (editor.tagName === "TEXTAREA" ? editor.value : editor.innerText) : "",
    bodyArea: editor ? area(editor) : 0,
    text: (document.body?.innerText || "").slice(0, 12000),
  };
}

// claude.ai: sends the message that pasteIntoClaude put in the box.
export function submitClaude() {
  const btn = [...document.querySelectorAll("button")].find(
    (b) => /send/i.test(b.getAttribute("aria-label") || "") && !b.disabled
  );
  if (btn) {
    btn.click();
    return true;
  }
  const box = document.querySelector('[contenteditable="true"]') || document.querySelector("textarea");
  if (!box) return false;
  box.focus();
  box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  return true;
}

// Any page: the visible text of this frame (for reading a prospect's history).
export function readFrameText() {
  return { isTop: window === window.top, url: location.href, text: (document.body?.innerText || "").slice(0, 20000) };
}

// Outreach prospect page: opens the tab that lists past activity, if there is one.
export function openActivityTab() {
  const want = /^(activity|activities|emails?|history|timeline|engagement|mailings)$/i;
  const el = [...document.querySelectorAll('a, button, [role="tab"]')].find(
    (e) => want.test((e.innerText || "").trim()) && e.getBoundingClientRect().width > 0
  );
  if (!el) return false;
  el.click();
  return true;
}

// claude.ai: what's still sitting in the message box (empty once sent).
export function claudeComposerText() {
  const box =
    document.querySelector('div[contenteditable="true"].ProseMirror') ||
    document.querySelector('[contenteditable="true"][role="textbox"]') ||
    document.querySelector('div[contenteditable="true"]') ||
    document.querySelector("textarea");
  if (!box) return null;
  return (box.tagName === "TEXTAREA" ? box.value : box.innerText).trim();
}

// Focuses the on-screen subject field and selects its text, ready for real typing.
export function focusSubject() {
  const el = [...document.querySelectorAll("input")].find((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight &&
      /subject/i.test([i.name, i.placeholder, i.id, i.getAttribute("aria-label"), i.getAttribute("data-testid")].join(" "));
  });
  if (!el) return false;
  el.focus();
  el.select();
  return true;
}

// Value of the on-screen subject field (to confirm typing landed).
export function subjectText() {
  const el = [...document.querySelectorAll("input")].find((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 0 && r.right > 0 && r.left < innerWidth && /subject/i.test([i.name, i.placeholder, i.id, i.getAttribute("aria-label")].join(" "));
  });
  return el ? el.value : null;
}

// Writes text to the clipboard from this (focused) tab. Clipboard only: the
// page itself is not touched.
export async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Focuses the on-screen email editor and selects everything ABOVE your
// signature (never the signature itself), ready for typing or a paste to
// replace it. Selection only: the editor's content isn't changed.
// Signature start, in order: a signature element in the editor, the
// "Signature starts with" line from Settings, a "First Last" line for your
// first name, or the unsubscribe line.
// Returns { found, signature, how, breaks } where breaks = Enter presses to
// add after the new text so it sits on its own, one blank line above the signature.
export function selectEditorBody(signatureLine, firstName) {
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    const shown = el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
    return shown && r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const isSubject = (el) => /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label")].join(" "));
  const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA") && !isSubject(el) && onScreen(el);
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  let ed = editable(active) ? active : null;
  if (!ed) {
    const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
    ed = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')].filter(editable).sort((a, b) => area(b) - area(a))[0];
  }
  while (ed?.parentElement?.isContentEditable) ed = ed.parentElement;
  if (!ed) return { found: false };
  ed.focus();

  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [];
  if (signatureLine && signatureLine.trim()) patterns.push({ how: "your signature line", re: new RegExp(signatureLine.trim().split(/\s+/).map(esc).join("\\s+"), "i") });
  if (firstName && firstName.trim()) patterns.push({ how: "your full name", re: new RegExp(`(^|\\n)[ \\t]*${esc(firstName.trim())}[ \\t]+[A-Z][\\w'’-]+[ \\t]*(?=\\n|$)`) });
  patterns.push({ how: "the unsubscribe line", re: /(^|\n)[^\n]*(stop sending you emails|unsubscribe|opt[ -]?out)/i });
  patterns.push({ how: "a -- line", re: /(^|\n)[ \t]*--[ \t]*(?=\n|$)/ });

  // Plain textarea: select from the top to where the signature starts.
  if (ed.tagName === "TEXTAREA") {
    const v = ed.value;
    for (const p of patterns) {
      const m = p.re.exec(v);
      if (m) {
        const at = m.index + (m[1] ? m[1].length : 0);
        ed.setSelectionRange(0, at);
        return { found: true, signature: true, how: p.how, breaks: 2 };
      }
    }
    ed.select();
    return { found: true, signature: false, breaks: 0 };
  }

  // Rich editor: map the text to its text nodes.
  const nodes = [];
  let full = "";
  const blockish = /^(P|DIV|LI|TR|TABLE|BLOCKQUOTE|H[1-6]|BR|UL|OL|SECTION)$/;
  const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      if (blockish.test(n.tagName) && full && !full.endsWith("\n")) full += "\n";
      continue;
    }
    nodes.push({ node: n, start: full.length });
    full += n.textContent;
  }
  const textNodes = nodes.filter((x) => x.node.textContent.length);

  // Signature start as (text node, offset).
  let sig = null;
  const marker = ed.querySelector('[class*="signature" i], [id*="signature" i], [data-signature], .gmail_signature');
  if (marker) {
    const first = nodes.find((x) => marker.contains(x.node));
    if (first) sig = { node: first.node, offset: 0, how: "Outreach's signature block" };
  }
  if (!sig) {
    for (const p of patterns) {
      const m = p.re.exec(full);
      if (!m) continue;
      const at = m.index + (m[1] ? m[1].length : 0);
      const hit = [...nodes].reverse().find((x) => x.start <= at && x.node.textContent.length + x.start > at) ||
        nodes.find((x) => x.start >= at);
      if (hit) {
        sig = { node: hit.node, offset: Math.max(0, at - hit.start), how: p.how };
        break;
      }
    }
  }

  const sel = window.getSelection();
  const range = document.createRange();
  if (!sig) {
    document.execCommand("selectAll", false, null); // no signature found: replace everything
    return { found: true, signature: false, breaks: 0 };
  }
  // Everything before the signature, ending inside the last text node before it
  // (so the signature keeps its own line instead of merging with the email).
  const before = textNodes.filter((x) => x.node !== sig.node && x.node.compareDocumentPosition(sig.node) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (sig.offset > 0) {
    const firstNode = before[0]?.node || sig.node;
    range.setStart(firstNode, 0);
    range.setEnd(sig.node, sig.offset);
    sel.removeAllRanges();
    sel.addRange(range);
    return { found: true, signature: true, how: sig.how, breaks: 2 };
  }
  if (!before.length) {
    // Nothing above the signature: put the cursor right before it.
    range.setStart(sig.node, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return { found: true, signature: true, how: sig.how, breaks: 2 };
  }
  const last = before[before.length - 1].node;
  // Is there already an empty line between the old text and the signature?
  // If so, keep it and don't add another.
  const gap = document.createRange();
  gap.setStart(last, last.textContent.length);
  gap.setEnd(sig.node, sig.offset);
  const spacer = gap.cloneContents().querySelectorAll("br").length > 0;
  range.setStart(before[0].node, 0);
  range.setEnd(last, last.textContent.length);
  sel.removeAllRanges();
  sel.addRange(range);
  return { found: true, signature: true, how: sig.how, breaks: spacer ? 0 : 1 };
}
