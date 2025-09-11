import { qs } from "../core/utils.js";
import { getGlobalTimeline } from "../animations/navigation.js";
import { TopicController } from "./TopicController.js";

function rafThrottle(fn) {
    let ticking = false;
    return function throttled(...args) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            fn.apply(this, args);
            ticking = false;
        });
    };
}

function offsetBoundsByFraction(bounds, fx = 0, fy = 0) {
    const sw = bounds.getSouthWest(); // { lng, lat }
    const ne = bounds.getNorthEast();
    const dLng = (ne.lng - sw.lng) * fx; // fraction de largeur en LONGITUDE
    const dLat = (ne.lat - sw.lat) * fy; // fraction de hauteur en LATITUDE
    return new maplibregl.LngLatBounds(
        [sw.lng + dLng, sw.lat + dLat],
        [ne.lng + dLng, ne.lat + dLat]
    );
}

// decimal -> DMS (degrees, minutes, seconds) avec hémisphère
export function toDMS(value, type = "lat", precision = 4) {
    // type: "lat" ou "lon"
    const hemi =
        type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

    let v = Math.abs(Number(value));
    let d = Math.floor(v);
    let mFloat = (v - d) * 60;
    let m = Math.floor(mFloat);
    let s = (mFloat - m) * 60;

    // Arrondi + reports propres
    const p = Math.max(0, precision | 0);
    s = Number(s.toFixed(p));
    if (s >= 60) {
        s -= 60;
        m += 1;
    }
    if (m >= 60) {
        m -= 60;
        d += 1;
    }

    return { d, m, s, hemi, type };
}

// formatte un objet DMS en chaîne lisible
export function formatDMS(
    { d, m, s, hemi, type },
    { precision = 4, pad = true } = {}
) {
    const dd = String(d).padStart(type === "lon" ? 3 : 2, "0"); // 3 pour longitudes (jusqu'à 180)
    const mm = pad ? String(m).padStart(2, "0") : String(m);
    // secondes avec précision fixe, zéro-remplissage si besoin
    const ss = pad
        ? Number(s)
              .toFixed(precision)
              .padStart(precision ? 3 + 1 + precision : 2, "0")
        : Number(s).toFixed(precision);

    // symbole degré "°", minutes "'", secondes "\""
    return `${dd}° ${mm}' ${ss}" ${hemi}`;
}

export function decimalToDMSString(
    value,
    type = "lat",
    precision = 4,
    pad = true
) {
    return formatDMS(toDMS(value, type, precision), { precision, pad });
}

const safeGetTl = () =>
    (typeof getGlobalTimeline === "function" && getGlobalTimeline()) || null;

