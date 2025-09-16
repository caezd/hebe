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

function readInlineColor(el) {
    if (!el) return "";
    const target = el.querySelector?.('.color-groups[style*="color"]') || el;
    const style = target?.style.color || target?.getAttribute("style") || "";
    if (!style) return "";
    // parse color: #rrggbb or rgb(...) or named color from style attribute
    return style;
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

                    const authorA = qs(
                        row,
                        ".topic-author a, .username a, .topic-author > a"
                    );
                    const authorUrl = authorA
                        ? new URL(authorA.getAttribute("href"), location.origin)
                              .href
                        : "";
                    const authorName =
                        authorA?.textContent?.trim() ||
                        row
                            ?.querySelector(".topic-author")
                            ?.textContent?.replace(/\s*par\s*/i, "")
                            .trim() ||
                        "";
                    const authorColor = readInlineColor(authorA);

                    const replies =
                        qs(
                            row,
                            ".posts, .topic-replies"
                        )?.textContent?.trim() || "";

                    const desc =
                        qs(
                            row,
                            ".topic-description, .topic-desc"
                        )?.textContent?.trim() || "";
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

                    // lastpost
                    const lastpost = qs(row, ".lastpost");
                    const lastpost_avatar = qs(lastpost, "img");
                    const lastpost_user = qs(lastpost, 'a[href^="/u"]');
                    const lastpost_color = readInlineColor(lastpost_user);
                    const lastpost_link = qs(lastpost, 'a[href^="/t"]');
                    const lastpost_infos = qs(lastpost, ".lastpost-infos");
                    const lastpost_date =
                        new Tyme(
                            lastpost_infos?.lastChild.textContent.trim()
                        ) || "";
                    console.log({
                        lastpost_avatar,
                        lastpost_user,
                        lastpost_color,
                        lastpost_link,
                        lastpost_date,
                    });

                    return {
                        id,
                        title,
                        desc,
                        url,
                        author: {
                            name: authorName,
                            url: authorUrl,
                            color: authorColor,
                        },
                        replies,
                        coords: [lon, lat],
                        lastpost: {
                            avatar: lastpost_avatar
                                ? new URL(lastpost_avatar.src)
                                : null,
                            user: lastpost_user
                                ? {
                                      name: lastpost_user.textContent.trim(),
                                      url: new URL(lastpost_user.href),
                                      color: lastpost_color,
                                  }
                                : null,
                            link: lastpost_link
                                ? new URL(lastpost_link.href)
                                : null,
                            date: {
                                day: lastpost_date.parseToFormat("DD") || "",
                                month: lastpost_date.parseToFormat("MM") || "",
                                year: lastpost_date.parseToFormat("YYYY") || "",
                                time:
                                    lastpost_date.parseToFormat("HH:mm") || "",
                                full: lastpost_date.toString() || "",
                            },
                        },
                    };
                } catch (e) {
                    console.error("[Map] fetchForumTopics error:", e);
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
        this.topicsContainer = qs(document, topicsContainerSelector) || null;
        this.asideContainer = qs(document, newTopicAsideSelector) || null;
        this.toggleButton =
            qs(this.asideContainer, ".newTopic__closeButton") || null;
        this.isCreating = false;
        this.isAsideOpened = false;

        // optional fields inside aside
        this.subjectInput =
            qs(this.asideContainer, '[name="subject"], #newTopicSubject') ||
            null;
        this.messageInput =
            qs(this.asideContainer, '[name="message"], #newTopicMessage') ||
            null;
        this.coordsInput =
            qs(this.asideContainer, '[name="coords"], #newTopicCoords') || null;
        this.districtInput =
            qs(this.asideContainer, '[name="district"], #newTopicDistrict') ||
            null;
        this.coordsDecimalEl =
            qs(this.asideContainer, "[data-coords-decimal]") || null;
        this.coordsDMSEl = qs(this.asideContainer, "[data-coords-dms]") || null;

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

    _readDraft() {
        const raw = localStorage.getItem("newTopic");
        if (!raw) return null;
        return JSON.parse(raw);
    }

    _writeDraft(payload) {
        try {
            localStorage.setItem("newTopic", JSON.stringify(payload));
        } catch {}
    }

    getDraft() {
        return this._readDraft();
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
    const topicMarkers = new Map();
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
            ? features[0].properties?.Stadsdeel || features[0].id || null
            : null;
    }

    function renderTopicMarkers() {
        if (!map || !Array.isArray(topics) || !topics.length) return [];
        const made = [];

        topics.forEach((t) => {
            try {
                if (!t || !Array.isArray(t.coords) || t.coords.length !== 2)
                    return;
                const pos = Array.isArray(t.coords)
                    ? { lng: t.coords[0], lat: t.coords[1] }
                    : t.coords;
                if (!Number.isFinite(pos.lng) || !Number.isFinite(pos.lat))
                    return;
                const title = t.title || "Untitled";
                const el = document.createElement("div");
                el.className = "marker";
                el.innerHTML = `<div class="marker-label">${title}</div><div class='marker-pulse'></div>`;
                const m = new maplibregl.Marker({ element: el })
                    .setLngLat([pos.lng, pos.lat])
                    .addTo(map);
                made.push(m);
                if (t.id) topicMarkers.set(String(t.id), m);
            } catch (error) {
                console.error("[Map] renderTopicMarkers error:", error);
            }
        });

        // optional: attach to topicsContainer
        try {
            if (topicsContainer) topicsContainer.appendChild(frag);
        } catch {}

        return made;
    }

    function focusTopicById(id) {
        const m = topicMarkers.get(String(id));
        if (!m || !map) return;

        const ll = m.getLngLat();

        // décale légèrement pour compenser l’aside (gauche/droite)
        const leftAsideW = layoutBoard?.classList.contains("active")
            ? layoutBoard.offsetWidth || 0
            : 0;
        const rightAsideW = newTopicAside?.classList.contains("active")
            ? newTopicAside.offsetWidth || 0
            : 0;
        const offsetX = (leftAsideW - rightAsideW) / 2; // px vers la droite si aside gauche ouverte

        centerOn(ll);

        // petit highlight visuel du marker
        try {
            const el = m.getElement();
            el.classList.add("is-hovered");
            setTimeout(() => el.classList.remove("is-hovered"), 700);
        } catch {}
    }

    let lastFocusLL = null; // mémorise le dernier point centré

    function centerOn(
        lngLat,
        { zoom = 16, padX = 0, padY = 0, duration = 450 } = {}
    ) {
        if (!map) return;
        lastFocusLL = lngLat; // garde la trace pour re-centre après resize
        map.easeTo({
            center: lngLat,
            zoom: Math.max(map.getZoom(), zoom),
            offset: [padX, padY], // en push-layout, laisse à 0,0 (sauf micro-ajustement d’ancre)
            duration,
        });
    }

    function installTopicHover() {
        if (!topicsContainer) return;

        // garde la référence du label actuellement surligné
        let activeLabelEl = null;

        function activateLabelForMarker(m) {
            try {
                const el = m?.getElement?.();
                const label = el?.querySelector?.(".marker-label") || null;
                if (activeLabelEl && activeLabelEl !== label) {
                    activeLabelEl.classList.remove("marker-label--hover");
                }
                if (label) {
                    label.classList.add("marker-label--hover");
                }
                activeLabelEl = label || null;
            } catch {
                // en cas d'erreur, on nettoie
                if (activeLabelEl) {
                    activeLabelEl.classList.remove("marker-label--hover");
                    activeLabelEl = null;
                }
            }
        }

        function clearActiveLabel() {
            if (activeLabelEl) {
                activeLabelEl.classList.remove("marker-label--hover");
                activeLabelEl = null;
            }
        }

        // Survol d'un item → focus + highlight du label
        topicsContainer.addEventListener("mouseover", (e) => {
            const item = e.target.closest(".map__topicsList-item");
            if (!item || !topicsContainer.contains(item)) return;

            const id = item.dataset.topicId;

            if (id && topicMarkers?.has(id)) {
                // centrer/zoomer via l’ID → marker connu
                focusTopicById(id);
                const m = topicMarkers.get(id);
                activateLabelForMarker(m);
            } else if (item.dataset.lng && item.dataset.lat) {
                // fallback coordonnées (pas d’ID mappé) → centre sans highlight
                const ll = [
                    parseFloat(item.dataset.lng),
                    parseFloat(item.dataset.lat),
                ];
                if (Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
                    centerOn(ll, { zoom: 16.4, duration: 600 });
                }
                clearActiveLabel();
            }
        });

        // Quand on QUITTE l’item, retirer la classe du label
        topicsContainer.addEventListener("mouseout", (e) => {
            const item = e.target.closest(".map__topicsList-item");
            if (!item) return;

            // si on reste à l’intérieur du même item, ne rien faire
            if (e.relatedTarget && item.contains(e.relatedTarget)) return;

            clearActiveLabel();
        });

        // (optionnel) si tu veux aussi nettoyer quand on quitte toute la liste :
        topicsContainer.addEventListener("mouseleave", clearActiveLabel);
    }

    function renderTopicAside() {
        if (!Array.isArray(topics) || !topics.length || !topicsContainer)
            return;

        const div = document.createElement("div");
        div.className = "map__topicsList";

        topics.forEach((topic) => {
            const item = document.createElement("div");
            item.className = "map__topicsList-item";
            item.dataset.topicId = String(topic.id || "");
            item.dataset.lng = String(topic.coords?.[0] ?? "");
            item.dataset.lat = String(topic.coords?.[1] ?? "");
            const safeTitle = topic.title || "Aucun titre à signaler";
            item.innerHTML = `
            <div>
                ${
                    topic.lastpost?.avatar
                        ? `<img src="${topic.lastpost.avatar}" alt="Avatar" class="map__topicsList-item-avatar" />`
                        : ""
                }
                <div class="map__topicsList-item-date">
                    <span>${topic.lastpost?.date.day || ""}</span>
                    <span>${topic.lastpost?.date.month || ""}</span>
                </div>
            </div>
            <div>
                <h4 class="map__topicsList-item-title"><a class="linkStriked" href="${
                    topic.url
                }">${safeTitle}</a></h4>
                <p class="map__topicsList-item-meta">
                 <span class="map__topicsList-item-district">${
                     districtAtLngLat({
                         lng: topic.coords[0],
                         lat: topic.coords[1],
                     }) || "Unknown District"
                 }</span>
                    <a href="${
                        topic.lastpost?.user?.profileUrl || "#"
                    }" class="map__topicsList-item-author ">
                        <span style="background-color:${
                            topic.lastpost?.user?.color || "inherit"
                        }"></span>${
                topic.lastpost?.user?.name.split(" ")[0][0]
            }. ${topic.lastpost?.user?.name.split(" ")[1] || ""}
                    </a>
                </p>
            </div>

            `;
            div.appendChild(item);
        });

        topicsContainer.innerHTML = "";
        topicsContainer.appendChild(div);
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
        ensureTempMarkerAt(e.lngLat);

        // zoom in a bit & center on click
        centerOn(e.lngLat, { zoom: 16.4, duration: 600 });

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
        map.resize(); // le centre visible = centre du container (pas besoin d'offset)

        try {
            map.setMaxBounds(INITIAL_BOUNDS); // pas de décalage
            cam = map.cameraForBounds(INITIAL_BOUNDS, {
                padding: { top: 32, right: 32, bottom: 32, left: 32 },
                bearing: map.getBearing(),
                pitch: map.getPitch(),
                maxZoom: clamp(map.getZoom(), 6, 19),
            });
        } catch {}
    }

    function ensureTempMarkerAt(lngLat) {
        if (!map) return null;
        const pos = Array.isArray(lngLat)
            ? { lng: lngLat[0], lat: lngLat[1] }
            : lngLat;
        if (!tempMarker) {
            const el = document.createElement("div");
            el.className = "marker temp";
            el.innerHTML = `<div class="marker-label marker-label--temp" hidden></div><div class='marker-pulse'></div>`;
            tempMarker = new maplibregl.Marker({ element: el }).setLngLat(pos);
            tempMarker.addTo(map);
        } else {
            tempMarker.setLngLat(pos);
        }
        const popupText = `Lng: ${Number(pos.lng).toFixed(6)}\nLat: ${Number(
            pos.lat
        ).toFixed(6)}`;
        tempMarker.getPopup()?.setText(popupText);
        return tempMarker;
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
                        bearing: -17.6,
                        pitch: 45,
                        maxZoom: 12.62,
                        offset: [-600, 0],
                    }
                );
                if (cam) map.jumpTo(cam);
                map.easeTo({ ...cam, offset: [-600, 0], duration: 600 });
            } catch {}

            renderTopicMarkers();
            renderTopicAside();
            installTopicHover();

            try {
                const draft = topicController?.getDraft?.();
                if (draft?.coords) {
                    const coords = Array.isArray(draft.coords)
                        ? { lng: draft.coords[0], lat: draft.coords[1] }
                        : draft.coords;

                    ensureTempMarkerAt(coords);
                    topicController?.moveNewTopic(
                        [coords.lng, coords.lat],
                        draft.district || null
                    );
                    topicController?.openAside();
                    map.easeTo({
                        ...cam,
                        center: [coords.lng, coords.lat],
                        zoom: Math.max(map.getZoom(), 16.4),
                    });
                    if (draft.subject) updateTempMarkerLabel(draft.subject);
                }
            } catch (err) {
                console.error("[Map] init error:", err);
            }
            updateViewportConstraints();
        });
    } catch (err) {
        console.error("[Map] init error:", err);
    }

    trigger?.addEventListener("click", onTriggerClick);

    return { open, close, destroy };
}
