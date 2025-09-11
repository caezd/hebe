// features/register/register.js
// Refactor minimal du "register script" (iframe) depuis ton code existant.
// Aucune logique ajoutée : juste structuré, sécurisé, et sans utiliser `this` implicite.

import localforage from "https://cdn.jsdelivr.net/npm/localforage@1.10.0/+esm";

// Helpers locaux (copie fidèle de tes utilitaires)
const slugify = (text) =>
    text
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-");

const getSiblings = (el) => {
    const siblings = [];
    if (!el?.parentNode) return siblings;
    let n = el.parentNode.firstChild;
    while (n) {
        if (n.nodeType === 1 && n !== el) siblings.push(n);
        n = n.nextSibling;
    }
    return siblings;
};

// --- parsing / étapes -------------------------------------------------------

function computeRegisterStep(url = "", htmlDoc = document) {
    // Fidèle à ta logique, avec garde-fous
    let step = 1;
    if (url.includes("step=2")) step = 2;
    if (htmlDoc.querySelector("form#form_confirm")) step = 6;
    if (htmlDoc.querySelector(".randommessageclass")) step = 7; // message de succès
    return step;
}

function parseFieldset(fieldset) {
    const dls = fieldset?.querySelectorAll?.("dl") || [];
    const data = {};
    dls.forEach((dl) => {
        const dt = dl.querySelector("dt");
        const title = (dt?.textContent || "").replace(/[*:]/g, "");
        const slug = slugify(title);
        const input = dl.querySelector("dd input, dd textarea, dd select");
        if (input) {
            const type = input.tagName.toLowerCase();
            const value =
                type === "select" ? input.value : (input.value || "").trim();
            data[slug] = {
                title,
                type,
                value,
                validate: () => true,
                inputHTML: input,
                originalHTML: dl,
            };
        }
    });
    return data;
}

function getAllFields(accountFieldset, profileFieldset) {
    return [parseFieldset(accountFieldset), parseFieldset(profileFieldset)];
}

// Placeholders pour garder le même flux sans casser
function formatFields(/* account, profile */) {
    return null;
}
function changeFormAction() {
    /* no-op fidèle au code actuel */
}

// --- DOM actions ------------------------------------------------------------

function goToStep(container, idx) {
    const panel = container.querySelector(`.register__panel:nth-child(${idx})`);
    if (!panel) return;
    getSiblings(panel).forEach((s) => s.classList.remove("isOpen"));
    panel.classList.add("isOpen");
}

function deletePanelContent(container, idx) {
    const target = container.querySelector(
        `.register__panel:nth-child(${idx}) .register__panelContentWrapper`
    );
    target?.remove();
}

// --- handler principal (évènement load de l’iframe) ------------------------

export async function updateIframeRegister(event) {
    const iframe = event?.currentTarget;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    const url = iframe.contentWindow?.location?.href || "";
    if (!doc) return;

    const cpMain = doc.querySelector("#cp-main");
    if (!cpMain) return;

    const html = cpMain.cloneNode(true);
    const fieldsets = html.querySelectorAll("fieldset");

    // état local minimum (comme ton code)
    /* const foragedForm = await localforage.getItem("registration_form");
    const formData = {}; */

    // container barba courant (ou document à défaut)
    const container =
        iframe.closest('section[data-barba="container"]') || document;

    const step = computeRegisterStep(url, html);

    const steps = {
        1: () => {},
        2: async () => {
            if (fieldsets.length >= 2) {
                const [account, profile] = getAllFields(
                    fieldsets[0],
                    fieldsets[1]
                );
                // garde le hook existant :
                const formatted = formatFields(account, profile);
                void formatted;
            }
            goToStep(container, 2);
            await new Promise((r) => setTimeout(r, 400));
            deletePanelContent(container, 1);
            changeFormAction();
        },
        3: () => {},
        6: () => {}, // confirm
        7: () => {}, // success
    };

    if (steps[step]) {
        await steps[step]();
    }
}

// --- init public ------------------------------------------------------------

export function initRegisterScripts(container = document) {
    try {
        const iFrame = container.querySelector("#registerIframe");
        if (!iFrame) return;
        // sécurise : évite les doublons si Barba réentre
        iFrame.removeEventListener("load", updateIframeRegister);
        iFrame.addEventListener("load", updateIframeRegister);
    } catch (e) {
        console.log("RegisterScripts:", e);
    }
}
