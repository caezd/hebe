// animations/lines.js
import { ensureEase } from "./presets.js";

const qsa = (root, sel) => root.querySelectorAll(sel);

export function animateLinesIn(root = document, onDone) {
    const ease = ensureEase();
    if (!window.gsap || !ease) {
        onDone?.();
        return;
    }
    const tl = gsap.timeline({ ease, onComplete: onDone });
    qsa(root, ".bb").forEach((el, i) =>
        tl.to(el, { width: "100%", duration: 0.2, delay: i * 0.03 }, "h")
    );
    qsa(root, ".br").forEach((el, i) =>
        tl.to(el, { height: "100%", duration: 0.2, delay: i * 0.03 }, "v")
    );
    qsa(root, ".bl").forEach((el, i) =>
        tl.to(el, { height: "100%", duration: 0.2, delay: i * 0.03 }, "v")
    );
    qsa(root, ".bt").forEach((el, i) =>
        tl.to(el, { width: "100%", duration: 0.2, delay: i * 0.03 }, "h")
    );
    qsa(root, ".bg-hash-v").forEach((el, i) =>
        tl.to(el, { width: "100%", duration: 0.4 }, "h")
    );
    return tl;
}

export function animateLinesOut(root = document, onDone) {
    const ease = ensureEase();
    if (!window.gsap || !ease) {
        onDone?.();
        return;
    }
    const tl = gsap.timeline({ ease, onComplete: onDone });
    qsa(root, ".br").forEach((el, i) =>
        tl.to(
            el,
            {
                top: i % 2 ? 0 : "+=100%",
                height: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "v"
        )
    );
    qsa(root, ".bl").forEach((el, i) =>
        tl.to(
            el,
            {
                top: i % 2 ? 0 : "+=100%",
                height: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "v"
        )
    );
    qsa(root, ".bb").forEach((el, i) =>
        tl.to(
            el,
            {
                left: i % 2 ? 0 : "+=100%",
                width: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "h"
        )
    );
    qsa(root, ".bg-hash-v").forEach((el, i) =>
        tl.to(el, { width: "0%", duration: 0.4 }, "h")
    );
    return tl;
}
