// CursorController.js — nécessite GSAP (global `gsap` ou passé via options.gsap)

export default class CursorController {
    constructor(opts = {}) {
        console.log("[CursorController] Initialisation…");
        const DEFAULTS = {
            cursorSel: "#cursor",
            followSel: "#cursorFollow",
            progressPathSel: ".progress-wrap path", // optionnel
            scrollContainerSel: 'section[data-barba="container"]', // null si pas de conteneur scrollable
            baseSize: 40,
            ease: "power4",
            focusSelectors: [".btn", ".subject__profileSymbol"], // éléments à encadrer
            textSelectors: [
                ".txt",
                ".txt *",
                ".ce-block__content",
                ".ce-block__content *",
            ],
            eyeSelectors: [".forum", ".forum *"],
            releaseDelayMs: 90, // hystérésis sortie
            durFocus: 0.45, // zoom vers l'élément
            durRelease: 0.22, // shrink retour à base
            durFollow: 0.55, // inertie du suivi souris
            focusRootClass: "cursor-focus", // classe posée sur <html> pendant le focus
            toggleFocusClassOnRoot: true, // masque/fige des UI (ex: progress) en focus
            gsap: typeof window !== "undefined" ? window.gsap : null,
        };

        this.o = { ...DEFAULTS, ...opts };
        this.gsap = this.o.gsap;
        if (!this.gsap) {
            console.warn("[CursorController] GSAP n'est pas disponible.");
        }

        // Refs DOM
        this.cursor = this._$(this.o.cursorSel);
        this.follow = this._$(this.o.followSel);
        this.progressPath = this._$(this.o.progressPathSel) || null;
        this.scrollContainer = this._$(this.o.scrollContainerSel) || null;

        // États
        this.stopFollow = false; // true pendant focus (encadrage)
        this.isReleasing = false; // true pendant le shrink retour
        this._focusedEl = null; // host actuellement encadré
        this.releaseTimer = null; // timer d'hystérésis
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Garde-fous
        if (!this.cursor || !this.follow) {
            console.warn(
                "[CursorController] Sélecteurs cursor/follow introuvables."
            );
            return;
        }

        // Bind
        this._bindBasics();
        this._bindFocus();
        this._bindProgress();
    }

    // ---------- Public ----------
    destroy() {
        // À compléter si tu veux détacher les listeners dynamiquement
    }

    // ---------- Private ----------
    _$(sel, root = document) {
        return sel ? root.querySelector(sel) : null;
    }
    _anyMatches(target, selectors) {
        return selectors.some((s) => target.matches(s));
    }
    _closestFocus(target) {
        if (!target || !this.o.focusSelectors?.length) return null;
        return target.closest(this.o.focusSelectors.join(", "));
    }

    _bindBasics() {
        // Opacité show/hide
        document.addEventListener("mouseenter", () => {
            this.cursor.animate(
                { opacity: 1 },
                { duration: 300, fill: "forwards" }
            );
            this.follow.animate(
                { opacity: 1 },
                { duration: 300, fill: "forwards" }
            );
        });
        document.addEventListener("mouseleave", () => {
            this.cursor.animate(
                { opacity: 0 },
                { duration: 300, fill: "forwards" }
            );
            this.follow.animate(
                { opacity: 0 },
                { duration: 300, fill: "forwards" }
            );
        });

        // Suivi souris : on mémorise toujours la position
        document.addEventListener(
            "mousemove",
            (e) => {
                this.lastMouseX = e.pageX;
                this.lastMouseY = e.pageY;

                // Le pointeur avant-plan
                this.cursor.style.left = this.lastMouseX + "px";
                this.cursor.style.top = this.lastMouseY + "px";

                // Décors (facultatifs)
                if (this._anyMatches(e.target, this.o.textSelectors)) {
                    this.cursor.classList.add("text");
                } else {
                    this.cursor.classList.remove("text");
                }
                if (this._anyMatches(e.target, this.o.eyeSelectors)) {
                    this.cursor.classList.add("eye");
                } else {
                    this.cursor.classList.remove("eye");
                }

                // Déplacement de la bulle de suivi uniquement hors focus/release
                if (!this.stopFollow && !this.isReleasing && this.gsap) {
                    this.gsap.to(this.follow, {
                        top: this.lastMouseY,
                        left: this.lastMouseX,
                        duration: this.o.durFollow,
                        ease: this.o.ease,
                    });
                }
            },
            { passive: true }
        );
    }