export async function createMapController({
    styleUrl = "http://127.0.0.1:8080/dark_matter.json",
    selectors = {
        trigger: "#navigate",
        container: "#map",
        mapContainer: "#map-content",
        board: "#board",
        cursor: "#cursor",
        topics: "#map-topics",
        layoutBoard: ".map__asideContainer.topicList",
        newTopic: ".map__asideContainer.newTopic",
    },
    animations = {},
    forumId = 1,
    topicsLimit = 12,
}) {
    const { mapAnimation } = animations;

    const trigger = qs(document, selectors.trigger);
    const container = qs(document, selectors.container);
    const cursor = qs(document, selectors.cursor);
    const boardTrigger = qs(document, selectors.board);
    const topicsContainer = qs(document, selectors.topics);
    const layoutBoard = qs(document, selectors.layoutBoard);
    const newTopicAside = qs(document, selectors.newTopic);
    const topicsArray = [];
    let topicListOpened = false;

    // controller pour la création de topics
    let topicController = null;
    let tempMarker = null;

    if (!trigger || !container) {
        console.warn("[Map] Sélecteurs introuvables:", selectors);
    }

    let map = null;
    let cam = null;
    let markers = [];
    let topics = (
        await fetchForumTopics({ forumId, limit: topicsLimit })
    ).filter(Boolean);

    let onMove = null;

    ensureMap();

    function renderTopicMarkers() {
        if (!map || !Array.isArray(topics) || !topics.length) return [];
        // grouper les topics par district ?

        return topics
            .filter(
                (t) => t && Array.isArray(t.coords) && t.coords.length === 2
            )
            .map((topic) => {
                const title = topic.title || "Untitled";
                const markerEl = document.createElement("div");
                markerEl.className = "marker";
                markerEl.innerHTML = `<div class="marker-label">${title}</div><div class='marker-pulse'></div>`;
                return new maplibregl.Marker({ element: markerEl })
                    .setLngLat(topic.coords)
                    .setPopup(new maplibregl.Popup().setHTML(title))
                    .addTo(map);
            });
    }

    async function renderTopicAside() {
        if (!Array.isArray(topics) || !topics.length) return;
        const groupedTopics = topics.reduce((acc, topic) => {
            const district = topic.district || "Unknown";
            if (!acc[district]) {
                acc[district] = [];
            }
            acc[district].push(topic);
            return acc;
        }, {});

        Object.entries(groupedTopics).forEach(([district, topics]) => {
            const districtEl = document.createElement("div");
            districtEl.className = "map-topics__district";
            districtEl.innerHTML = `<h3>${district}</h3>`;
            topics.forEach((topic) => {
                const topicEl = document.createElement("div");
                topicEl.className = "map-topics__item";
                topicEl.innerHTML = `<a href="${topic.url}"  rel="noopener">
                    <h4 class="map-topics__item-title">${topic.title}</h4>
                    <p class="map-topics__item-desc">${topic.desc}</p>
                </a>`;
                districtEl.appendChild(topicEl);
            });
            topicsContainer.appendChild(districtEl);
        });
    }

    /* async function fetchAndRenderTopics() {
        try {
            topicsContainer.innerHTML = `<div class="map-topics__loading">Chargement…</div>`;

            boardTrigger?.addEventListener("click", (e) => {
                e?.preventDefault?.();
                const layoutBoard = qs(document, ".map__asideContainer");
                layoutBoard?.classList.toggle("active");
            });
        } catch (e) {
            console.error("[Map] fetchAndRenderTopics error:", e);
        }
    } */

    function ensureMap() {
        if (map) return;

        boardTrigger?.addEventListener("click", (e) => {
            e?.preventDefault?.();
            layoutBoard?.classList.toggle("active");
            // toggle affichage liste topics
            newTopicAside?.classList.remove("active");
            topicListOpened = !topicListOpened;
            console.log(topicListOpened);
        });

        if (!maplibregl) {
            console.error("[Map] maplibregl manquant. Injection requise.");
            return;
        }
        try {
            const DAM = [4.89361, 52.37278];
            const paddedBounds = new maplibregl.LngLatBounds(
                [4.825, 52.33],
                [5.015, 52.397]
            );

            /* 4.8862243103166065;
            52.35511659542618; */

            const shifted = offsetBoundsByFraction(
                paddedBounds,
                -0.18 /* 6% à droite */,
                0.0
            );
            map = new maplibregl.Map({
                style: styleUrl,
                center: DAM, // Amsterdam
                pitch: 45,
                bearing: -17.6,
                container: document.querySelector("#map-content"),
                canvasContextAttributes: { antialias: true },
                attributionControl: false,
                maxBounds: shifted,
                dragRotate: false,
            });
            window.map = map;
            topicController = new TopicController({ map, topicsContainer });

            onMove = rafThrottle((e) => {
                if (!cursor) return;
                if (!isPointHoverDistrictLayer(e.point)) {
                    cursor.classList.add("out");
                } else {
                    cursor.classList.remove("out");
                }
                const { lng, lat } = e.lngLat;
                cursor.dataset.coords = `${decimalToDMSString(
                    lng,
                    "lon",
                    4
                )}, ${decimalToDMSString(lat, "lat", 4)}`;
            });

            map.on("mousemove", onMove);

            map.on("click", onMapClick);

            map.on("load", () => {
                cam = map.cameraForBounds(shifted, {
                    padding: { top: 32, right: 32, bottom: 32, left: 32 },
                    bearing: -17.6,
                    pitch: 45,
                    maxZoom: 12.623168426705108,
                });
                if (cam) map.jumpTo(cam);
                map.easeTo({
                    ...cam,
                    offset: [-600, 0],
                    duration: 600,
                });
                renderTopicMarkers();
                renderTopicAside();
            });
        } catch (err) {
            console.error("[Map] Erreur d’initialisation:", err);
        }
    }

    function onMapClick(e) {
        if (!map) return;

        if (isPointHoverDistrictLayer(e.point)) {
            if (tempMarker) {
                tempMarker.remove();
            }
            const t = e.originalEvent?.target;
            if (t && t.closest(".marker, .maplibregl-marker, .mapboxgl-marker"))
                return;

            const popup = new maplibregl.Popup({ offset: 25 }).setText(
                "Longitude : " + e.lngLat.lng + ", Latitude : " + e.lngLat.lat
            );

            const el = document.createElement("div");
            el.className = "marker";
            el.classList.add("temp");
            el.innerHTML = `<div class='marker-pulse'></div>`;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(e.lngLat)
                .setPopup(popup)
                .addTo(map);

            map.easeTo({
                ...cam,
                zoom: Math.max(map.getZoom(), 16.6),
                center: e.lngLat,
                duration: 600,
            });

            tempMarker = marker;
            topicController.moveNewTopic(e.lngLat);

            /* prochaine étape, créer un aside latéral à droite pour la rédaction de topic... */
        }
    }

    function isPointHoverDistrictLayer(point) {
        if (!map) return false;
        const features = map.queryRenderedFeatures(point, {
            layers: ["districts-fill"],
        });
        return features && features.length > 0;
    }

    function getDistrictAtLngLat(lngLat) {
        if (!map) return null;
        const features = map.queryRenderedFeatures(lngLat, {
            layers: ["districts-fill"],
        });
        return features && features.length > 0 ? features[0] : null;
    }

    function open() {
        // animation d’ouverture si dispo
        try {
            if (typeof mapAnimation === "function") {
                trigger.classList.add("active");
                container.classList.remove("onLoad");
                mapAnimation({ container });
            }
        } catch (err) {
            console.error("[Map] mapAnimation erreur:", err);
        }
    }

    function close() {
        const tl = safeGetTl();
        if (tl) {
            // si tu utilises la même globalTimeline pour map, elle se fermera ici
            tl.timeScale(2).reverse();
        }
        trigger.classList.remove("active");
        layoutBoard?.classList.remove("active");
    }

    function onTriggerClick(e) {
        e?.preventDefault?.();

        // si une TL est active → toggle fermeture
        const tl = safeGetTl();
        if (tl && tl.progress() > 0 && !tl.reversed()) {
            close();
            return;
        }

        // sinon → ouverture (lazy-init à l’intérieur)
        open();
    }

    trigger?.addEventListener("click", onTriggerClick);

    function destroy() {
        trigger?.removeEventListener("click", onTriggerClick);
        if (map) {
            try {
                if (onMove) map.off("mousemove", onMove);
                map.off("click", onMapClick);
            } catch (e) {
                // ignore si déjà détaché
            }
            map.remove();
            map = null;
        }
    }

    return { open, close, destroy };
}

