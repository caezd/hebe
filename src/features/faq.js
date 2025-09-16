// faq.js — refactor, accessible & resilient
// --------------------------------------
// - Works standalone or with Context.container (keeps your pattern)
// - Robust DOM guards; no hard crashes if a piece is missing
// - Keyboard navigation (←/→, Home/End) with proper ARIA roles
// - Hash deep-link (#<data-id>) support without scroll jump
// - Resize-aware: slider repositions and container height adapts to dynamic content
// - Public API: goTo(id|index), next(), prev(), destroy()

import Context from "../core/context.js";
import { getGlobalTimeline } from "../animations/navigation.js";

/**
 * @typedef {Object} FAQOptions
 * @property {HTMLElement} [container] - root container (defaults to Context.container)
 * @property {boolean} [updateHash] - update URL hash when switching tabs
 * @property {number} [duration] - animation duration in ms
 */

export function initFAQScripts(/** @type {FAQOptions} */ opts = {}) {
    const updateHash = opts.updateHash ?? true;
    const DURATION = opts.duration ?? 500;

    // --- DOM nodes
    const root = opts.container || Context.container || document;
    const faq = root?.querySelector?.(".faq");
    if (!faq) {
        console.warn("[FAQ] .faq root not found");
        return blankAPI();
    }

    const slider = faq.querySelector(".faq__tab-slider") || createSlider(faq);
    const scroller = faq.querySelector(".faq__scroll");
    const panels = Array.from(faq.querySelectorAll(".faq__content"));
    const tabs = Array.from(faq.querySelectorAll(".faq__tab"));
    const container = faq.querySelector(".faq__container") || faq;
    const tablist = slider?.parentElement || tabs[0]?.parentElement || faq;

    if (!scroller || !tabs.length || !panels.length) {
        console.warn("[FAQ] Missing pieces: ", {
            scroller: !!scroller,
            tabs: tabs.length,
            panels: panels.length,
        });
        return blankAPI();
    }

    // Normalize indexes & ids
    tabs.forEach((t, i) => {
        if (!t.dataset.idx) t.dataset.idx = String(i);
        if (!t.id) t.id = `faq-tab-${i}`;
        t.setAttribute("role", "tab");
        t.setAttribute("tabindex", "-1");
        t.setAttribute("aria-selected", "false");
    });
    panels.forEach((p, i) => {
        p.setAttribute("role", "tabpanel");
        p.setAttribute("aria-labelledby", tabs[i]?.id || `faq-tab-${i}`);
    });
    tablist?.setAttribute?.("role", "tablist");

    // State
    let activeIndex = 0;
    let ro = null; // ResizeObserver on current panel
    let destroyed = false;

    // --- helpers
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const difference = (a, b) => Math.abs(a - b);

    function createSlider(faq) {
        const s = document.createElement("div");
        s.className = "faq__tab-slider";
        faq.querySelector(".faq__tabs")?.appendChild(s) || faq.appendChild(s);
        return s;
    }

    function getTabBox(el) {
        const target = el.parentElement || el; // supports <li><button.faq__tab></button></li>
        return { left: target.offsetLeft, width: target.offsetWidth };
    }

    function moveSliderTo(el, wideJump = false) {
        if (!slider || !el) return;

        const { left: toLeft, width: toWidth } = getTabBox(el);

        // mesures “from”
        const fromLeft = Number.parseFloat(slider.style.left || 0) || 0;
        const fromWidth =
            Number.parseFloat(slider.style.width || 0) ||
            getTabBox(tabs[activeIndex])?.width ||
            toWidth;

        // 1) timeline injectée > 2) timeline globale > 3) gsap global > 4) WAAPI > 5) styles
        let tl = null;
        try {
            tl =
                injectedTimeline && typeof injectedTimeline.to === "function"
                    ? injectedTimeline
                    : typeof getGlobalTimeline === "function"
                    ? getGlobalTimeline()
                    : null;
        } catch {
            tl = null;
        }

        const gs =
            window.gsap && typeof window.gsap.to === "function"
                ? window.gsap
                : null;
        const durationSec = DURATION / 1000;

        if (tl && typeof tl.to === "function") {
            // On évite la troisième arg “0” qui force l’insertion au début du TL.
            tl.to(slider, {
                left: `${toLeft}px`,
                width: `${toWidth}px`,
                ease: "power2.inOut",
                duration: durationSec,
                overwrite: "auto",
            });
        } else if (gs) {
            gs.to(slider, {
                left: `${toLeft}px`,
                width: `${toWidth}px`,
                ease: "power2.inOut",
                duration: durationSec,
                overwrite: "auto",
            });
        } else if (slider.animate) {
            // Fallback WAAPI
            const widths = wideJump
                ? [
                      `${fromWidth}px`,
                      `${Math.max(200, (fromWidth + toWidth) / 2)}px`,
                      `${toWidth}px`,
                  ]
                : [`${fromWidth}px`, `${toWidth}px`];
            const lefts = wideJump
                ? [`${fromLeft}px`, `${toLeft}px`, `${toLeft}px`]
                : [`${fromLeft}px`, `${toLeft}px`];

            slider.animate(
                { left: lefts, width: widths },
                {
                    duration: DURATION,
                    fill: "forwards",
                    easing: "cubic-bezier(0.4,0,0.2,1)",
                }
            );
            // pour les navigateurs sans WAAPI persistante
            slider.style.left = `${toLeft}px`;
            slider.style.width = `${toWidth}px`;
        } else {
            // Fallback styles direct
            slider.style.left = `${toLeft}px`;
            slider.style.width = `${toWidth}px`;
        }
    }

    function translateTo(idx) {
        scroller.style.transform = `translateX(${idx * -100}%)`;
    }

    function ensureHeight(idx) {
        const content = panels[idx]?.querySelector?.(".content") || panels[idx];
        if (!content) return;
        const h = Math.max(
            content.scrollHeight,
            content.getBoundingClientRect().height
        );
        container.style.height = `${h}px`;

        // Observe size changes of current panel
        if (ro) {
            try {
                ro.disconnect();
            } catch {}
        }
        if (window.ResizeObserver) {
            ro = new ResizeObserver(() => {
                const hh = Math.max(
                    content.scrollHeight,
                    content.getBoundingClientRect().height
                );
                container.style.height = `${hh}px`;
            });
            ro.observe(content);
        }
    }

    function setActive(index, sourceEl) {
        index = clamp(index, 0, tabs.length - 1);
        const prev = activeIndex;
        activeIndex = index;

        tabs.forEach((t, i) => {
            const isActive = i === index;
            t.classList.toggle("active", isActive);
            t.setAttribute("aria-selected", isActive ? "true" : "false");
            t.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        translateTo(index);
        ensureHeight(index);
        moveSliderTo(tabs[index], difference(prev, index) > 1);

        if (updateHash) {
            const id = tabs[index].dataset.id || `${index}`;
            const url = new URL(location.href);
            url.hash = id;
            history.replaceState(null, "", url); // no scroll jump
        }

        // keep focus on clicked tab for a11y
        if (sourceEl === true) tabs[index].focus();
    }

    // --- events
    function onTabClick(e) {
        const el = e.currentTarget;
        const idx = Number(el.dataset.idx || 0);
        setActive(idx, true);
    }

    function onKeydown(e) {
        const { key } = e;
        // Only handle keys if focus is within the tablist
        if (!tablist.contains(document.activeElement)) return;
        let idx = activeIndex;
        if (key === "ArrowRight") {
            idx = clamp(activeIndex + 1, 0, tabs.length - 1);
        } else if (key === "ArrowLeft") {
            idx = clamp(activeIndex - 1, 0, tabs.length - 1);
        } else if (key === "Home") {
            idx = 0;
        } else if (key === "End") {
            idx = tabs.length - 1;
        } else return;
        e.preventDefault();
        setActive(idx, true);
    }

    function onResize() {
        // Recompute slider position and container height for the active tab
        moveSliderTo(tabs[activeIndex], false);
        ensureHeight(activeIndex);
    }

    // Attach listeners
    tabs.forEach((t) => t.addEventListener("click", onTabClick));
    window.addEventListener("keydown", onKeydown, true);
    window.addEventListener("resize", onResize);

    // --- init view
    try {
        // initial from hash
        let startIndex = 0;
        if (window.location.hash) {
            const id = decodeURIComponent(window.location.hash.substring(1));
            const found = tabs.findIndex((el) => (el.dataset.id || "") == id);
            if (found >= 0) startIndex = found;
        }
        setActive(startIndex, false);
        slider?.classList.add("visible");
    } catch (e) {
        console.log("FAQ init error:", e);
    }

    // --- public API
    function goTo(target) {
        if (destroyed) return;
        if (typeof target === "number") setActive(target, true);
        else if (typeof target === "string") {
            const found = tabs.findIndex(
                (el) => (el.dataset.id || "") === target
            );
            if (found >= 0) setActive(found, true);
        }
    }
    function next() {
        goTo(activeIndex + 1);
    }
    function prev() {
        goTo(activeIndex - 1);
    }
    function destroy() {
        destroyed = true;
        tabs.forEach((t) => t.removeEventListener("click", onTabClick));
        window.removeEventListener("keydown", onKeydown, true);
        window.removeEventListener("resize", onResize);
        try {
            ro?.disconnect();
        } catch {}
    }

    return { goTo, next, prev, destroy };
}

function blankAPI() {
    return {
        goTo: () => {},
        next: () => {},
        prev: () => {},
        destroy: () => {},
    };
}
