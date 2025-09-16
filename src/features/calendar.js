const CFG = {
    baseUrl: "/calendar",
    param: "start", // /calendar?start=YYYYMMDD
    containerSel: ".calendar__container",
    yearBlockSel: ".calendar__year",
    yearTitleSel: "h2",
    yearDlSel: "article > dl",
    eventSel: ".calendar__event",
    maxInitialPreviousYears: 5, // préchargement initial max
    maxTotalYears: 20, // plafond global (sécurité)
    rootMarginIO: "800px 0px", // déclenchement anticipé
};

/* ========= CACHE ========= */
const YEAR_CACHE = {
    key: (y) => `calendar.timeline.year.${y}`,
    ttlMs: 3 * 60 * 60 * 1000, // 3h

    read(y) {
        try {
            return JSON.parse(localStorage.getItem(this.key(y)));
        } catch {
            return null;
        }
    },
    write(y, events) {
        const payload = {
            version: 1,
            updatedAt: Date.now(),
            checkedAt: Date.now(),
            events,
        };
        localStorage.setItem(this.key(y), JSON.stringify(payload));
        return payload;
    },
    isStale(y) {
        const c = this.read(y);
        if (!c) return true;
        return Date.now() - (c.checkedAt || 0) > this.ttlMs;
    },
    touch(y) {
        const c = this.read(y) || {};
        c.checkedAt = Date.now();
        localStorage.setItem(this.key(y), JSON.stringify(c));
    },
};

const YEAR_REFRESH = new Map(); // y -> timeoutId

// --- Kill switch Barba (minimale) ---
export const CalendarKill = {
    active: false,
    container: null,
    io: null,
    sentinel: null,

    activate(container) {
        this.active = true;
        this.container = container || document;
    },
    kill() {
        this.active = false;

        // 1) couper l'observer d'infinite scroll
        if (this.io) {
            try {
                this.io.disconnect();
            } catch {}
            this.io = null;
        }

        // 2) retirer le sentinel (évite de relancer l’IO via layout)
        if (this.sentinel?.parentNode) {
            this.sentinel.remove();
        }
        this.sentinel = null;

        // 3) stopper tous les refresh timers (Map existante)
        for (const [, id] of YEAR_REFRESH) clearTimeout(id);
        YEAR_REFRESH.clear();

        // (optionnel) oublier le container
        this.container = null;
    },
};

// normalisation des events stockés (léger, trié)
const normalizeEvents = (events) =>
    events
        .map(({ ts, label, title, href, meta }) => ({
            ts,
            label,
            title,
            href,
            meta,
        }))
        .sort((a, b) => a.ts - b.ts);

// comparaison rapide cache vs frais (clé = année+label+href)
const _evKey = (y, e) => `${y}::${e.label}::${e.href || ""}`;
const sameEventSet = (y, a = [], b = []) => {
    if (a.length !== b.length) return false;
    const A = new Set(a.map((e) => _evKey(y, e)));
    for (const e of b) if (!A.has(_evKey(y, e))) return false;
    return true;
};
/* ======== /CACHE ======== */

const pad2 = (n) => String(n).padStart(2, "0");
const toStart = (y, m) => `${y}${pad2(m)}01`;

const $ = (root, sel) => root.querySelector(sel);
const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
const htmlToDoc = (html) => new DOMParser().parseFromString(html, "text/html");

const getContainer = () => $(document, CFG.containerSel) || document.body;

