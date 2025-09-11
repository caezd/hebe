// ui/Badge.js
// Badge compteur, fidèle à ton comportement, mais plus robuste à l'init.

export default class Badge {
    /**
     * @param {HTMLElement} element  hôte du badge (ex: #menu .notification)
     * @param {Object} options
     */
    constructor(element, options = {}) {
        this.options = {
            badgeClass: "notification-badge",
            badgeCounterClass: "notification-counter",
            animationSpeed: 150,
            countLimit: 99,
            activeClass: "notification-badge--active",
            limitClass: "notification-badge--limit",
            ...options,
        };

        if (!element) {
            console.error("[Badge] host element is null/undefined.");
            return; // no-op, évite les erreurs.
        }

        this.element = element;
        this.badgeElement = null;
        this.badgeCounterElement = null;

        // ✅ injecte/recâble systématiquement le markup
        this.renderIfNeeded();
    }

    /** Injecte le markup si absent et met à jour les refs */
    renderIfNeeded() {
        // cherche un wrapper existant
        let wrapper = this.element.querySelector("." + this.options.badgeClass);
        if (!wrapper) {
            wrapper = document.createElement("span");
            wrapper.className = this.options.badgeClass;
            wrapper.innerHTML = `<span class="${this.options.badgeCounterClass}">0</span>`;
            this.element.appendChild(wrapper);
        }
        this.badgeElement = wrapper;
        this.badgeCounterElement = wrapper.querySelector(
            "." + this.options.badgeCounterClass
        );
    }

    /** Active/désactive et swap la valeur avec petite anim */
    set(n = 0) {
        if (!this.element) return false;

        // ✅ s’assure que le DOM du badge est présent (au cas où Barba a réhydraté)
        this.renderIfNeeded();

        if (typeof n !== "number" || Number.isNaN(n) || n < 0) {
            console.error(`[Badge] invalid value: ${n}`);
            this.badgeElement?.classList.remove(this.options.activeClass);
            if (this.badgeCounterElement)
                this.badgeCounterElement.textContent = "";
            return false;
        }

        // n == 0 : on “éteint” visuellement
        if (n === 0) {
            this.badgeElement?.classList.remove(this.options.activeClass);
            if (this.badgeCounterElement)
                this.badgeCounterElement.textContent = "";
            return false;
        }

        // état "limit"
        if (n > this.options.countLimit) {
            this.badgeElement?.classList.add(this.options.limitClass);
        } else {
            this.badgeElement?.classList.remove(this.options.limitClass);
        }

        // activer si pas déjà
        if (
            this.badgeElement &&
            !this.badgeElement.classList.contains(this.options.activeClass)
        ) {
            this.badgeElement.classList.add(this.options.activeClass);
        }

        const oldEl = this.badgeCounterElement;
        if (!oldEl) return false;

        // si même valeur, assure juste l’état actif et sors
        if (String(oldEl.textContent).trim() === String(n)) {
            return true;
        }

        const newEl = oldEl.cloneNode(false);
        newEl.textContent = n;

        // petites classes d’anim (compatibles avec ton CSS)
        newEl.classList.add(this.options.badgeCounterClass + "--new");
        oldEl.classList.add(this.options.badgeCounterClass + "--old");

        oldEl.after(newEl);

        // déclenche l’anim au frame suivant puis nettoie
        requestAnimationFrame(() => {
            newEl.classList.remove(this.options.badgeCounterClass + "--new");
            setTimeout(() => {
                try {
                    oldEl.remove();
                } catch {}
                this.badgeCounterElement = newEl;
            }, this.options.animationSpeed);
        });

        return true;
    }

    get() {
        const n = parseInt(this.badgeCounterElement?.textContent || "0", 10);
        return Number.isNaN(n) ? 0 : n;
    }

    increase(n = 1) {
        return this.set(this.get() + n);
    }
    decrease(n = 1) {
        return this.set(Math.max(0, this.get() - n));
    }

    destroy() {
        if (!this.element) return;
        const wrap = this.element.querySelector("." + this.options.badgeClass);
        if (wrap) wrap.remove();
        this.badgeElement = null;
        this.badgeCounterElement = null;
        this.element = null;
    }
}
