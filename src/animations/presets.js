// animations/presets.js
export const easeCurve = "M0,0,C0.625,0,0,1,1,1";

let _ease = null;
export function ensureEase() {
    if (!window.gsap) return null;
    if (_ease) return _ease;
    try {
        if (window.CustomEase) {
            gsap.registerPlugin(CustomEase);
            _ease =
                gsap.parseEase?.("custom") ||
                CustomEase.create("custom", easeCurve);
        }
    } catch {}
    if (!_ease) _ease = "power4.out"; // fallback discret
    return _ease;
}

export const he = {
    coverFrom: { transform: "scaleX(0)" },
    coverTo: { transform: "scaleX(1)" },
    coverExitFrom: { left: 0, width: "100%" },
    coverExitTo: { left: "100%", width: "0%" },
    fadeFrom: { autoAlpha: 0 },
    fadeTo: { autoAlpha: 1 },
    fadeUpFrom: { autoAlpha: 0, transform: "translateY(20px)" },
    fadeUpTo: { autoAlpha: 1, transform: "translateY(0)" },
    growHeightFrom: { height: "0%" },
    growHeightTo: { height: "100%" },
    growWidthFrom: { width: "0%" },
    growWidthTo: { width: "100%" },
    fadeFromLeft50From: { autoAlpha: 0, transform: "translateX(-50%)" },
    fadeFromLeft50To: { autoAlpha: 1, transform: "translateX(0)" },
};
