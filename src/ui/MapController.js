import { qs } from "../core/utils.js";
import { getGlobalTimeline } from "../animations/navigation.js";

// Map + Topic Controllers — refactor v2
// -------------------------------------
// Goals
// - Stronger separation of concerns (map vs. topic creation UI)
// - Safer DOM access & defensive guards to avoid null errors
// - Resize-aware map (ResizeObserver), with camera/offset updates when side asides open/close
// - Clean event lifecycle (add/remove) and small utilities (throttle, DMS helpers)
// - Robust topic parsing from forum list + safe marker rendering
// - Smooth “click to drop temp marker → open creation aside → prefill coords” flow

// External expectations
// - global `maplibregl`
// - optional `getGlobalTimeline()` from animations/navigation.js
// - DOM structure:
//   - map container: #map and #map-content (canvas host)
//   - list aside: .map__asideContainer.topicList
//   - new-topic aside: .map__asideContainer.newTopic
//   - toggle board button: #board
//   - creation close button (optional): .newTopic__closeButton
//   - creation form fields (optional):
//       [name="subject"], [name="message"], [name="district"], [name="coords"],
//       [data-coords-decimal], [data-coords-dms]

// -------------------------------------
// utils
export function rafThrottle(fn) {
    let ticking = false;
    return function throttled(...args) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            try {
                fn.apply(this, args);
            } finally {
                ticking = false;
            }
        });
    };
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function pxOffsetToLngLatFraction(container, pxX = 0, pxY = 0) {
    // Convert a pixel offset into a crude lng/lat fraction of current bounds width/height.
    // Used only to nudge maxBounds slightly when the layout changes.
    // Guards: if container missing, return 0,0 fractions.
    const w = container?.clientWidth || 0;
    const h = container?.clientHeight || 0;
    if (!w || !h) return { fx: 0, fy: 0 };
    return { fx: pxX / w, fy: pxY / h };
}

function offsetBoundsByFraction(bounds, fx = 0, fy = 0) {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const dLng = (ne.lng - sw.lng) * fx;
    const dLat = (ne.lat - sw.lat) * fy;
    return new maplibregl.LngLatBounds(
        [sw.lng + dLng, sw.lat + dLat],
        [ne.lng + dLng, ne.lat + dLat]
    );
}