async function fetchForumTopics({ forumId = 1, limit = 12 } = {}) {
    try {
        const res = await fetch(`/f${forumId}-`, {
            credentials: "same-origin",
        });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const anchors = Array.from(doc.querySelectorAll("a.topictitle"));
        const list = anchors.slice(0, limit).map((a) => {
            const href = a.getAttribute("href");
            const url = new URL(href, location.origin).href;
            const row = a.closest(".row");
            const author =
                row
                    ?.querySelector(".username, .topic-author a")
                    ?.textContent?.trim() || "";
            const replies =
                row
                    ?.querySelector(".posts, .topic-replies")
                    ?.textContent?.trim() || "";
            const last =
                row
                    ?.querySelector(".lastpost, .topic-lastpost, .gensmall")
                    ?.textContent?.trim() || "";
            const desc =
                row?.querySelector(".topic-description")?.textContent?.trim() ||
                "";
            const id = url.match(/t(\d+)-/)[1] || "";
            // parse selon [long, lat] dans le titre ou la description
            const coords = desc.match(/\[(.+?), ?(.+?)\]/);
            if (!coords) return null;
            const [lon, lat] = coords.slice(1).map(parseFloat);
            const district = desc.match(/"([^"]+)"/)?.[1] || "";
            return {
                title: a.textContent.trim(),
                id,
                desc,
                district,
                url,
                author,
                replies,
                last,
                coords: [Number(lon), Number(lat)],
            };
        });
        if (list.length) return list;
    } catch (e) {
        console.log(e);
    }
    return [];
}
