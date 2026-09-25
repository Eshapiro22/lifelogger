// Functions injected into the page with chrome.scripting.executeScript. Each one
// must be self-contained: executeScript serializes the function source, so
// nothing from this module's scope is available inside it.

// Runs in every frame. Reports what this frame can offer so the side panel can
// pick where to write the subject and the body.
export function probeFrame() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
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
    focusedEditor: editable(active) && (active.isContentEditable || active.tagName === "TEXTAREA"),
    editorArea: area,
    isTop: window === window.top,
  };
}

// Writes the subject into the first visible subject input in this frame.
export function fillSubject(subject) {
  const el = [...document.querySelectorAll("input")].find(
    (i) =>
      i.getBoundingClientRect().width > 0 &&
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
export function fillBody(body) {
  const isSubject = (el) =>
    /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label")].join(" "));
  const editable = (el) => el && (el.isContentEditable || el.tagName === "TEXTAREA") && !isSubject(el);
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;

  let editor = editable(active) ? active : null;
  if (!editor) {
    const cands = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')]
      .filter((el) => el.getBoundingClientRect().width > 0 && editable(el));
    editor = cands.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0];
  }
  if (!editor) return false;
  // Climb to the editor root so we replace all of it, not one paragraph.
  while (editor.parentElement?.isContentEditable) editor = editor.parentElement;

  if (editor.tagName === "TEXTAREA") {
    editor.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(editor, body);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = body
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const probe = body.trim().slice(0, 25);
  const landed = () => editor.innerText.replace(/\s+/g, " ").includes(probe.replace(/\s+/g, " "));

  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const dt = new DataTransfer();
  dt.setData("text/html", html);
  dt.setData("text/plain", body);
  const paste = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
  const unhandled = editor.dispatchEvent(paste);
  if (!unhandled && landed()) return true;

  sel.removeAllRanges();
  range.selectNodeContents(editor);
  sel.addRange(range);
  document.execCommand("insertHTML", false, html);
  if (landed()) return true;

  editor.innerHTML = html;
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  return landed();
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
  const blocks = [...document.querySelectorAll("pre")].map((el) => el.innerText).reverse();
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
    name: /^(name|full name|prospect|prospect name|contact)$/i,
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
      if (value && value.length <= 120) labels[key] = value;
    }
  }
  const mailtos = [...document.querySelectorAll('a[href^="mailto:"]')]
    .map((a) => decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]))
    .filter(Boolean);

  const isSubject = (el) =>
    /subject/i.test([el.name, el.placeholder, el.id, el.getAttribute("aria-label"), el.getAttribute("data-testid")].join(" "));
  const subjectEl = [...document.querySelectorAll("input")].find((el) => visible(el) && isSubject(el));
  const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""], textarea')]
    .filter((el) => visible(el) && !isSubject(el) && !el.parentElement?.closest('[contenteditable="true"]'));
  const area = (el) => el.getBoundingClientRect().width * el.getBoundingClientRect().height;
  const editor = editors.sort((a, b) => area(b) - area(a))[0];

  return {
    isTop: window === window.top,
    url: location.href,
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