// -------------------------------------
// DMS helpers
export function toDMS(value, type = "lat", precision = 4) {
    const hemi =
        type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
    let v = Math.abs(Number(value));
    let d = Math.floor(v);
    let mFloat = (v - d) * 60;
    let m = Math.floor(mFloat);
    let s = (mFloat - m) * 60;
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

export function formatDMS(
    { d, m, s, hemi, type },
    { precision = 4, pad = true } = {}
) {
    const dd = String(d).padStart(type === "lon" ? 3 : 2, "0");
    const mm = pad ? String(m).padStart(2, "0") : String(m);
    const ss = pad
        ? Number(s)
              .toFixed(precision)
              .padStart(precision ? 3 + 1 + precision : 2, "0")
        : Number(s).toFixed(precision);
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

// -------------------------------------
// Forum topics scraping (robust)
async function fetchForumTopics({ forumId = 1, limit = 12, signal } = {}) {
    try {
        const res = await fetch(`/f${forumId}-`, {
            credentials: "same-origin",
            signal,
        });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const anchors = Array.from(doc.querySelectorAll("a.topictitle"));
        const list = anchors
            .slice(0, limit)
            .map((a) => {
                try {
                    const href = a.getAttribute("href");
                    const url = new URL(href, location.origin).href;
                    const row = a.closest(".row, .topic-row, tr");
                    const title = (a.textContent || "Untitled").trim();
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
                            ?.querySelector(
                                ".lastpost, .topic-lastpost, .gensmall"
                            )
                            ?.textContent?.trim() || "";
                    const desc =
                        row
                            ?.querySelector(".topic-description, .topic-desc")
                            ?.textContent?.trim() || "";
                    const mId = url.match(/t(\d+)-/);
                    const id = mId ? mId[1] : "";
                    // parse [lon, lat] in title or description
                    const where = title + "\n" + desc;
                    const coords = where.match(/\[(.+?),\s*(.+?)\]/);
                    if (!coords) return null;
                    const lon = parseFloat(coords[1]);
                    const lat = parseFloat(coords[2]);
                    if (!Number.isFinite(lon) || !Number.isFinite(lat))
                        return null;
                    const district = (
                        where.match(/"([^"]+)"/)?.[1] || ""
                    ).trim();
                    return {
                        id,
                        title,
                        desc,
                        district,
                        url,
                        author,
                        replies,
                        last,
                        coords: [lon, lat],
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
        return list;
    } catch (e) {
        console.warn("[Map] fetchForumTopics error:", e);
        return [];
    }
}

// -------------------------------------
// TopicController (refactor)
export class TopicController {
    constructor({
        map,
        topicsContainerSelector = ".map__asideContainer.topicList",
        newTopicAsideSelector = ".map__asideContainer.newTopic",
    } = {}) {
        this.map = map;
        this.topicsContainer =
            document.querySelector(topicsContainerSelector) || null;
        this.asideContainer =
            document.querySelector(newTopicAsideSelector) || null;
        this.toggleButton =
            this.asideContainer?.querySelector(".newTopic__closeButton") ||
            null;
        this.isCreating = false;
        this.isAsideOpened = false;

        // optional fields inside aside
        this.subjectInput =
            this.asideContainer?.querySelector(
                '[name="subject"], #newTopicSubject'
            ) || null;
        this.messageInput =
            this.asideContainer?.querySelector(
                '[name="message"], #newTopicMessage'
            ) || null;
        this.coordsInput =
            this.asideContainer?.querySelector(
                '[name="coords"], #newTopicCoords'
            ) || null;
        this.districtInput =
            this.asideContainer?.querySelector(
                '[name="district"], #newTopicDistrict'
            ) || null;
        this.coordsDecimalEl =
            this.asideContainer?.querySelector("[data-coords-decimal]") || null;
        this.coordsDMSEl =
            this.asideContainer?.querySelector("[data-coords-dms]") || null;

        this._bindAsideEvents();
        this._loadState();
    }

    _bindAsideEvents() {
        if (this.toggleButton) {
            this.toggleButton.addEventListener("click", () =>
                this.toggleAside()
            );
        }
        // ESC to close
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isAsideOpened) this.closeAside();
        });

        // Mirror text inputs back into state
        const sync = () => this._saveState();
        this.subjectInput?.addEventListener("input", sync);
        this.messageInput?.addEventListener("input", sync);
    }

    _loadState() {
        try {
            const saved = localStorage.getItem("newTopic");
            if (!saved) return;
            const { coords, district, subject, message } = JSON.parse(saved);
            if (coords)
                this.isCreating = { coords, district, subject, message };
            if (this.subjectInput) this.subjectInput.value = subject || "";
            if (this.messageInput) this.messageInput.value = message || "";
            if (this.districtInput) this.districtInput.value = district || "";
            if (coords) this._updateCoordDisplays(coords);
            // expose close button if we have a draft
            this.toggleButton?.classList.add("show");
        } catch {
            /* ignore */
        }
    }

    _saveState() {
        if (!this.isCreating) return;
        try {
            const payload = {
                coords: this.isCreating.coords || null,
                district:
                    this.isCreating.district || this.districtInput?.value || "",
                subject: this.subjectInput?.value || "",
                message: this.messageInput?.value || "",
            };
            localStorage.setItem("newTopic", JSON.stringify(payload));
        } catch {
            /* ignore */
        }
    }

    _updateCoordDisplays(lngLat) {
        const { lng, lat } = Array.isArray(lngLat)
            ? { lng: lngLat[0], lat: lngLat[1] }
            : lngLat;
        if (this.coordsInput) this.coordsInput.value = `${lng},${lat}`;
        if (this.coordsDecimalEl)
            this.coordsDecimalEl.textContent = `${lng.toFixed(
                6
            )}, ${lat.toFixed(6)}`;
        if (this.coordsDMSEl)
            this.coordsDMSEl.textContent = `${decimalToDMSString(
                lng,
                "lon",
                4
            )}, ${decimalToDMSString(lat, "lat", 4)}`;
    }

    initNewTopic(coords, district) {
        this.isCreating = { coords, district };
        this._saveState();
        this.openAside();
        this.moveNewTopic(coords, district);
    }

    moveNewTopic(coords, district) {
        if (!coords) return;
        this.isCreating = {
            ...this.isCreating,
            coords,
            district: district ?? this.isCreating?.district,
        };
        this._updateCoordDisplays(coords);
        this._saveState();
        this.openAside();
    }

    setDistrict(district) {
        this.isCreating = { ...this.isCreating, district };
        if (this.districtInput) this.districtInput.value = district || "";
        this._saveState();
    }

    toggleAside() {
        this.isAsideOpened ? this.closeAside() : this.openAside();
    }

    openAside() {
        if (!this.asideContainer) return;
        this.asideContainer.classList.add("active");
        this.topicsContainer?.classList.remove("active");
        this.isAsideOpened = true;
    }

    closeAside() {
        if (!this.asideContainer) return;
        this.asideContainer.classList.remove("active");
        this.isAsideOpened = false;
        // keep draft in localStorage; do not wipe here
    }
}

// -------------------------------------
// MapController (refactor)
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
} = {}) {
    const { mapAnimation } = animations || {};

    const trigger = document.querySelector(selectors.trigger);
    const container = document.querySelector(selectors.container);
    const mapHost = document.querySelector(selectors.mapContainer);
    const cursor = document.querySelector(selectors.cursor);
    const boardTrigger = document.querySelector(selectors.board);
    const topicsContainer = document.querySelector(selectors.topics);
    const layoutBoard = document.querySelector(selectors.layoutBoard);
    const newTopicAside = document.querySelector(selectors.newTopic);

    if (!container || !mapHost) {
        console.warn("[Map] container/mapHost missing:", selectors);
    }

    const aborter = new AbortController();
    const topics =
        (await fetchForumTopics({
            forumId,
            limit: topicsLimit,
            signal: aborter.signal,
        })) || [];

    let map = null;
    let cam = null;
    let tempMarker = null;
    let onMove = null;
    let resizeObs = null;
    let topicController = null;

    // district layer name you use to restrict clicks
    const DISTRICT_LAYER = "districts-fill";

    // initial logical bounds (Amsterdam demo)
    const INITIAL_BOUNDS = new maplibregl.LngLatBounds(
        [4.825, 52.33],
        [5.015, 52.397]
    );
    const INITIAL_CENTER = [4.89361, 52.37278];

    function safeGetTl() {
        try {
            return (
                (typeof getGlobalTimeline === "function" &&
                    getGlobalTimeline()) ||
                null
            );
        } catch {
            return null;
        }
    }

    function isMarkerElement(el) {
        return !!el?.closest?.(".marker, .maplibregl-marker, .mapboxgl-marker");
    }

    function isDistrictLayerPresent() {
        return Boolean(
            map?.getStyle()?.layers?.some((l) => l.id === DISTRICT_LAYER)
        );
    }

    function pointIsInDistrict(point) {
        if (!map) return false;
        if (!isDistrictLayerPresent()) return true; // fallback: allow clicks anywhere if layer missing
        const features = map.queryRenderedFeatures(point, {
            layers: [DISTRICT_LAYER],
        });
        return features && features.length > 0;
    }

    function districtAtLngLat(lngLat) {
        if (!map || !isDistrictLayerPresent()) return null;
        const features = map.queryRenderedFeatures(map.project(lngLat), {
            layers: [DISTRICT_LAYER],
        });
        return features && features.length > 0
            ? features[0].properties?.name || features[0].id || null
            : null;
    }

    function renderTopicMarkers() {
        if (!map || !Array.isArray(topics) || !topics.length) return [];
        const made = [];
        const frag = document.createDocumentFragment();

        topics.forEach((t) => {
            try {
                if (!t || !Array.isArray(t.coords) || t.coords.length !== 2)
                    return;
                const [lon, lat] = t.coords;
                if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
                const title = t.title || "Untitled";
                const el = document.createElement("div");
                el.className = "marker";
                el.innerHTML = `<div class="marker-label">${title}</div><div class='marker-pulse'></div>`;
                const m = new maplibregl.Marker({ element: el })
                    .setLngLat([lon, lat])
                    .setPopup(new maplibregl.Popup().setHTML(title))
                    .addTo(map);
                made.push(m);
                frag.appendChild(el);
            } catch {
                /* ignore one bad topic */
            }
        });

        // optional: attach to topicsContainer
        try {
            if (topicsContainer) topicsContainer.appendChild(frag);
        } catch {}

        return made;
    }

    function renderTopicAside() {
        if (!Array.isArray(topics) || !topics.length || !topicsContainer)
            return;
        const grouped = topics.reduce((acc, t) => {
            const key = t?.district || "Unknown";
            (acc[key] ||= []).push(t);
            return acc;
        }, {});

        const frag = document.createDocumentFragment();
        Object.entries(grouped).forEach(([district, arr]) => {
            const districtEl = document.createElement("div");
            districtEl.className = "map-topics__district";
            districtEl.innerHTML = `<h3>${district}</h3>`;
            arr.forEach((topic) => {
                const item = document.createElement("div");
                item.className = "map-topics__item";
                const safeTitle = topic.title || "Untitled";
                const safeDesc = topic.desc || "";
                item.innerHTML = `<a href="${topic.url}" rel="noopener">
          <h4 class="map-topics__item-title">${safeTitle}</h4>
          <p class="map-topics__item-desc">${safeDesc}</p>
        </a>`;
                districtEl.appendChild(item);
            });
            frag.appendChild(districtEl);
        });

        topicsContainer.innerHTML = "";
        topicsContainer.appendChild(frag);
    }

    function installUIBindings() {
        // toggle between topic list and new-topic asides via the board button
        boardTrigger?.addEventListener("click", (e) => {
            e?.preventDefault?.();
            layoutBoard?.classList.toggle("active");
            newTopicAside?.classList.remove("active");
        });
    }

    function onMouseMove(e) {
        if (!cursor) return;
        const outside = !pointIsInDistrict(e.point);
        cursor.classList.toggle("out", outside);
        const { lng, lat } = e.lngLat;
        cursor.dataset.coords = `${decimalToDMSString(
            lng,
            "lon",
            4
        )}, ${decimalToDMSString(lat, "lat", 4)}`;
    }

    function onMapClick(e) {
        if (!map) return;

        // ignore clicks on markers/popups
        if (isMarkerElement(e.originalEvent?.target)) return;

        // optionally constrain to district layer
        if (!pointIsInDistrict(e.point)) return;

        // drop/replace a temp marker
        if (tempMarker) {
            try {
                tempMarker.remove();
            } catch {}
        }

        const el = document.createElement("div");
        el.className = "marker temp";
        el.innerHTML = `<div class="marker-label marker-label--temp" hidden></div><div class='marker-pulse'></div>`;

        tempMarker = new maplibregl.Marker({ element: el })
            .setLngLat(e.lngLat)
            .setPopup(
                new maplibregl.Popup({ offset: 16 }).setText(
                    `Lng: ${e.lngLat.lng.toFixed(
                        6
                    )}\nLat: ${e.lngLat.lat.toFixed(6)}`
                )
            )
            .addTo(map);

        // zoom in a bit & center on click
        map.easeTo({
            zoom: Math.max(map.getZoom(), 16.4),
            center: e.lngLat,
            duration: 600,
        });

        // update aside via TopicController
        const dist = districtAtLngLat(e.lngLat);
        topicController?.moveNewTopic(e.lngLat, dist);
        topicController?.openAside();

        // if we have a subject, show it on the temp marker label
        const currentSubject = topicController?.subjectInput?.value?.trim();
        if (currentSubject) updateTempMarkerLabel(currentSubject);
    }

    function updateViewportConstraints() {
        if (!map) return;
        // Always notify MapLibre first
        map.resize();

        // Shift camera target a bit if any aside is open so focus stays visible
        const leftAsideW = layoutBoard?.classList.contains("active")
            ? layoutBoard.offsetWidth || 0
            : 0;
        const rightAsideW = newTopicAside?.classList.contains("active")
            ? newTopicAside.offsetWidth || 0
            : 0;
        const netOffsetX = (rightAsideW - leftAsideW) / 2; // rough: move half the delta

        // Recompute a slightly shifted maxBounds based on pixel offset → fraction
        const { fx } = pxOffsetToLngLatFraction(mapHost, -netOffsetX, 0);
        const base = INITIAL_BOUNDS;
        const shifted = offsetBoundsByFraction(base, fx, 0);
        try {
            map.setMaxBounds(shifted);
        } catch {}

        // If we have a cached camera-from-bounds, refresh it
        try {
            cam = map.cameraForBounds(shifted, {
                padding: { top: 32, right: 32, bottom: 32, left: 32 },
                bearing: map.getBearing(),
                pitch: map.getPitch(),
                maxZoom: clamp(map.getZoom(), 6, 19),
            });
        } catch {}
    }

    function updateTempMarkerLabel(text) {
        if (!tempMarker) return;
        const el = tempMarker.getElement?.() || tempMarker._element || null;
        if (!el) return;

        let label = el.querySelector(".marker-label");
        if (!label) {
            label = document.createElement("div");
            label.className = "marker-label marker-label--temp";
            el.prepend(label);
        }
        const t = (text || "").trim();
        label.textContent = t;
        label.hidden = !t.length; // affiche si non-vide
    }

    function open() {
        try {
            if (typeof mapAnimation === "function" && trigger && container) {
                trigger.classList.add("active");
                container.classList.remove("onLoad");
                mapAnimation({ container });
            }
        } catch (err) {
            console.error("[Map] mapAnimation error:", err);
        }
    }

    function close() {
        const tl = safeGetTl();
        if (tl) tl.timeScale(2).reverse();
        trigger?.classList.remove("active");
        layoutBoard?.classList.remove("active");
        newTopicAside?.classList.remove("active");
    }

    function onTriggerClick(e) {
        e?.preventDefault?.();
        const tl = safeGetTl();
        if (tl && tl.progress() > 0 && !tl.reversed()) {
            close();
            return;
        }
        open();
    }

    function destroy() {
        aborter.abort();
        trigger?.removeEventListener("click", onTriggerClick);
        boardTrigger?.replaceWith(boardTrigger.cloneNode(true)); // drop listeners
        if (map) {
            try {
                map.off("mousemove", onMove);
                map.off("click", onMapClick);
            } catch {}
            try {
                tempMarker?.remove();
            } catch {}
            try {
                map.remove();
            } catch {}
            map = null;
        }
        try {
            resizeObs?.disconnect();
        } catch {}
    }

    // ---- init map
    if (!maplibregl) {
        console.error(
            "[Map] maplibregl missing. Inject the script before init."
        );
        return { open, close, destroy };
    }

    installUIBindings();

    try {
        map = new maplibregl.Map({
            style: styleUrl,
            center: INITIAL_CENTER,
            pitch: 45,
            bearing: -17.6,
            container: mapHost || selectors.mapContainer,
            canvasContextAttributes: { antialias: true },
            attributionControl: false,
            maxBounds: offsetBoundsByFraction(INITIAL_BOUNDS, -0.18, 0),
            dragRotate: false,
        });
        window.map = map; // debug

        // topic UI
        topicController = new TopicController({ map });
        topicController?.subjectInput?.addEventListener("input", (e) => {
            updateTempMarkerLabel(e.currentTarget.value);
        });

        onMove = rafThrottle(onMouseMove);
        map.on("mousemove", onMove);
        map.on("click", onMapClick);

        map.on("load", () => {
            try {
                cam = map.cameraForBounds(
                    offsetBoundsByFraction(INITIAL_BOUNDS, -0.18, 0),
                    {
                        padding: { top: 32, right: 32, bottom: 32, left: 32 },
                        bearing: -17.6,
                        pitch: 45,
                        maxZoom: 12.62,
                    }
                );
                if (cam) map.jumpTo(cam);
                map.easeTo({ ...cam, offset: [-600, 0], duration: 600 });
            } catch {}

            renderTopicMarkers();
            renderTopicAside();
            updateViewportConstraints();
        });
    } catch (err) {
        console.error("[Map] init error:", err);
    }

    trigger?.addEventListener("click", onTriggerClick);

    return { open, close, destroy };
}
