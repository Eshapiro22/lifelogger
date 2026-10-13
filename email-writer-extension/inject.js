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

    editor.focus();
    document.execCommand("selectAll", false, null); // selection only; no content change
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