function extractOverviewHtmlFromAttr(attr) {
    if (!attr) return null;
    // essaie d'abord la version '...' puis "..."
    let m = attr.match(/createTitle\(\s*this\s*,\s*'([\s\S]*?)'\s*,/);
    if (!m) m = attr.match(/createTitle\(\s*this\s*,\s*"([\s\S]*?)"\s*,/);
    if (!m) return null;

    // dé-échappe les quotes JS \', \"
    let s = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    return s;
}
function parseOverviewMeta(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    const titleName =
        wrap.querySelector(".title-overview")?.textContent?.trim() || "";

    const author = (() => {
        const p = Array.from(wrap.querySelectorAll("p")).find((el) =>
            /Auteur\s*:/.test(el.textContent)
        );
        if (!p) return "";
        const txt = p.textContent.replace(/\s+/g, " ").trim();
        const m = txt.match(/Auteur\s*:\s*([^|<\n\r]+)/i);
        return m ? m[1].trim() : "";
    })();

    const linkedDateText = (() => {
        const p = Array.from(wrap.querySelectorAll("p")).find((el) =>
            /Sujets\s+liés\s*:/.test(el.textContent)
        );
        if (!p) return "";
        const txt = p.textContent.replace(/\s+/g, " ").trim();
        const m = txt.match(/Sujets\s+liés\s*:\s*(.+)$/i);
        return m ? m[1].trim() : "";
    })();

    const excerpt = wrap.querySelector("#msg_ov")?.textContent?.trim() || "";

    return { titleName, author, linkedDateText, excerpt };
}
function escapeHtml(s) {
    const span = document.createElement("span");
    span.textContent = s ?? "";
    return span.innerHTML;
}

const yearNow = () => new Date().getFullYear();

const getLoadedYears = () =>
    $$(getContainer(), `${CFG.yearBlockSel} ${CFG.yearTitleSel}`)
        .map((h2) => Number(h2.textContent.trim()))
        .filter((y) => !Number.isNaN(y))
        .sort((a, b) => a - b);

const getYearBlock = (y) =>
    $$(getContainer(), CFG.yearBlockSel).find(
        (b) => $(b, CFG.yearTitleSel)?.textContent.trim() === String(y)
    ) || null;

function ensureYearBlock(y) {
    let block = getYearBlock(y);
    if (block) return block;

    block = document.createElement("div");
    block.className = "calendar__year grid grid--ratioReversed hasLines";
    block.innerHTML = `
    <hr class="br" style="height: 100%;">
    <h2>${y}</h2>
    <article><dl></dl></article>
  `;

    const container = getContainer();
    const sentinel = container.querySelector(
        '[data-cal-sentinel-bottom="true"]'
    );

    // ✅ garde le sentinel tout en bas : on insère l'année juste avant lui
    if (sentinel) {
        container.insertBefore(block, sentinel);
    } else {
        container.appendChild(block);
    }
    return block;
}

const getYearDl = (y) => $(ensureYearBlock(y), CFG.yearDlSel);

// clé anti-doublon : année + jour/mois + href sujet
const eventKey = (y, label, href) => `${y}::${label}::${href || ""}`;

// --- parsing d’un .calendar__event ---
function parseEventNode(evNode) {
    // 1) ancre "scheduler" pour la date (timestamp ?d=...)
    const dateA = evNode.querySelector(".calendar-day-date");

    // 2) **seulement** le lien de sujet /t[ID]-slug
    const topicA = Array.from(evNode.querySelectorAll("a")).find((a) =>
        /^\/t\d+-/i.test(a.getAttribute("href") || "")
    );

    if (!topicA) return null; // ignore "—" ou autres liens non /t…

    // --- timestamp ---
    let ts = null;
    if (dateA) {
        try {
            const u = new URL(dateA.getAttribute("href"), location.origin);
            const d = u.searchParams.get("d");
            if (d) ts = Number(d) * 1000;
        } catch {}
    }
    if (!ts && dateA) {
        const txt = dateA.textContent.trim(); // ex "Sam 13 Sep 2025"
        const guessed = Date.parse(txt.replace(/^[A-Za-zéûç]+\s+/i, "")); // retire "Sam "
        if (!Number.isNaN(guessed)) ts = guessed;
    }
    if (!ts) return null;

    const d = new Date(ts);
    const year = d.getFullYear();
    const label = `${String(d.getDate()).padStart(2, "0")}.${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

    const href = topicA.getAttribute("href") || "";
    const title = (topicA.textContent || "").trim();

    // --- meta depuis onmouseover / onmousemove ---
    const mouseAttr =
        topicA.getAttribute("onmouseover") ||
        topicA.getAttribute("onmousemove") ||
        "";
    let meta = null;
    const overviewHtml = extractOverviewHtmlFromAttr(mouseAttr);
    if (overviewHtml) {
        meta = parseOverviewMeta(overviewHtml); // { titleName, author, linkedDateText, excerpt }
    }

    return { ts, year, label, title, href, meta };
}

// --- collecte des événements d’un document (page en cours ou fetch mensuel) ---
function collectEventsFromDoc(doc) {
    return $$(doc, CFG.eventSel)
        .map(parseEventNode)
        .filter(Boolean)
        .sort((a, b) => a.ts - b.ts);
}

// --- injection dans <dl> d’une année ---
function appendEventsToYear(y, events, seenSet) {
    if (!events.length) return;
    const article = $(ensureYearBlock(y), "article");
    const dl = document.createElement("dl");

    for (const e of events) {
        const key = eventKey(y, e.label, e.href);
        console.log(e);
        if (seenSet.has(key)) continue;
        seenSet.add(key);

        const dt = document.createElement("dt");
        dt.textContent = e.label;

        const dd = document.createElement("dd");
        if (e.href) {
            const a = document.createElement("a");
            a.href = e.href;
            a.textContent = e.title || e.href;
            dd.appendChild(a);
        } else {
            dd.textContent = e.title || "—";
        }

        dl.append(dt, dd);
    }

    if (dl.childNodes.length) article.appendChild(dl);
}

function replaceYearEvents(y, events) {
    const block = ensureYearBlock(y);
    let article = block.querySelector("article");
    if (!article) {
        article = document.createElement("article");
        block.appendChild(article);
    }
    // on repart propre : 1 seul <dl>
    article.innerHTML = "";
    const dl = document.createElement("dl");

    for (const e of events) {
        const dt = document.createElement("dt");
        dt.textContent = e.label;

        const dd = document.createElement("dd");
        if (e.href) {
            const a = document.createElement("a");
            a.href = e.href;
            a.textContent = e.title || e.href;
            dd.appendChild(a);
        } else {
            dd.textContent = e.title || "—";
        }
        dl.append(dt, dd);
    }

    article.appendChild(dl);
}

function indexSeenForYear(y) {
    const seen = new Set();
    const block = getYearBlock(y);
    if (!block) return seen;
    const dl = $(block, CFG.yearDlSel);
    if (!dl) return seen;

    // reconstitue les clés existantes
    let curDt = null;
    for (const node of Array.from(dl.children)) {
        if (node.tagName === "DT") {
            curDt = node.textContent.trim();
        } else if (node.tagName === "DD" && curDt) {
            const href = node.querySelector("a")?.getAttribute("href") || "";
            seen.add(eventKey(y, curDt, href));
        }
    }
    return seen;
}

// --- fetch d’un mois (YYYY, MM) et renvoi des events (filtrés par année) ---
async function fetchMonthEvents(y, m) {
    const url = `${CFG.baseUrl}?${CFG.param}=${toStart(y, m)}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return [];
    const doc = htmlToDoc(await res.text());
    return collectEventsFromDoc(doc).filter((e) => e.year === y);
}

async function fetchYearEvents(y) {
    const collected = [];
    const seen = new Set();
    for (let m = 1; m <= 12; m++) {
        const evs = await fetchMonthEvents(y, m);
        for (const e of evs) {
            const k = `${y}::${e.label}::${e.href || ""}`;
            if (seen.has(k)) continue;
            seen.add(k);
            collected.push(e);
        }
    }
    collected.sort((a, b) => a.ts - b.ts);
    return collected;
}

async function loadYearUsingCacheFirst(y) {
    ensureYearBlock(y);

    // 1) affichage immédiat depuis cache si dispo
    const cached = YEAR_CACHE.read(y);
    if (cached?.events?.length) {
        replaceYearEvents(y, cached.events);
    }

    // 2) réseau → diff → mise à jour DOM + cache si changement
    const fresh = await fetchYearEvents(y);
    const needUpdate = !cached || !sameEventSet(y, cached.events, fresh);

    if (needUpdate) {
        replaceYearEvents(y, fresh);
        YEAR_CACHE.write(y, normalizeEvents(fresh));
    } else {
        YEAR_CACHE.touch(y);
    }

    // 3) planifie le rafraîchissement 3h
    scheduleYearRefresh(y);

    return getYearBlock(y);
}

async function refreshYear(y) {
    // si l'année n'est pas dans le DOM, on zappe
    if (!getYearBlock(y)) return;

    if (!YEAR_CACHE.isStale(y)) return;

    const cached = YEAR_CACHE.read(y);
    const fresh = await fetchYearEvents(y);
    const needUpdate = !cached || !sameEventSet(y, cached.events, fresh);

    if (needUpdate) {
        replaceYearEvents(y, fresh);
        YEAR_CACHE.write(y, normalizeEvents(fresh));
    } else {
        YEAR_CACHE.touch(y);
    }
}

function scheduleYearRefresh(y) {
    const prev = YEAR_REFRESH.get(y);
    if (prev) clearTimeout(prev);
    const id = setTimeout(async () => {
        try {
            if (!CalendarKill.active) return;
            await refreshYear(y);
        } finally {
            if (CalendarKill.active) scheduleYearRefresh(y);
        }
    }, YEAR_CACHE.ttlMs);
    YEAR_REFRESH.set(y, id);
}

// --- initialisation : range les events de la page en cours dans l’année actuelle ---
function seedFromCurrentPage() {
    const curY = yearNow();
    ensureYearBlock(curY);

    const pageEvents = collectEventsFromDoc(document).filter(
        (e) => e.year === curY
    );
    const seen = indexSeenForYear(curY);
    appendEventsToYear(curY, pageEvents, seen);

    // ✅ cache + refresh pour l’année courante
    YEAR_CACHE.write(curY, normalizeEvents(pageEvents));
    scheduleYearRefresh(curY);
}

// --- précharge jusqu’à 5 années précédentes, ou stop si la dernière dépasse le viewport ---
async function preloadPreviousYearsUntilFilled() {
    const curY = yearNow();
    let added = 0;
    let y = curY - 1;

    while (added < CFG.maxInitialPreviousYears) {
        const block = await loadYearUsingCacheFirst(y); // <-- ici
        added++;

        if (block) {
            const rect = block.getBoundingClientRect();
            const overflows = rect.bottom > window.innerHeight - 20;
            if (overflows) break;
        }
        y--;
    }
}

function isSentinelVisible(sentinel) {
    const r = sentinel.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
}

function getOldestLoadedYear() {
    const years = getLoadedYears(); // triés croissant
    return years.length ? years[0] : yearNow();
}

async function raf() {
    return new Promise((res) => requestAnimationFrame(res));
}

// Charge une année la plus ancienne manquante (oldest - 1)
async function loadNextOldestYear() {
    const oldest = getOldestLoadedYear();
    const target = oldest - 1;
    if (getLoadedYears().length >= CFG.maxTotalYears) return false;
    await loadYearUsingCacheFirst(target); // <-- ici
    return true;
}

function setupBottomInfiniteAutoFill() {
    if (!CalendarKill.active) return;
    const container = getContainer();

    let sentinel = container.querySelector('[data-cal-sentinel-bottom="true"]');
    if (!sentinel) {
        sentinel = document.createElement("div");
        sentinel.setAttribute("data-cal-sentinel-bottom", "true");
        sentinel.style.cssText = "height:1px;";
        container.appendChild(sentinel);
    }

    let busy = false;

    const io = new IntersectionObserver(
        async (entries) => {
            if (!CalendarKill.active) return;
            const entry = entries[0];
            if (!entry || !entry.isIntersecting || busy) return;

            busy = true;
            try {
                // 🔁 tant que visible → on charge l’année suivante (plus ancienne)
                // + on yield pour laisser le layout se recalculer
                while (
                    isSentinelVisible(sentinel) &&
                    getLoadedYears().length < CFG.maxTotalYears
                ) {
                    const ok = await loadNextOldestYear();
                    // s’il n’y a plus rien à charger, on sort
                    if (!ok) break;

                    // le sentinel doit rester en dernier
                    if (
                        sentinel.parentNode !== container ||
                        container.lastElementChild !== sentinel
                    ) {
                        container.appendChild(sentinel);
                    }
                    await raf(); // laisse le DOM se re-peindre avant de re-tester la visibilité
                }
            } finally {
                busy = false;
            }
        },
        { root: null, rootMargin: "800px 0px", threshold: 0 }
    );

    io.observe(sentinel);
    // ➜ enregistrer dans la kill switch
    CalendarKill.io = io;
    CalendarKill.sentinel = sentinel;
}

// --- boot ---
export async function initTimelineCalendar() {
    seedFromCurrentPage(); // 1) range les events courants dans l’année en cours
    await preloadPreviousYearsUntilFilled(); // 2) charge jusqu’à 5 années précédentes ou jusqu’à remplir
    setupBottomInfiniteAutoFill(); // 3) infinite scroll pour la suite des années
}
