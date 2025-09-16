// Glossary.js — aside de définitions pour <abbr>
// Export par défaut façon "controller": Glossary.init(...)

const defaults = {
    url: null, // URL du JSON (prioritaire si fourni)
    data: null, // Objet JSON inline (fallback si pas d’URL)
    selector: "dfn[data-def],dfn[title]", // sur quels éléments brancher
    container: "#faq-dfn",
    position: "anchor", // 'dock' | 'anchor'
    anchorPlacement: "top", // 'auto' | 'right' | 'left' | 'bottom' | 'top'
    anchorOffset: 0,
    hashParam: null, // ex. 'def' => #def=TERM ouvre directement
    observeBarba: true, // rescanner après transitions Barba
    prefetchOnHover: true,
    hoverDelay: 80,
};

const state = {
    opts: { ...defaults },
    dict: null, // Map normalisée: key → entry
    aside: null,
    backdrop: null,
    content: null,
    isOpen: false,
    lastTrigger: null,
    focusBeforeOpen: null,
    hoverTimer: null,
};

// $ / $$ tolérants: $(sel) ou $(root, sel)
const $ = (...args) =>
    args.length === 1
        ? document.querySelector(args[0])
        : args[0]?.querySelector?.(args[1]);
const $$ = (...args) =>
    args.length === 1
        ? Array.from(document.querySelectorAll(args[0]))
        : Array.from(args[0]?.querySelectorAll?.(args[1]) || []);

const normalize = (raw) => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
        const out = {};
        raw.forEach((x) => {
            if (x && x.key) out[String(x.key)] = x;
        });
        return out;
    }
    return raw; // déjà map clé → entrée
};

const getRootEl = () => {
    const c = state.opts.container;
    return c && c.nodeType ? c : typeof c === "string" ? $(c) : document.body;
};

const positionAside = (trigger) => {
    if (!state.aside || !trigger || state.opts.position !== "anchor") return;

    state.aside.classList.add("anchored"); // active le mode ancré
    const root = getRootEl();
    const rootRect = root.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    const trContainer = trigger.parentElement;
    const cr = trContainer.getBoundingClientRect();

    const asideRect = state.aside.getBoundingClientRect();
    const asideContainer = state.aside.offsetParent;
    const ar = asideContainer.getBoundingClientRect();

    // première mesure

    // pour la position anchored, il faudrait calculer la hauteur depuis le document, puis la hauteur relative à son container à la fois du trigger et de l'aside
    const space = {
        top: tr.top - ar.top - cr.height,
        right: tr.right - ar.left + state.opts.anchorOffset,
        bottom: tr.bottom - ar.top - (tr.height + asideRect.height) / 2,
        left: tr.left - ar.left - (asideRect.width + state.opts.anchorOffset),
    };

    state.aside.style.top = `${space.top}px`;
};