    _bindFocus() {
        const capture = true;

        // Entrée focus (pointerenter > plus fiable quand transforms/overlays)
        document.addEventListener(
            "pointerenter",
            (e) => {
                if (this.isReleasing) return; // pas de nouveau focus pendant le shrink retour
                const host = this._closestFocus(e.target);
                if (!host) return;
                this._focusElement(host);
            },
            capture
        );

        // Sortie focus (avec hystérésis)
        document.addEventListener(
            "pointerleave",
            (e) => {
                const host = this._closestFocus(e.target);
                if (!host) return;

                // si on quitte le host mais on reste dans un de ses enfants : ignore
                if (host.contains(e.relatedTarget)) return;

                clearTimeout(this.releaseTimer);
                this.releaseTimer = setTimeout(() => {
                    // si un autre focus a été pris entre-temps, ne pas relâcher celui-ci
                    if (this._focusedEl && this._focusedEl !== host) return;
                    this._releaseFocus();
                }, this.o.releaseDelayMs);
            },
            capture
        );
    }

    _focusElement(host) {
        if (!host) return;
        if (this._focusedEl === host) return;

        clearTimeout(this.releaseTimer);
        this._focusedEl = host;
        this.stopFollow = true;

        // Classe root pour masquer/figer des UI (progress, etc.)
        if (this.o.toggleFocusClassOnRoot) {
            document.documentElement.classList.add(this.o.focusRootClass);
        }

        this.follow.classList.add("static");
        this.cursor.classList.add("hide");

        if (this.gsap) {
            this.gsap.killTweensOf(this.follow);

            const rect = host.getBoundingClientRect();
            const { x, y } = this._rectCenterWithScroll(rect);

            this.gsap.to(this.follow, {
                top: y,
                left: x,
                width: rect.width,
                height: rect.height,
                duration: this.o.durFocus,
                ease: this.o.ease,
            });
        }
    }

    _releaseFocus() {
        if (!this._focusedEl || !this.gsap) return;

        // On reste figé pendant le shrink (ne PAS remettre stopFollow / classes maintenant)
        this.isReleasing = true;

        this.gsap.killTweensOf(this.follow);

        // Évite un "saut" : rattache d’abord la bulle sous la souris
        this.gsap.set(this.follow, {
            top: this.lastMouseY,
            left: this.lastMouseX,
        });

        this.gsap.to(this.follow, {
            width: this.o.baseSize,
            height: this.o.baseSize,
            duration: this.o.durRelease,
            ease: this.o.ease,
            onComplete: () => {
                // Shrink terminé → on désactive le focus et on réactive le follow
                this._focusedEl = null;
                this.stopFollow = false;

                this.follow.classList.remove("static");
                this.cursor.classList.remove("hide");

                if (this.o.toggleFocusClassOnRoot) {
                    document.documentElement.classList.remove(
                        this.o.focusRootClass
                    );
                }

                // recoller immédiatement sous la souris
                this.gsap.set(this.follow, {
                    top: this.lastMouseY,
                    left: this.lastMouseX,
                });

                this.isReleasing = false;
            },
        });
    }

    _rectCenterWithScroll(rect) {
        // Si un conteneur scrollable est utilisé (e.g. Barba)
        if (this.scrollContainer) {
            const sc = this.scrollContainer;
            const scRect = sc.getBoundingClientRect();
            const x = rect.left - scRect.left + sc.scrollLeft + rect.width / 2;
            const y = rect.top - scRect.top + sc.scrollTop + rect.height / 2;
            return { x, y };
        }
        // Sinon, coordonnées page
        return {
            x: rect.left + window.pageXOffset + rect.width / 2,
            y: rect.top + window.pageYOffset + rect.height / 2,
        };
    }

    // ---------- Progress (optionnel) ----------
    _bindProgress() {
        if (!this.progressPath) return;

        const length = this._pathLength(this.progressPath);
        this.progressPath.style.strokeDasharray = `${length} ${length}`;
        this._updateProgress();

        const onScroll = (e) => {
            if (!this.scrollContainer) {
                this._updateProgress();
            } else if (e.target === this.scrollContainer) {
                this._updateProgress();
            }
        };

        if (this.scrollContainer) {
            this.scrollContainer.addEventListener("scroll", onScroll, {
                passive: true,
            });
        } else {
            document.addEventListener("scroll", onScroll, { passive: true });
        }
    }

    _pathLength(path) {
        try {
            return path.getTotalLength();
        } catch {
            return 0;
        }
    }

    _updateProgress() {
        if (!this.progressPath) return;
        const pathLen = this._pathLength(this.progressPath);
        const t = this._scrollTop();
        const denom = Math.max(this._scrollHeight() - this._viewportH(), 1);
        const progress = pathLen - (t * pathLen) / denom;
        this.progressPath.style.strokeDashoffset = progress;
    }

    _scrollTop() {
        if (this.scrollContainer) return this.scrollContainer.scrollTop;
        return window.pageYOffset || document.documentElement.scrollTop || 0;
    }
    _scrollHeight() {
        if (this.scrollContainer) return this.scrollContainer.scrollHeight;
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );
    }
    _viewportH() {
        if (this.scrollContainer) return this.scrollContainer.clientHeight;
        return window.innerHeight || document.documentElement.clientHeight || 0;
    }
}
