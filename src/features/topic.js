// features/subject/SubjectScripts.js
// Refactor minimal du bloc "SubjectScripts" depuis menu.js (comportement identique)
import Context from "../core/context.js";
import { qsa } from "../core/utils.js";

export function initTopicScripts(root = Context.container) {
    const container = root || document;

    /* Date with Tyme.js */
    qsa(container, ".postbody__date-time").forEach((el) => {
        el.innerHTML = new Tyme(el).fromNow();
    });
    try {
        /* ----------------------------
         * EditorJS: normaliser les paragraphes
         * ---------------------------- */
        const messages = container.querySelectorAll(".postbody");
        messages.forEach((message) => {
            const content = message.querySelector(".grid-content");
            if (!content) return;

            const trim = (str) => str.replace(/^\s+|\s+$/g, "");
            const arr = [];

            for (let i = 0; i < content.childNodes.length; i++) {
                const elem = content.childNodes[i];
                if (elem.nodeType === 3) {
                    const newElem = document.createElement("p");
                    newElem.innerHTML = trim(elem.nodeValue);
                    elem.parentNode.insertBefore(newElem, elem.nextSibling);
                    content.removeChild(elem);
                    arr.push(newElem);
                } else {
                    arr.push(elem);
                }
            }

            const paragraphs = arr
                .filter((k) => k.nodeName !== "BR")
                .filter((k) => k.nodeName === "P" && k.childNodes.length === 0);

            const frag = document.createDocumentFragment();
            for (let i = 0; i < paragraphs.length; ++i)
                frag.appendChild(paragraphs[i]);
            content.appendChild(frag);
        });

        /* ----------------------------
         * Masquer des profils (œil) + localStorage
         * ---------------------------- */
        const appendToStorage = (name, data) => {
            let list = JSON.parse(localStorage.getItem(name));
            if (list == null) list = [];
            const idx = list.indexOf(data);
            if (idx === -1) list.push(data);
            else list.splice(idx, 1);
            localStorage.setItem(name, JSON.stringify(list));
        };

        const hideProfiles = () => {
            const items = JSON.parse(localStorage.getItem("hiddenProfiles"));
            if (items === null) return;

            if (items.length === 0) {
                container
                    .querySelectorAll(".subject__profileAvatar")
                    .forEach((a) => {
                        a.classList.remove("blurred");
                    });
            }

            items.forEach((u) => {
                const avatars = container.querySelectorAll(
                    `.subject__profileAvatar > a[href ^= "/${u}"]`
                );
                const removeOthers = container.querySelectorAll(
                    `.subject__profileAvatar > a:not([href ^= "/${u}"])`
                );
                avatars.forEach((a) =>
                    a
                        .closest(".subject__profileAvatar")
                        .classList.add("blurred")
                );
                removeOthers.forEach((a) =>
                    a
                        .closest(".subject__profileAvatar")
                        .classList.remove("blurred")
                );
            });
        };

        container.querySelectorAll(".subject__profileEye").forEach((eye) => {
            eye.addEventListener("click", () => {
                const u = eye
                    .closest(".subject__profileAvatar")
                    .querySelector('a[href^="/u"]')
                    .pathname.replace(/^./, "");
                appendToStorage("hiddenProfiles", u);
                hideProfiles();
            });
        });
        hideProfiles();

        /* ----------------------------
         * Triggers <tw> → #triggers
         * ---------------------------- */
        const nextBR = (elem) => {
            do {
                elem = elem.nextSibling;
            } while (elem && elem.nodeType !== 1);
            if (elem && elem.tagName === "BR") return elem;
        };
        /* const allTriggers = [];
        const appendTriggers = () => {
            const triggersContainer = container.querySelector("#triggers");
            const triggersEls = container.querySelectorAll("tw");
            if (!triggersContainer || !triggersEls.length) return;
            triggersEls.forEach((el) => {
                const triggersArr = el.textContent
                    .split(",")
                    .map((v) => v.trim());
                triggersArr.forEach((t) => allTriggers.push(t));
                nextBR(el)?.remove();
                el.remove();
            });
            allTriggers.forEach((trigger, idx, array) => {
                const text =
                    idx === array.length - 1 ? trigger : trigger + ", ";
                triggersContainer.innerHTML += text;
            });
        };
        appendTriggers(); */

        /* ----------------------------
         * Helpers profil (nom/couleur/groupe)
         * ---------------------------- */
        const splitNames = (p) => {
            const name = p.querySelector(".username strong");
            if (!name) return null;
            name.innerHTML = name.innerText
                .split("")
                .map((e) =>
                    !e.trim() ? "<div>&nbsp</div>" : "<div>" + e + "</div>"
                )
                .join("");
            return name;
        };

        const applyColorFromName = (name) => {
            if (!name) return null;
            const color = name.parentElement.style.color;
            name.closest(".subject__post").style = "--accentColor:" + color;
            return color;
        };

        const getGroup = (color) => {
            const groups = {
                djinn: "rgb(255, 107, 139)",
                human: "rgb(115, 169, 255)",
            };
            return Object.keys(groups).find((key) => groups[key] === color);
        };

        /* ----------------------------
         * Déplacement champs profil + Chart OCEAN
         * ---------------------------- */
        const pfields = container.querySelectorAll(".pfield");
        pfields.forEach(function (field) {
            var name = field.textContent
                .split(" ")[0]
                .toLowerCase()
                .replace(/'/g, "")
                .replace(/\(|\)/g, "");
            field.closest(".pfield").classList.add(name);
        });
        const moveField = (p, item, to) => {
            const el = p.querySelectorAll(`.pfield.${item} `);
            let value = "";
            el.forEach((e) => {
                value = e.querySelector(".pcontent")?.textContent || "";
                e.closest(".subject__profileWrapper")
                    .querySelector(to)
                    ?.appendChild(e);
            });
            return value;
        };

        const createChart = (p, color, values) => {
            const ctx = p.querySelector(".subject__profileChart canvas");
            if (!ctx || !window.Chart) return null;
            return new Chart(ctx, {
                type: "line",
                data: {
                    labels: ["O", "C", "E", "A", "N"],
                    datasets: [
                        {
                            data: values,
                            borderWidth: 2,
                            borderColor: color,
                            fill: true,
                            backgroundColor: color,
                        },
                    ],
                },
                options: {
                    aspectRatio: 8,
                    maintainAspectRatio: false,
                    animations: {
                        tension: {
                            duration: 1000,
                            easing: "easeInQuad",
                            from: 0,
                            to: 0.4,
                            loop: true,
                        },
                    },
                    scales: {
                        y: { display: false, min: -10, max: 10 },
                        x: { display: false },
                    },
                    layout: { padding: 0 },
                    elements: { point: { pointRadius: 0 } },
                    plugins: {
                        tooltip: { enabled: false },
                        title: { display: false },
                        subtitle: { display: false },
                        legend: { display: false },
                    },
                },
            });
        };

        /* ----------------------------
         * Symboles (hover / mapping)
         * ---------------------------- */
        const createSymbols = (p, group) => {
            const symbolElements = p.querySelectorAll(
                ".subject__profileSymbol"
            );
            symbolElements.forEach((el) => {
                const symbol = el.dataset.symbol;
                el.addEventListener("mouseenter", (e) => {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    if (target) target.dataset.symbol = symbol;
                });
            });

            const symbolList = p.querySelectorAll(".subject__profileMeta");
            symbolList.forEach((el) => {
                el.addEventListener("mouseenter", (e) => {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    target?.classList.add("symbol");
                });
                el.addEventListener("mouseleave", (e) => {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    target?.classList.remove("symbol");
                });
            });
        };

        const moveSymbol = (p, item, to, group) => {
            const f = p.querySelectorAll(`.pfield.${item} `);
            if (!f || !f.length) return;
            const [name, desc] = f;

            const labelName =
                group == "djinn"
                    ? (name
                          .querySelector(".plabel span[style]")
                          .textContent.split(")")[0] += ")")
                    : "Vœu";
            const labelContent =
                name.querySelector(".pcontent")?.textContent || "";
            const description =
                desc.querySelector(".pcontent")?.textContent || "";

            const label = p.querySelector(
                `.subject__symbolsTrack.${to} .label`
            );
            if (label) label.innerText = labelName;
            const content = p.querySelector(
                `.subject__symbolsTrack.${to} .content`
            );
            if (content) content.innerText = labelContent;
            const descr = p.querySelector(`.subject__symbolsTrack.${to} .desc`);
            if (descr) descr.innerText = description;
        };

        /* ----------------------------
         * Application sur chaque bloc profil
         * ---------------------------- */
        const allProfiles = container.querySelectorAll(
            ".subject__profileBlock"
        );
        allProfiles.forEach((profile) => {
            const name = splitNames(profile);
            const color = applyColorFromName(name);
            const group = getGroup(color);
            const chartValues = [];

            const ocean = [
                "ouverture",
                "conscienciosité",
                "extraversion",
                "agréabilité",
                "neuroticisme",
            ];
            const fields = {
                messages: ".subject__profileNumbers",
                points: ".subject__profileNumbers",

                ouverture: ".subject__profileChart div",
                conscienciosité: ".subject__profileChart div",
                extraversion: ".subject__profileChart div",
                agréabilité: ".subject__profileChart div",
                neuroticisme: ".subject__profileChart div",

                âge: ".subject__profileFacts",
                pronoms: ".subject__profileFacts",
                faceclaim: ".subject__profileFacts",

                citation: ".subject__profileQuote",
            };

            for (const [key, to] of Object.entries(fields)) {
                const content = moveField(profile, key, to);
                if (ocean.indexOf(key) > -1)
                    chartValues.push(Number(content) || 0);
            }

            createChart(profile, color, chartValues);
            createSymbols(profile, group);
            moveSymbol(profile, "salt", "body", group);
            moveSymbol(profile, "mercury", "mind", group);
            moveSymbol(profile, "sulfur", "soul", group);
        });
    } catch (e) {
        console.log(e);
    }
}
