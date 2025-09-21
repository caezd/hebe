import Context from "../core/context.js";
import { qsa } from "../core/utils.js";

const DIRECTIONS = ["top", "right", "bottom", "left"];
const SYMBOLS = [
    "🜁",
    "🜃",
    "🜂",
    "🜄",
    "🜍",
    "☿",
    "🜔",
    "☉",
    "☿",
    "♃",
    "♁",
    "♆",
    "🜊",
    "🜅",
    "🜖",
    "🜋",
    "🜏",
    "♈︎",
    "♉︎",
    "♊︎",
    "♋︎",
    "♌︎",
    "♍︎",
    "♎︎",
    "♏︎",
    "♐︎",
    "♑︎",
    "♒︎",
    "♓︎",
];

function randomlyAddedSymbols() {
    const howMany = Math.floor(Math.random() * 4) + 1; // 1..4
    const dirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);
    const out = [];
    for (let i = 0; i < howMany; i++) {
        out.push({
            direction: dirs[i],
            symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        });
    }
    return out;
}

function escapeHTML(s) {
    return s.replace(
        /[&<>"']/g,
        (m) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            }[m])
    );
}

function renderLetter(char) {
    // Cas espace : pas de symboles, et la classe est .space
    if (char === " ") {
        return `<span class="space"><span>&nbsp;</span></span>`;
    }

    const extras = randomlyAddedSymbols();
    const charHTML = escapeHTML(char);
    const extraHTML = extras
        .map(
            ({ symbol, direction }) =>
                `<i class="symbol ${direction}" data-dir="${direction}">${symbol}</i>`
        )
        .join("");

    return `<span class="letter"><span class="e-letter">${charHTML}</span><span class="t-letter">${charHTML}</span><b></b>${extraHTML}</span>`;
}

export function initEnochian(container = Context.container) {
    // Initialize Enochian UI components here
    qsa(container, "enoch").forEach((el) => {
        // split each letter into a span
        const text = el.textContent;
        el.innerHTML = text
            .toLowerCase()
            /* replace tout ce qui n'est pas une lettre de a à z ou un espace */
            .toString()
            .normalize("NFD")
            .trim()
            .replace(/[^a-z ]/g, "")
            .split("")
            .map(renderLetter)
            .join("");
    });
}
