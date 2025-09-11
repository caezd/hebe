import { isElement, closest } from "../core/utils.js";

const CONFIG = {
    FOLLOW_SIZE: 40,
    EASE: "power4",
    DUR: {
        focus: 0.5, // zoom sur l'élément
        shrink: 0.2, // retour à la taille 40
        follow: 0.6, // inertie de suivi
        fade: 300, // show/hide via Element.animate
    },
    SELECTORS: {
        text: ".txt, .txt *, .ce-block__content, .ce-block__content *, textarea, input",
        forum: ".forum, .forum *",
        btn: ".btn, .btn *",
        profileSymbol: ".subject__profileSymbol",
        barbaContainer: 'section[data-barba="container"]',
        progressPath: ".progress-wrap path",
        cursor: "#cursor",
        cursorFollow: "#cursorFollow",
        postbody: ".postbody",
        forumEl: ".forum",
        link: "a[href]:not(.no-cursor):not(:where(.btn *)):not(.btn), a[href]:not(.no-cursor):not(:where(.btn *)) *, .marker, .marker *",
        map: "#map canvas",
    },
};

function getRectData(el) {
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

function setOpacity(el, value) {
    el.animate(
        { opacity: value },
        { duration: CONFIG.DUR.fade, fill: "forwards" }
    );
}

const CursorController = {
    // ------- refs & state -------
    cursor: document.querySelector(CONFIG.SELECTORS.cursor),
    cursorFollow: document.querySelector(CONFIG.SELECTORS.cursorFollow),
    postbody: document.querySelectorAll(CONFIG.SELECTORS.postbody),
    progressPath: document.querySelector(CONFIG.SELECTORS.progressPath),
    forums: document.querySelectorAll(CONFIG.SELECTORS.forumEl),

    stopFollow: false,

    // ------- API -------
    init() {
        this.bindEvents();
        this.bindScroll();
    },

    // ------- events -------
    bindEvents() {
        document.addEventListener("mouseenter", () => {
            setOpacity(this.cursor, 1);
            setOpacity(this.cursorFollow, 1);
        });

        document.addEventListener("mouseleave", () => {
            setOpacity(this.cursor, 0);
            setOpacity(this.cursorFollow, 0);
        });

        document.addEventListener("mousemove", (e) => {
            const { pageX: leftPosition, pageY: topPosition, target } = e;

            if (!(target instanceof Element)) return;

            // position du pointeur "avant-plan"
            this.cursor.style.left = leftPosition + "px";
            this.cursor.style.top = topPosition + "px";

            // badges visuels (texte / oeil)
            this.updateCursorBadges(target);

            // branchements exacts de l'original
            if (target.matches(CONFIG.SELECTORS.btn)) {
                this.handleBtnFocus(target);
            } else if (target.matches(CONFIG.SELECTORS.profileSymbol)) {
                this.handleProfileSymbolFocus(target);
            } else {
                this.resetFollowSize();
            }

            // suivre la souris si non figé
            if (!this.stopFollow) {
                this.cursorFollow.classList.remove("static");
                this.cursor.classList.remove("hide");
                gsap.to(this.cursorFollow, {
                    top: topPosition,
                    left: leftPosition,
                    duration: CONFIG.DUR.follow,
                    ease: CONFIG.EASE,
                });
            }
        });

        // progress sur scroll (container Barba)
        document.addEventListener(
            "scroll",
            (e) => {
                if (e.target.dataset.barba === "container") {
                    this.updateProgress();
                }
            },
            true
        );

        document.addEventListener(
            "pointerleave",
            (e) => {
                if (!(e.target instanceof Element)) return;

                const host = e.target.closest(".btn, .subject__profileSymbol");
                if (!host) return;
                // si on quitte l'élément mais qu'on reste dans un de ses enfants => on ne fait rien
                if (host.contains(e.relatedTarget)) return;

                // on force le retour à l'état "follow" même si la souris ne bouge plus
                this.stopFollow = false;

                // retirer tout de suite les classes qui modifient le border-radius
                this.cursorFollow.classList.remove("static", "large");
                this.cursor.classList.remove("hide", "grow");

                // arrêter l'animation en cours pour éviter les états mixtes
                gsap.killTweensOf(this.cursorFollow);
                gsap.killTweensOf(this.cursor);

                // revenir à la taille d'origine ; la position sera gérée par le prochain mousemove
                gsap.to(this.cursorFollow, {
                    width: 40,
                    height: 40,
                    duration: 0.5,
                    ease: "circ.out",
                });
            },

            true
        );
    },

    // ------- helpers souris -------
    updateCursorBadges(target) {
        // .text
        if (target.matches(CONFIG.SELECTORS.text)) {
            this.cursor.classList.add("text");
        } else {
            this.cursor.classList.remove("text");
        }

        // .eye
        if (target.matches(CONFIG.SELECTORS.forum)) {
            this.cursor.classList.add("eye");
        } else {
            this.cursor.classList.remove("eye");
        }

        if (target.matches(CONFIG.SELECTORS.link)) {
            this.cursor.classList.add("grow");
            this.cursorFollow.classList.add("large");
        } else {
            this.cursor.classList.remove("grow");
            this.cursorFollow.classList.remove("large");
        }

        if (target.matches(CONFIG.SELECTORS.map)) {
            this.cursor.classList.add("crosshair");
            this.cursorFollow.classList.add("shrink");
        } else {
            this.cursor.classList.remove("crosshair");
            this.cursorFollow.classList.remove("shrink");
        }
    },

    handleBtnFocus(target) {
        this.stopFollow = true;
        const element = target.closest(".btn");
        const { x, y, w, h } = getRectData(element);

        this.cursorFollow.classList.add("static");

        gsap.to(this.cursorFollow, {
            top: y + h / 2,
            left: x + w / 2,
            width: w,
            height: h,
            duration: CONFIG.DUR.focus,
            ease: CONFIG.EASE,
        });
    },

    handleProfileSymbolFocus(target) {
        this.stopFollow = true;
        const element = target.closest(".subject__profileSymbol");
        const { x, y, w, h } = getRectData(element);

        // NB: fidèle à l’original — pas d'ajout de .static / .hide ici
        gsap.to(this.cursorFollow, {
            top: y + h / 2,
            left: x + w / 2,
            width: w,
            height: h,
            duration: CONFIG.DUR.focus,
            ease: CONFIG.EASE,
        });
    },

    resetFollowSize() {
        this.stopFollow = false;
        gsap.to(this.cursorFollow, {
            width: CONFIG.FOLLOW_SIZE,
            height: CONFIG.FOLLOW_SIZE,
            duration: CONFIG.DUR.shrink,
            ease: CONFIG.EASE,
        });
    },

    // ------- scroll progress -------
    bindScroll() {
        if (!this.progressPath) return; // garde-fou
        const len = this.pathLength();
        this.progressPath.style.strokeDasharray = `${len} ${len}`;
        this.updateProgress();
    },

    currentContainer() {
        return document.querySelector(CONFIG.SELECTORS.barbaContainer);
    },

    updateProgress() {
        if (!this.progressPath) return;
        const container = this.currentContainer();
        if (!container) return;

        const scroll = container.scrollTop;
        const height = container.scrollHeight - window.innerHeight;
        const progress =
            this.pathLength() - (scroll * this.pathLength()) / height;
        this.progressPath.style.strokeDashoffset = progress;
    },

    // ------- computed -------
    pathLength() {
        return this.progressPath.getTotalLength();
    },
};
export default CursorController;