const fetchDict = async () => {
    if (state.dict) return state.dict;
    const { url, data } = state.opts;
    if (url) {
        const res = await fetch(url, {
            cache: "no-store",
            credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Glossary JSON HTTP " + res.status);
        state.dict = normalize(await res.json());
    } else if (data) {
        state.dict = normalize(data);
    } else {
        state.dict = {};
    }
    console.log(state);
    return state.dict;
};

const escapeHTML = (s = "") =>
    s.replace(
        /[&<>"']/g,
        (m) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[m])
    );

const toFocusable = () =>
    $$(
        state.aside,
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    ).filter((el) => !el.hasAttribute("disabled"));

const trapFocus = (e) => {
    if (!state.isOpen) return;
    const nodes = toFocusable();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } else if (e.key === "Escape") {
        close();
    }
};

const createUI = () => {
    if (state.aside) return;
    const aside = document.createElement("aside");
    aside.className = "glossary-aside";
    aside.setAttribute("role", "dialog");
    aside.setAttribute("aria-modal", "true");
    aside.setAttribute("aria-labelledby", "glossary-title");

    const backdrop = document.createElement("div");
    backdrop.className = "glossary-backdrop";

    aside.innerHTML = `
    <header class="glossary-header">
        <h3 id="glossary-title"></h3>
        <button class="glossary-close btn" aria-label="Fermer"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </header>
    <div class="glossary-body" id="glossary-body" tabindex="-1"></div>
    <footer class="glossary-footer" hidden></footer>
  `;

    $(state.opts.container).appendChild(backdrop);
    $(state.opts.container).appendChild(aside);

    state.aside = aside;
    state.backdrop = backdrop;
    state.content = $(state.aside, "#glossary-body");

    backdrop.addEventListener("click", close);
    $(state.aside, ".glossary-close").addEventListener("click", close);
    document.addEventListener("keydown", trapFocus, true);
};

const renderEntry = (key, entry) => {
    const title = entry.title || key;
    const short = entry.short
        ? `<p class="glossary-short">${entry.short}</p>`
        : "";
    const long = entry.long
        ? `<div class="glossary-long">${entry.long}</div>`
        : "";
    const tags =
        Array.isArray(entry.tags) && entry.tags.length
            ? `<ul class="glossary-tags">${entry.tags
                  .map((t) => `<li>#${escapeHTML(String(t))}</li>`)
                  .join("")}</ul>`
            : "";
    const links =
        Array.isArray(entry.links) && entry.links.length
            ? `<ul class="glossary-links">${entry.links
                  .map(
                      (l) =>
                          `<li><a target="_blank" rel="noopener" href="${escapeHTML(
                              l.href
                          )}">${escapeHTML(l.label || l.href)}</a></li>`
                  )
                  .join("")}</ul>`
            : "";

    $(state.aside, "#glossary-title").textContent = title;
    /* $(state.aside, ".glossary-sub").textContent =
        (entry.abbr && entry.abbr.join(", ")) || ""; */
    state.content.innerHTML = `${short}${long}${tags}${links}`;

    state.aside.dispatchEvent(
        new CustomEvent("glossary:render", { detail: { key, entry } })
    );
};

const open = async (key, trigger) => {
    state.focusBeforeOpen = document.activeElement;
    state.lastTrigger = trigger || null;
    createUI();

    const dict = await fetchDict().catch((err) => {
        console.error("[Glossary] JSON error", err);
        return {};
    });
    const entry = dict[key] || null;

    if (!entry) {
        renderEntry(key, {
            title: key,
        });
    } else {
        renderEntry(key, entry);
    }

    requestAnimationFrame(() => positionAside(trigger));

    state.aside.classList.add("open");
    state.backdrop.classList.add("open");
    state.isOpen = true;

    const focusTarget =
        $(state.aside, "#glossary-body") || $(state.aside, ".glossary-close");
    requestAnimationFrame(() => focusTarget && focusTarget.focus());

    if (state.opts.hashParam) {
        const url = new URL(location.href);
        url.hash = `${state.opts.hashParam}=${encodeURIComponent(key)}`;
        history.replaceState(null, "", url.toString());
    }

    state._reflow = () => positionAside(state.lastTrigger);
    window.addEventListener("resize", state._reflow);
    window.addEventListener("scroll", state._reflow, true);
    state.aside.dispatchEvent(
        new CustomEvent("glossary:open", { detail: { key, entry } })
    );
};

const close = () => {
    if (!state.isOpen) return;
    state.aside.classList.remove("open");
    state.backdrop.classList.remove("open");
    state.isOpen = false;

    if (
        state.opts.hashParam &&
        location.hash.includes(state.opts.hashParam + "=")
    ) {
        const url = new URL(location.href);
        url.hash = "";
        history.replaceState(null, "", url.toString());
    }

    const toFocus = state.lastTrigger || state.focusBeforeOpen;
    if (toFocus && typeof toFocus.focus === "function") toFocus.focus();

    state.aside.dispatchEvent(new CustomEvent("glossary:close"));
};

const onAbbrClick = (e) => {
    e.preventDefault();
    const el = e.currentTarget;
    const key = el.getAttribute("data-def") || el.getAttribute("title");
    if (el.getAttribute("title")) {
        el.removeAttribute("title");
        el.setAttribute("data-def", key);
    }
    if (!key) return;
    open(key, el);
};

const onAbbrKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
    }
};

const bindOne = (el) => {
    if (el.__glBound) return;
    console.log(el);
    el.__glBound = true;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.addEventListener("click", onAbbrClick);
    el.addEventListener("keydown", onAbbrKey);

    const key = el.getAttribute("data-def") || el.getAttribute("title");
    if (el.getAttribute("title")) {
        el.removeAttribute("title");
        el.setAttribute("data-def", key);
    }

    if (state.opts.prefetchOnHover && state.opts.url) {
        el.addEventListener("mouseenter", () => {
            clearTimeout(state.hoverTimer);
            state.hoverTimer = setTimeout(() => {
                fetchDict().catch((e) => {
                    console.warn(e);
                });
            }, state.opts.hoverDelay);
        });
        el.addEventListener("mouseleave", () => clearTimeout(state.hoverTimer));
    }
};

const scan = (root = document) => {
    console.log($$(root, state.opts.selector));
    $$(root, state.opts.selector).forEach(bindOne);
};

const fromHash = () => {
    if (!state.opts.hashParam) return;
    const h = (location.hash || "").slice(1);
    const [k, v] = h.split("=");
    if (k === state.opts.hashParam && v) open(decodeURIComponent(v));
};

const Glossary = {
    init(options = {}) {
        state.opts = { ...defaults, ...options };
        createUI();
        scan(document);
        fromHash();
        console.log("[Glossary] initialized", state);
        if (state.opts.observeBarba && "addEventListener" in document) {
            document.addEventListener("barba:after", () => scan(document));
        }
        return { open, close, scan };
    },
    open,
    close,
    scan,
};

export default Glossary;
