// init/barba.js
import Context from "../core/context.js";
import { animateLinesIn, animateLinesOut } from "../animations/lines.js";
import {
    navigationAnimation,
    contentsIn,
    contentsOut,
} from "../animations/navigation.js";

import Badge from "../ui/Badge.js";

const CFG = {
    CONTAINER_SEL: 'section[data-barba="container"]',
    PROGRESS_PATH_SEL: ".progress-wrap path",
};

let _initialized = false;
const _nsHooks = new Map();

function rebindProgressPath(nextContainer, cursor) {
    if (!cursor || !cursor.progressPath) return;
    const nextPath = nextContainer?.querySelector?.(CFG.PROGRESS_PATH_SEL);
    if (nextPath) cursor.progressPath = nextPath;
    try {
        const len = cursor.pathLength();
        cursor.progressPath.style.strokeDasharray = `${len} ${len}`;
        cursor.updateProgress();
    } catch {}
}

export function onNamespace(ns, handlers) {
    _nsHooks.set(ns, { ...(handlers || {}) });
}

export function initBarba({ cursor } = {}) {
    if (_initialized) return { destroy };
    _initialized = true;

    if (!window.barba?.init) {
        console.warn(
            "[barba] introuvable. Charge @barba/core avant initBarba()."
        );
        const root = document.querySelector(CFG.CONTAINER_SEL) || document;
        Context.container = root;
        animateLinesIn(root, () => navigationAnimation(root));
        return { destroy };
    }

    Context.container = document.querySelector(CFG.CONTAINER_SEL) || document;

    const menu = document.getElementById("menu");
    const host = menu?.querySelector(".notification");
    const notificationBadge = new Badge(host);

    barba.init({
        prevent: ({ el }) => el?.hasAttribute?.("data-barba-prevent"),
        transitions: [
            {
                name: "lines-and-reveal",

                beforeOnce(data) {
                    const done = this.async();
                    const ns = data?.next?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    try {
                        h?.beforeOnce?.(data);
                    } catch (e) {
                        console.error("[barba:beforeOnce ns]", e);
                    }
                    animateLinesIn(data.next.container, done);
                    notificationBadge.set(5);
                },

                once(data) {
                    console.debug("[barba] once ns=", data?.next?.namespace);

                    // 🔗 appeler les hooks namespace au premier load
                    const ns = data?.next?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    try {
                        h?.once?.(data); // si tu en as un
                        h?.afterEnter?.(data); // mime afterEnter au 1er load
                    } catch (e) {
                        console.error("[barba:once ns hook]", e);
                    }

                    // fade-in de tes .content/.contents (inchangé)
                    const done = this.async();
                    const contents = data.next.container.querySelectorAll(
                        ".content, .contents"
                    );
                    if (contents.length) {
                        gsap.to(contents, {
                            alpha: 1,
                            stagger: 0.03,
                            onComplete: done,
                        });
                    } else {
                        done();
                    }
                },

                before(data) {
                    const ns = data?.current?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    try {
                        h?.before?.(data);
                    } catch (e) {
                        console.error("[barba:before ns]", e);
                    }

                    const done = this.async();
                    const tl = contentsOut(data.current.container, {
                        onComplete: done,
                    });
                    if (!tl) done();
                },

                async leave(data) {
                    const ns = data?.current?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    if (h?.leave) {
                        try {
                            await h.leave(data);
                        } catch (e) {
                            console.error("[barba:leave]", e);
                        }
                    }
                    const done = this.async();
                    animateLinesOut(data.current.container, done);
                },

                async enter(data) {
                    console.debug("[barba] enter ns=", data?.next?.namespace);
                    Context.container = data.next.container;
                    rebindProgressPath(data.next.container, cursor);

                    const ns = data?.next?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    if (h?.enter) {
                        try {
                            await h.enter(data);
                        } catch (e) {
                            console.error("[barba:enter]", e);
                        }
                    }

                    const done = this.async();
                    animateLinesIn(data.next.container, () => {
                        navigationAnimation(data.next.container);
                        done();
                    });
                },

                afterEnter(data) {
                    console.debug(
                        "[barba] afterEnter ns=",
                        data?.next?.namespace
                    );

                    const ns = data?.next?.namespace;
                    const h = ns ? _nsHooks.get(ns) : null;
                    try {
                        h?.afterEnter?.(data);
                    } catch (e) {
                        console.error("[barba:afterEnter]", e);
                    }

                    const done = this.async();
                    const tl = contentsIn(data.next.container, {
                        onComplete: done,
                    });
                    if (!tl) done();
                },
            },
        ],
    });

    return { destroy };
}

export function getRegisteredNamespaces() {
    return Array.from(_nsHooks.keys());
}

function destroy() {
    try {
        if (barba && barba.destroy) barba.destroy();
    } catch {}
    _nsHooks.clear();
    _initialized = false;
}
