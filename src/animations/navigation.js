// animations/navigation.js
import { he, ensureEase } from "./presets.js";
import { qsa, qs } from "../core/utils.js";

// ✅ timeline globale déclarée
let globalTimeline = null;

export const getGlobalTimeline = () => globalTimeline;
export const setGlobalTimeline = (tl) => (globalTimeline = tl);
export const clearGlobal = () => {
    globalTimeline = null;
};

const has = (list) => list && list.length > 0;

export function mapAnimation({ container }) {
    const ease = ensureEase();
    if (!window.gsap || !ease) return null;

    const root = qs(document, "#map");
    try {
        globalTimeline?.kill();
    } catch {}

    const tl = gsap.timeline({
        defaults: { duration: 1, ease },
        onReverseComplete: () => {
            clearGlobal();
            container.classList.add("onLoad");
        },
    });

    const i = qsa(root, ".anim-bg-cover");
    const r = qsa(root, ".anim-bg");
    const o = qsa(root, ".anim-fade");
    const p = qsa(root, ".anim-fadeFromLeft-50");
    const l = qsa(root, ".anim-fadeUp");
    const width = qsa(root, ".anim-bb, .anim-bt");
    const height = qsa(root, ".anim-br, .anim-bl");

    const ft = (targets, fromVars, toVars, pos) => {
        if (!has(targets)) return tl;
        return pos !== undefined
            ? tl.fromTo(targets, fromVars, toVars, pos)
            : tl.fromTo(targets, fromVars, toVars);
    };

    ft(i, he.coverFrom, he.coverTo);
    ft(i, he.coverExitFrom, he.coverExitTo, 0.7);
    ft(r, he.coverFrom, he.coverTo, 0.7);
    ft(o, he.fadeFrom, { ...he.fadeTo, stagger: 0.033 }, 1.7);
    ft(width, he.growWidthFrom, { ...he.growWidthTo, stagger: 0.033 }, 1.7);
    ft(height, he.growHeightFrom, { ...he.growHeightTo, stagger: 0.033 }, 1.7);

    setGlobalTimeline(tl);
    return tl;
}

export function navigationAnimation() {}

export function contentsIn(root = document, opts = {}) {
    const items = root.querySelectorAll(".content, .contents");
    if (!items || items.length === 0) return null; // évite le warning GSAP si vide
    return gsap.to(items, {
        alpha: 1,
        stagger: 0.03,
        ...opts,
    });
}

export function contentsOut(root = document, opts = {}) {
    const items = root.querySelectorAll(".content, .contents");
    if (!items || items.length === 0) return null;
    return gsap.to(items, {
        alpha: 0,
        stagger: 0.03,
        ...opts,
    });
}
