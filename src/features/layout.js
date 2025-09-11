import { qs, qsa } from "../core/utils.js";
import {
    navigationAnimation,
    getGlobalTimeline,
    clearGlobal,
    mapAnimation,
} from "../animations/navigation.js";

import { createMapController } from "../ui/MapController.js";

const els = {
    menuButton: qs(document, "#menu"),
    panel: qs(document, "#board"),
    cursor: qs(document, "#cursor"),
    cursorFollow: qs(document, "#cursorFollow"),
    mapPanel: qs(document, "#mapPanel"),
};

export function initLayoutScripts(opts = {}) {
    // MAP
    const mapCtrl = createMapController({
        animations: { mapAnimation, getGlobalTimeline },
    });
    // Hooks Barba (optionnels si tu utilises Barba)
    if (window.barba?.hooks) {
        barba.hooks.beforeLeave(() => {
            try {
                mapCtrl.close();
            } catch {}
        });
    }

    return {
        destroy() {
            mapCtrl.destroy();
        },
        closeAll() {
            mapCtrl.close();
        },
    };

    initMap();
}

function page_type() {
    const p = location.pathname;
    if (/^\/t[1-9][0-9]*(p[1-9][0-9]*)?-/.test(p)) return "topic";
    if (/^\/f[1-9][0-9]*(p[1-9][0-9]*)?-/.test(p)) return "forum";
    if (
        document
            .querySelector("#i_icon_mini_index")
            ?.parentElement?.getAttribute("href") === p ||
        p === "/"
    )
        return "index";
    if (/^\/post/.test(p)) return "editor";
    if (/^\/c[1-9][0-9]*-/.test(p)) return "category";
    const qs = p + location.search;
    const m = qs.match(/\/modcp\?mode=([^&]+)/);
    return m ? m[1] : "";
}

async function defaultFetchForums() {
    if (page_type() === "index") {
        const el = document.querySelector("#js-board");
        if (el) el.innerHTML = "";
    }
    const res = await fetch("/");
    const html = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
}

function initMap() {
    const trigger = qs(document, "#navigate");
    const panel = qs(document, "#map");

    async function onClick(e) {
        e.preventDefault();

        // Si une timeline est active, on ferme (reverse) comme dans menu.js
        const tl =
            (typeof getGlobalTimeline === "function" && getGlobalTimeline()) ||
            null;
        if (tl) {
            trigger.classList.remove("active");
            tl.timeScale(2).reverse(); // fermeture accélérée
            return;
        }

        // Ouverture
        try {
            trigger.classList.add("active");

            // Lance tes anims d'ouverture (doit définir window.globalTimeline en interne)
            mapAnimation();
        } catch (err) {
            console.error("[HomeMenu] fetch/open error:", err);
        }
    }

    trigger.addEventListener("click", onClick);

    const map = new maplibregl.Map({
        style: `http://127.0.0.1:8080/dark_matter.json`,
        center: [4.905115848796186, 52.36171966529636], // Amsterdam
        zoom: 12.64072662255258,
        pitch: 45,
        bearing: -17.6,
        container: document.querySelector("#map-content"),
        canvasContextAttributes: { antialias: true },
        attributionControl: false,
        maxBounds: [
            [4.737470306116194, 52.31534775089125],
            [5.00319881008906, 52.4543176657192],
        ],
    });

    map.on("load", () => panel.classList.remove("onLoad"));

    if (!map) return;

    map.on("mousemove", (e) => {
        // j'ai besoin d'avoir les coordonnées latitutde/longitude du point sous le curseur
        const coords = e.lngLat;
        console.log(`Longitude: ${coords.lng}, Latitude: ${coords.lat}`);
        els.cursor.dataset.coords = `${coords.lng.toFixed(
            5
        )}, ${coords.lat.toFixed(5)}`;
    });

    map.on("click", (e) => {
        const t = e.originalEvent?.target;
        if (t && t.closest(".marker, .maplibregl-marker, .mapboxgl-marker"))
            return;
        const popup = new maplibregl.Popup({ offset: 25 }).setText(
            "Construction on the Washington Monument began in 1848."
        );

        /* else, open side panel */
        console.log("click map", e.lngLat);
        els.mapPanel.classList.add("active");

        // create DOM element for the marker
        const el = document.createElement("div");
        el.className = "marker";
        el.innerHTML = `<div class="marker-label">Frankfurt</div><div class='marker-pulse'></div>`;

        /* ["click", "pointerdown", "pointerup", "mousedown", "mouseup"].forEach(
            (evt) => el.addEventListener(evt, (ev) => ev.stopPropagation())
        ); */

        // create the marker
        new maplibregl.Marker({ element: el })
            .setLngLat(e.lngLat)
            .setPopup(popup) // sets a popup on this marker
            .addTo(map);
    });
}
