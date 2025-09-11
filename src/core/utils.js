export const isElement = (node) =>
    node instanceof Element || node instanceof HTMLDocument;

export const qsa = (root, sel) => root.querySelectorAll(sel);
export const qs = (root, sel) => root.querySelector(sel);

export const closest = (el, sel) =>
    el && el.nodeType === 1 ? el.closest(sel) : null;
