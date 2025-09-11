import { Chart } from "https://cdn.jsdelivr.net/npm/chart.js@4.2.1/auto/+esm";

import localforage from "https://cdn.jsdelivr.net/npm/localforage@1.10.0/+esm";

import "https://dl.dropbox.com/s/4b76cltajvc3w16/bundle.js";

const Context = (function () {
    let hooks = [];
    let currentIndex = 0;
    let container = null;

    const update = () => {
        console.log("Context updated!");
    };

    return {
        container,
        useState(initialValue) {
            const useStateIndex = currentIndex;
            currentIndex++;

            hooks[useStateIndex] = hooks[useStateIndex] ?? initialValue;

            const setState = (newValue) => {
                const newState =
                    typeof newValue === "function"
                        ? newValue(hooks[useStateIndex])
                        : newValue;
                hooks[useStateIndex] = newState;
                update();
            };

            return [hooks[useStateIndex], setState];
        },
        useReducer(reducer, initialState) {
            const useReducerIndex = currentIndex;
            currentIndex++;

            hooks[useReducerIndex] = hooks[useReducerIndex] ?? initialState;

            const dispatch = (action) => {
                const newState = reducer(hooks[useReducerIndex], action);
                hooks[useReducerIndex] = newState;
                update();
            };

            return [hooks[useReducerIndex], dispatch];
        },
        useEffect(callback, dependenciesArray) {
            const hasNoDependencies = !dependenciesArray;
            const dependencies = hooks[currentIndex];
            const hasChangedDependencies = dependencies
                ? !dependenciesArray.every((el, i) => el === dependencies[i])
                : true;
            if (hasNoDependencies || hasChangedDependencies) {
                hooks[currentIndex] = dependenciesArray;
                callback();
            }
            currentIndex++;
        },
    };
})();

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-");
};

gsap.registerPlugin(CustomEase);

const els = {
    boardContainer: document.querySelector("#board"),
    boardContent: document.querySelector("#board-content"),
    boardButton: document.querySelector("#menu"),
};

let easeCurve = "M0,0,C0.625,0,0,1,1,1";
let he = {
    coverFrom: {
        transform: "scaleY(0)",
    },
    coverTo: {
        transform: "scaleY(1)",
    },
    coverExitFrom: {
        height: "100%",
    },
    coverExitTo: {
        height: "0%",
    },
    fadeFrom: {
        autoAlpha: 0,
    },
    fadeTo: {
        autoAlpha: 1,
    },
    fadeUpFrom: {
        autoAlpha: 0,
        transform: "translateY(20px)",
    },
    fadeUpTo: {
        autoAlpha: 1,
        transform: "translateY(0)",
    },
    growDownFrom: {
        height: "0%",
    },
    growDownTo: {
        height: "100%",
    },
    growRightFrom: {
        width: "0%",
    },
    growRightTo: {
        width: "100%",
    },
    fadeFromLeft50From: {
        autoAlpha: 0,
        transform: "translateX(-50%)",
    },
    fadeFromLeft50To: {
        autoAlpha: 1,
        transform: "translateX(0)",
    },
};

class Badge {
    constructor(element, options) {
        this.value = 0;
        this.options = options || {
            badgeClass: "notification-badge",
            badgeCounterClass: "notification-counter",
            animationSpeed: 150,
            countLimit: 99,
        };
        if (!element) return;
        this.element = element;
        this.render();
        this.badgeElement = element.querySelector(
            "." + this.options.badgeClass
        );
        this.badgeCounterElement = element.querySelector(
            "." + this.options.badgeCounterClass
        );
    }

    render() {
        let counter = document.createElement("SPAN");
        counter.className = this.options.badgeClass;
        counter.innerHTML = `<span class="${this.options.badgeCounterClass}">0</span>`;

        this.element.appendChild(counter);
    }

    set(n) {
        n = n || 0;
        let newCounterElement = this.badgeCounterElement.cloneNode();

        // If value is somehow become wrong, wrong type, less than 0, or NaN.
        // Then hide everything and log an error.
        if (typeof n != "number" || n < 0 || isNaN(n)) {
            console.error("Wrong type or n(" + n + ") is less then 0!");
            this.badgeElement.classList.remove("notification-badge--active");
            this.badgeCounterElement.innerHTML = "";

            return false;
        }

        if (n === 0) {
            this.badgeElement.classList.remove("notification-badge--active");
            this.badgeCounterElement.innerHTML = "";

            return false;
        }

        if (n > this.options.countLimit) {
            this.badgeElement.classList.add("notification-badge--limit");
        } else {
            this.badgeElement.classList.remove("notification-badge--limit");
        }

        if (
            !this.badgeElement.classList.contains("notification-badge--active")
        ) {
            this.badgeElement.classList.add("notification-badge--active");
        }

        let timer;
        let animate = new Promise((resolve, reject) => {
            newCounterElement.innerHTML = n;
            newCounterElement.classList.add("notification-counter--new");
            this.badgeCounterElement.classList.add("notification-counter--old");
            this.badgeCounterElement.after(newCounterElement);

            if (timer) clearTimeout(timer);
            timer = setTimeout(resolve, 0);
        });

        animate.then(
            () => {
                newCounterElement.classList.remove("notification-counter--new");
                setTimeout(() => {
                    this.badgeCounterElement.remove();
                    this.badgeCounterElement = newCounterElement;
                }, this.options.animationSpeed);
            },
            () => false
        );
    }

    get() {
        let n =
            parseInt(
                this.element.querySelector("." + this.options.badgeCounterClass)
                    .innerHTML
            ) || 0;
        return typeof n != "number" ? this.value : n;
    }

    decrease(n) {
        n = n || 1;
        this.value = this.get() || 0;

        if (this.value - n < 0) {
            return false;
        }

        this.set(this.value - n);
    }

    increase(n) {
        n = n || 1;
        this.value = this.get() || 0;

        if (this.value + n < 0) {
            return false;
        }

        this.set(this.value + n);
    }
}

function homeForums() {
    const forums = document.querySelectorAll(".category__forums");

    forums.forEach((forum) => {
        const track = forum.querySelector(".category__forumsTrack");
        forum.addEventListener("mouseover", function (e) {
            var rect = forum.getBoundingClientRect();
            var x = e.clientX - rect.left;

            forum.dataset.mouseDownAt = x;
        });

        forum.addEventListener("mouseout", function (e) {
            forum.dataset.mouseDownAt = "0";
        });

        forum.addEventListener("mousemove", function (e) {
            if (forum.dataset.mouseDownAt === "0") return;
            var rect = forum.getBoundingClientRect();
            var x = e.clientX - rect.left; //x position within the element.

            const mouseDelta = x,
                maxDelta = rect.width;
            const mouseReverseDelta = (x - maxDelta) * -1;

            const percentageUnconstrained =
                    (mouseReverseDelta / maxDelta) * 100,
                percentage = Math.min(
                    100,
                    Math.max(0, parseFloat(percentageUnconstrained))
                );

            forum.dataset.percentage = percentage;

            gsap.to(track, {
                transform: `translateX(calc(${percentage}% - ${
                    (percentage * maxDelta) / 100
                }px))`,
                duration: 1.2,
                ease: "power4",
            });

            for (const image of track.getElementsByTagName("img")) {
                gsap.to(image, {
                    objectPosition: `${100 + percentage * -1}% center`,
                    duration: 1.2,
                    ease: "power4",
                });
            }

            /* 
                start from right side
                if percent > 0, then fade out category title
            */

            const categoryTitle = forum
                .closest(".category")
                .querySelector(".category__header");
            //if percentage > 0.2, then fade out category title
            if (forum.dataset.percentage > 10) {
                gsap.to(categoryTitle, {
                    opacity: 0,
                    duration: 1,
                });
            } else {
                gsap.to(categoryTitle, {
                    opacity: 1,
                    duration: 1,
                });
            }
        });
    });
}

function page_type() {
    var p = location.pathname;
    console.log(p);
    if (/^\/t[1-9][0-9]*(p[1-9][0-9]*)?-/.test(p)) return "topic";
    if (/^\/f[1-9][0-9]*(p[1-9][0-9]*)?-/.test(p)) return "forum";
    if ($("#i_icon_mini_index").parent().attr("href") == p || p === "/")
        return "index";
    if (/^\/post/.test(p)) return "editor";
    if (/^\/c[1-9][0-9]*-/.test(p)) return "category";
    if (/^\/u([1-9][0-9]*)[a-z]*$/.test(p)) return "profile";
    var qs = p + location.search;
    var m = qs.match(/\/modcp\?mode=([^&]+)/);
    return m ? m[1] : "";
}

let globalTimeline;

/* fn must be a promise */
const memoizePromiseFn = (fn) => {
    const cache = new Map();

    return (...args) => {
        const key = JSON.stringify(args);

        if (cache.has(key)) {
            return cache.get(key);
        }

        cache.set(
            key,
            fn(...args).catch((error) => {
                // Delete cache entry if API call fails
                cache.delete(key);
                return Promise.reject(error);
            })
        );

        return cache.get(key);
    };
};

const fetchProfile = (id) => {
    return fetch(`/${id}`)
        .then((response) => response.text())
        .then((data) => {
            var parser = new DOMParser();
            return parser.parseFromString(data, "text/html");
        });
};

let cachedFetchProfiles = memoizePromiseFn(fetchProfile);

const buildFooter = () => {
    const lastTopics = document.querySelectorAll(
        "#comments_scroll_div .mod-recent-row"
    );

    lastTopics.forEach((el) => {
        try {
            const authorLink = el.querySelector(".mod-recent-author a");
            const profilePathname = authorLink.pathname.slice(1);
            const profile = cachedFetchProfiles(profilePathname).then((doc) => {
                const avatar = doc.querySelector("#avatar").innerHTML;
                const z = document.createElement("div"); // is a node
                z.innerHTML = avatar;
                authorLink.appendChild(z);
            });
        } catch (e) {
            console.log("buildfooter", e);
        }
    });
};

function clearGlobal() {
    globalTimeline = null;
    els.boardContainer.classList.add("onLoad");
}

function clearPercentageForums() {
    const forums = document.querySelectorAll(".category__forums");
    forums.forEach((forum) => {
        forum.dataset.percentage = 0;
    });
}

let navAnimation = function (e) {
    let n = arguments.length > 1 && void 0 !== arguments[1] && arguments[1],
        t = document,
        i = t.querySelectorAll(".anim-bg-cover"),
        r = t.querySelectorAll(".anim-bg"),
        l = t.querySelectorAll(".anim-fadeUp"),
        o = t.querySelectorAll(".anim-fade"),
        p = t.querySelectorAll(".anim-fadeFromLeft-50"),
        right = t.querySelectorAll(".anim-br"),
        bottom = t.querySelectorAll(".anim-bb");

    const timeline = gsap.timeline({
        defaults: {
            duration: 1,
            ease: CustomEase.create("custom", easeCurve),
        },
        onReverseComplete: () => {
            clearGlobal();
            clearPercentageForums();
        },
    });

    timeline
        .fromTo(i, he.coverFrom, he.coverTo)
        .fromTo(i, he.coverExitFrom, he.coverExitTo, 0.7)
        .fromTo(r, he.coverFrom, he.coverTo, 0.7)
        .fromTo(o, he.fadeFrom, he.fadeTo, 1.7, { stagger: 0.033 })
        .fromTo(p, he.fadeFromLeft50From, he.fadeFromLeft50To, 1.7, {
            stagger: 0.033,
        })
        .fromTo(l, he.fadeUpFrom, he.fadeUpTo, 1.7, { stagger: 0.033 })
        .fromTo(right, he.growDownFrom, he.growDownTo, 1.4, { stagger: 0.033 })
        .fromTo(bottom, he.growRightFrom, he.growRightTo, 1.4, {
            stagger: 0.2,
        });

    globalTimeline = timeline;
};

const cursor = {
    cursor: document.querySelector("#cursor"),
    cursorFollow: document.querySelector("#cursorFollow"),
    postbody: document.querySelectorAll(".postbody"),
    progressPath: document.querySelector(".progress-wrap path"),
    pathLength() {
        return this.progressPath.getTotalLength();
    },
    forums: document.querySelectorAll(".forum"),
    stopFollow: false,
    init() {
        this.bindEvents();
        this.bindScroll();
    },
    bindEvents() {
        document.addEventListener("mouseenter", (e) => {
            this.cursor.animate(
                { opacity: 1 },
                {
                    duration: 300,
                    fill: "forwards",
                }
            );
            this.cursorFollow.animate(
                { opacity: 1 },
                {
                    duration: 300,
                    fill: "forwards",
                }
            );
        });
        document.addEventListener("mouseleave", (e) => {
            this.cursor.animate(
                { opacity: 0 },
                {
                    duration: 300,
                    fill: "forwards",
                }
            );
            this.cursorFollow.animate(
                { opacity: 0 },
                {
                    duration: 300,
                    fill: "forwards",
                }
            );
        });
        document.addEventListener("mousemove", (e) => {
            const target = e.target;
            let leftPosition = e.pageX;
            let topPosition = e.pageY;

            this.cursor.style.left = leftPosition + "px";
            this.cursor.style.top = topPosition + "px";

            if (
                target.matches(
                    ".txt, .txt *, .ce-block__content, .ce-block__content *"
                )
            ) {
                this.cursor.classList.add("text");
            } else {
                this.cursor.classList.remove("text");
            }

            if (target.matches(".forum, .forum *")) {
                this.cursor.classList.add("eye");
            } else {
                this.cursor.classList.remove("eye");
            }

            if (target.matches(".btn, .btn *")) {
                this.stopFollow = true;
                let element = target.closest(".btn");
                let rect = element.getBoundingClientRect();
                let data = {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                };
                this.cursorFollow.classList.add("static");
                this.cursor.classList.add("hide");
                gsap.to(this.cursorFollow, {
                    top: data.y + data.h / 2,
                    left: data.x + data.w / 2,
                    width: data.w,
                    height: data.h,
                    duration: 0.5,
                    ease: "power4",
                });
            } else if (target.matches(".subject__profileSymbol")) {
                this.stopFollow = true;
                let element = target.closest(".subject__profileSymbol");
                let rect = element.getBoundingClientRect();
                let data = {
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height,
                };
                gsap.to(this.cursorFollow, {
                    top: data.y + data.h / 2,
                    left: data.x + data.w / 2,
                    width: data.w,
                    height: data.h,
                    duration: 0.5,
                    ease: "power4",
                });
            } else {
                this.stopFollow = false;
                gsap.to(this.cursorFollow, {
                    width: 40,
                    height: 40,
                    duration: 0.2,
                    ease: "power4",
                });
            }
            if (!this.stopFollow) {
                this.cursorFollow.classList.remove("static");
                this.cursor.classList.remove("hide");
                gsap.to(this.cursorFollow, {
                    top: topPosition,
                    left: leftPosition,
                    duration: 0.6,
                    ease: "power4",
                });
            }
        });

        document.addEventListener(
            "scroll",
            (e) => {
                if (e.target.dataset.barba === "container") {
                    this.updateProgress();
                }
            },
            true
        );
    },

    bindScroll() {
        // scroll progress
        this.progressPath.style.strokeDasharray =
            this.pathLength() + " " + this.pathLength();
        this.updateProgress();
    },

    currentContainer() {
        return document.querySelector('section[data-barba="container"]');
    },

    updateProgress() {
        var scroll = this.currentContainer().scrollTop;
        var height = this.currentContainer().scrollHeight - window.innerHeight;
        var progress =
            this.pathLength() - (scroll * this.pathLength()) / height;
        this.progressPath.style.strokeDashoffset = progress;
    },
};

const notificationBadge = new Badge(
    els.boardButton.querySelector(".notification")
);
const fetchForums = () => {
    if (page_type() === "index") {
        document.querySelector("#js-board").innerHTML = "";
    }
    return fetch("/")
        .then((response) => response.text())
        .then((data) => {
            var parser = new DOMParser();
            return parser.parseFromString(data, "text/html");
        });
};

function initForums() {
    var app = new Gooey("#app", {
        template: "#gooey",
        data: {
            categoryPosts: function (e) {
                return e.reduce(function (a, b) {
                    return Number(a) + Number(b.posts);
                }, 0);
            },
        },
    });
    app.render();
    homeForums();
}

const initCountNewForums = () => {
    const count = 50;
    notificationBadge.set(count);
};

const onBoardButtonClicked = async () => {
    if (globalTimeline) {
        // closing
        els.boardButton.classList.remove("active");
        globalTimeline.timeScale(2).reverse();
        return;
    } else {
        // opening
        await fetchForums()
            .then((data) => {
                let boardContent = data.querySelector("#js-board").innerHTML;
                els.boardContent.innerHTML = boardContent;
            })
            .then(() => {
                initForums();
                initCountNewForums();
                els.boardButton.classList.add("active");
                els.boardContainer.classList.remove("onLoad");
            });
    }

    navAnimation();
};

// if button is clicked, run navAnimation
els.boardButton.addEventListener("click", onBoardButtonClicked);
// but if it's clicked again, run navAnimation in reverse

const isInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
            (window.innerWidth || document.documentElement.clientWidth)
    );
};

const animateLinesIn = (container, callback) => {
    const timeline = gsap.timeline({
        ease: CustomEase.create("custom", easeCurve),
        onComplete: callback,
    });

    const bbs = container.querySelectorAll(".bb");

    for (var i = 0; i < bbs.length; i++) {
        timeline.to(
            bbs[i],
            {
                width: "100%",
                duration: 0.2,
                delay: i * 0.03,
            },
            "horizontal"
        );
    }

    const brs = container.querySelectorAll(".br");
    for (var i = 0; i < brs.length; i++) {
        timeline.to(
            brs[i],
            {
                height: "100%",
                duration: 0.2,
                delay: i * 0.03,
            },
            "vertical"
        );
    }

    const bls = container.querySelectorAll(".bl");
    for (var i = 0; i < bls.length; i++) {
        timeline.to(
            bls[i],
            {
                height: "100%",
                duration: 0.2,
                delay: i * 0.03,
            },
            "vertical"
        );
    }
};
const animateLinesOut = (container, callback) => {
    const timeline = gsap.timeline({
        ease: CustomEase.create("custom", easeCurve),
        onComplete: callback,
    });
    const brs = container.querySelectorAll(".br");

    for (var i = 0; i < brs.length; i++) {
        timeline.to(
            brs[i],
            {
                top: i % 2 == 0 ? "+=100%" : 0,
                height: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "vertical"
        );
    }
    const bls = container.querySelectorAll(".bl");
    for (var i = 0; i < bls.length; i++) {
        timeline.to(
            bls[i],
            {
                top: i % 2 == 0 ? "+=100%" : 0,
                height: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "vertical"
        );
    }

    const bbs = container.querySelectorAll(".bb");
    for (var i = 0; i < bbs.length; i++) {
        timeline.to(
            bbs[i],
            {
                left: i % 2 == 0 ? "+=100%" : 0,
                width: 0,
                duration: 0.2,
                delay: i * 0.03,
            },
            "horizontal"
        );
    }
};

function htmlDecode(input) {
    var doc = new DOMParser().parseFromString(input, "text/html");
    return doc.documentElement.textContent;
}

const customParsers = {
    columns: function (data, config) {
        return `<div class="columns">${htmlDecode(data.text)}</div>`;
    },
    dialog: function (data, config) {
        return `<div class="dialogue">${htmlDecode(data.text)}</div>`;
    },
};

function containsCommentInTemplate(templateElement) {
    const content = templateElement.content;
    const childNodes = content.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
        if (childNodes[i].nodeType === Node.COMMENT_NODE) {
            return true;
        }
    }
    return false;
}

function SubjectScripts() {
    let container = Context.container;
    try {
        //parse editorjs
        const messages = container.querySelectorAll(".postbody");

        messages.forEach((message) => {
            const content = message.querySelector(".grid-content");

            const trim = (str) => str.replace(/^\s+|\s+$/g, "");

            var arr = [];

            for (var i = 0; i < content.childNodes.length; i++) {
                var elem = content.childNodes[i];
                if (elem.nodeType === 3) {
                    var newElem = document.createElement("p");
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

            var frag = document.createDocumentFragment();
            for (var i = 0; i < paragraphs.length; ++i) {
                frag.appendChild(paragraphs[i]);
            }
            console.log(paragraphs);
            content.appendChild(frag);
        });

        const eyes = container.querySelectorAll(".subject__profileEye");
        eyes.forEach((eye) => {
            eye.addEventListener("click", (e) => {
                const u = eye
                    .closest(".subject__profileAvatar")
                    .querySelector('a[href^="/u"]')
                    .pathname.replace(/^./, "");
                appendToStorage("hiddenProfiles", u);
                hideProfiles();
            });
        });

        const hideProfiles = () => {
            const items = JSON.parse(localStorage.getItem("hiddenProfiles"));
            if (items === null) return;
            if (items.length === 0) {
                const allAvatars = container.querySelectorAll(
                    `.subject__profileAvatar`
                );
                allAvatars.forEach((avatar) => {
                    avatar.classList.remove("blurred");
                });
            }

            items.forEach((u) => {
                const avatars = container.querySelectorAll(
                    `.subject__profileAvatar > a[href ^= "/${u}"]`
                );
                const removeOthers = container.querySelectorAll(
                    `.subject__profileAvatar > a:not([href ^= "/${u}"])`
                );
                avatars.forEach((avatar) => {
                    avatar
                        .closest(".subject__profileAvatar")
                        .classList.add("blurred");
                });
                removeOthers.forEach((avatar) => {
                    avatar
                        .closest(".subject__profileAvatar")
                        .classList.remove("blurred");
                });
            });
        };

        hideProfiles();

        const appendToStorage = (name, data) => {
            var existingEntries = JSON.parse(localStorage.getItem(name));
            if (existingEntries == null) existingEntries = [];

            // Save allEntries back to local storage
            const index = existingEntries.indexOf(data);
            if (index == -1) {
                //add the value to the array
                existingEntries.push(data);
            } else {
                existingEntries.splice(index, 1);
            }
            localStorage.setItem(name, JSON.stringify(existingEntries));
        };

        /* triggers
 
        const nextBR = (elem) => {
            do {
                elem = elem.nextSibling;
            } while (elem && elem.nodeType !== 1);
            if (elem.tagName == 'BR') return elem;
        }
        const allTriggers = [];
        const appendTriggers = () => {
            const triggersContainer = container.querySelector('#triggers');
            const triggersEls = container.querySelectorAll('tw');
            triggersEls.forEach(el => {
                const triggersArr = el.textContent.split(',').map(value => value.trim());
                triggersArr.forEach((trigger) => {
                    allTriggers.push(trigger);
                });
                nextBR(el).remove();
                el.remove();
            });
            allTriggers.forEach((trigger, idx, array) => {
                var text = (idx === array.length - 1) ? trigger : (trigger + ', ');
                triggersContainer.innerHTML += text;
            });
        }
 
        appendTriggers();
 
 
 
        /* split names */
        const splitNames = (p) => {
            const name = p.querySelector(".username strong");
            name.innerHTML = name.innerText
                .split("")
                .map((e) =>
                    !e.trim() ? "<div>&nbsp</div>" : "<div>" + e + "</div>"
                )
                .join("");
            return name;
        };

        const applyColorFromName = (name) => {
            let color = name.parentElement.style.color;
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

        /* symbols */
        const createSymbols = (p, group) => {
            const symbolElements = p.querySelectorAll(
                ".subject__profileSymbol"
            );
            symbolElements.forEach(function (el) {
                const symbol = el.dataset.symbol;

                el.addEventListener("mouseenter", function (e) {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    target.dataset.symbol = symbol;
                });
            });

            const symbolList = p.querySelectorAll(".subject__profileMeta");
            symbolList.forEach(function (el) {
                el.addEventListener("mouseenter", function (e) {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    target.classList.add("symbol");
                });
                el.addEventListener("mouseleave", function (e) {
                    const target = e.target
                        .closest(".subject__profileBlock")
                        .querySelector(".subject__profileAvatar");
                    target.classList.remove("symbol");
                });
            });
        };

        /* profile fields */
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
            el.forEach(function (e) {
                value = e.querySelector(".pcontent").textContent;
                e.closest(".subject__profileWrapper")
                    .querySelector(to)
                    .appendChild(e);
            });
            return value;
        };

        const moveSymbol = (p, item, to, group) => {
            const f = p.querySelectorAll(`.pfield.${item} `);
            if (!f) return;
            const [name, desc] = f;

            const labelName =
                group == "djinn"
                    ? (name
                          .querySelector(".plabel span[style]")
                          .textContent.split(")")[0] += ")")
                    : "Vœu";
            const labelContent = name.querySelector(".pcontent").textContent;
            const description = desc.querySelector(".pcontent").textContent;

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

        /* chart */
        const createChart = (p, color, values) => {
            const ctx = p.querySelector(".subject__profileChart canvas");
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
                        y: {
                            display: false,
                            min: -10,
                            max: 10,
                        },
                        x: {
                            display: false,
                        },
                    },
                    layout: {
                        padding: 0,
                    },
                    elements: {
                        point: {
                            pointRadius: 0,
                        },
                    },
                    plugins: {
                        tooltip: {
                            enabled: false,
                        },
                        title: {
                            display: false,
                        },
                        subtitle: {
                            display: false,
                        },
                        legend: {
                            display: false,
                        },
                    },
                },
            });
        };

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
            for (const [key, value] of Object.entries(fields)) {
                /* move each fields to their places */
                const content = moveField(profile, key, value);
                if (ocean.indexOf(key) > -1) {
                    /* add every ocean values to ChartValues */
                    chartValues.push(Number(content) || 0);
                }
            }
            const chart = createChart(profile, color, chartValues);

            /* symbols, powers and wishes */
            createSymbols(profile, group);
            moveSymbol(profile, "salt", "body", group);
            moveSymbol(profile, "mercury", "mind", group);
            moveSymbol(profile, "sulfur", "soul", group);
        });
    } catch (e) {
        console.log(e);
    }
}

function EditorScripts() {
    let container = Context.container;

    console.log("editor might be abandonned");
}

let getSiblings = function (e) {
    // for collecting siblings
    let siblings = [];
    // if no parent, return no sibling
    if (!e.parentNode) {
        return siblings;
    }
    // first child of the parent node
    let sibling = e.parentNode.firstChild;
    // collecting siblings
    while (sibling) {
        if (sibling.nodeType === 1 && sibling !== e) {
            siblings.push(sibling);
        }
        sibling = sibling.nextSibling;
    }
    return siblings;
};
/* register scripts */

const updateIframeRegister = async function (arg) {
    this.url = this.contentWindow.location.href;
    this.content = this.contentWindow.document.querySelector("#cp-main");
    this.html = this.content.cloneNode(true);
    this.foragedForm = await localforage.getItem("registration_form");
    this.fieldsets = this.html.querySelectorAll("fieldset");
    this.formData = {};

    let container = Context.container;

    const getStep = (() => {
        let step = 1;
        if (this.url.indexOf("step=2") > -1) step = 2;
        if (step === 5 && this.html.querySelector("form").id === "form_confirm")
            step = 6;
        if (this.html.querySelector(".randommessageclass")) step = 7; //success register message, machin
        return step;
    })();

    const goToStep = (idx) => {
        const panelToOpen = container.querySelector(
            `.register__panel:nth-child(${idx})`
        );
        const siblings = getSiblings(panelToOpen).map((e) =>
            e.classList.remove("isOpen")
        );
        panelToOpen.classList.add("isOpen");
    };

    const isolateFieldsets = (fieldset) => {
        let dls = fieldset.querySelectorAll("dl");
        let fieldsetData = {};
        dls.forEach((dl) => {
            const title = dl
                .querySelector("dt")
                .textContent.replace(/[*:]/g, "");
            const slug = slugify(title);
            const input = dl.querySelector("dd input, dd textarea, dd select");
            if (input) {
                const inputType = input.tagName.toLowerCase();
                const inputValue =
                    inputType === "select" ? input.value : input.value.trim();
                fieldsetData[slug] = {
                    title: title,
                    type: inputType,
                    value: inputValue,
                    validate: () => {
                        return true;
                    },
                    inputHTML: input,
                    originalHTML: dl,
                };
            }
        });

        return fieldsetData;
    };
    const formatFields = (accountFields, profileFields) => {};
    const getAllFields = (accountFieldset, profileFieldset) => {
        return [
            isolateFieldsets(accountFieldset),
            isolateFieldsets(profileFieldset),
        ];
    };

    const deletePanelContent = (idx) => {
        const panelToDelete = container.querySelector(
            `.register__panel:nth-child(${idx}) .register__panelContentWrapper`
        );
        panelToDelete.remove();
    };

    const initStep = (val) => {
        var drinks = {
            1: function () {
                return "";
            },
            2: async () => {
                const fields = getAllFields(...this.fieldsets);
                const formatedFields = formatFields(...fields);
                goToStep(2);
                await new Promise((r) => setTimeout(r, 400));
                deletePanelContent(1);
                changeFormAction();
            },
            3: function () {
                return "Lemonade";
            },
        };
        if (!drinks[val]) return;
        return drinks[val]();
    };

    initStep(getStep);

    try {
    } catch (err) {
        // This code runs if there were any errors.
        console.log(err);
    }
};

function RegisterScripts() {
    let container = Context.container;
    try {
        const iFrame = container.querySelector("#registerIframe");
        iFrame.addEventListener("load", updateIframeRegister);
    } catch (e) {
        console.log("RegisterScripts:", e);
    }
}

function difference(a, b) {
    return Math.abs(a - b);
}

function FaqScripts() {
    let container = Context.container;
    let slider = container.querySelector(".faq__tab-slider");
    let content = container.querySelector(".faq__scroll");
    let panels = content.querySelectorAll(".faq__content");

    let moveSlider = (el, width = 0) => {
        const rect = el.parentElement.getBoundingClientRect();
        var widths = [
            [`${rect.width}px`],
            [`${rect.width}px`, "250px", `${rect.width}px`],
        ];
        slider.animate(
            {
                left: `${el.parentElement.offsetLeft}px`,
                width: widths[width],
            },
            {
                duration: 500,
                fill: "forwards",
                easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            }
        );
    };

    let scrollContent = (idx) => {
        content.style.transform = `translateX(${idx * -100}%)`;
    };

    let changeSlide = (el, e) => {
        let nextIdx = Number(el.dataset.idx);
        let currentIdx = 0;
        if (!el.classList.contains("active")) {
            // remove all active classes
            var actives = container.querySelectorAll(".faq__tab.active");
            [].forEach.call(actives, function (elem) {
                currentIdx = Number(elem.dataset.idx);
                elem.classList.remove("active");
            });
        }
        el.classList.add("active");

        scrollContent(nextIdx);
        fixHeight(nextIdx);

        moveSlider(el, difference(currentIdx, nextIdx) > 1 ? 1 : 0);
    };

    let fixHeight = (idx) => {
        let height = panels[idx]
            .querySelector(".content")
            .getBoundingClientRect();
        console.log(height);
        container.querySelector(".faq__container").style.height = `${
            height.bottom - height.top
        }px`;
    };

    try {
        const faq = container.querySelector(".faq");
        const tabs = faq.querySelectorAll(".faq__tab");
        if (window.location.hash) {
            let id = window.location.hash.substring(1);
            tabs.forEach((el) => {
                if (el.dataset.id == id) {
                    console.log(el);
                    changeSlide(el);
                }
            });
        } else {
            changeSlide(tabs[0]);
        }
        faq.querySelector(".faq__tab-slider").classList.add("visible");

        tabs.forEach((el) => {
            el.addEventListener("click", (e) => {
                changeSlide(el, e);
            });
        });
    } catch (e) {
        console.log("FaqScripts:", e);
    }
}

const loadScriptsFromView = (namespace, container) => {
    Context.container = container;
    switch (namespace) {
        case "subject":
            SubjectScripts();
            break;
        case "editor":
            EditorScripts();
            break;
        case "forum":
            break;
        case "register":
            RegisterScripts();
            break;
        case "faq":
            FaqScripts();
            break;
        default:
            break;
    }
    buildFooter();
};

const preventProfileLinks = (container) => {
    container
        .querySelectorAll('a[href*="/u"]')
        .forEach((item) => item.setAttribute("data-barba-prevent", "self"));
};

barba.init({
    transitions: [
        {
            name: "default-transition",
            sync: true,
            beforeOnce(data) {
                var done = this.async();
                animateLinesIn(data.next.container, done);
                loadScriptsFromView(data.next.namespace, data.next.container);
                cursor.init();
                preventProfileLinks(data.next.container);
            },
            once(data) {
                var done = this.async();
                const contents =
                    data.next.container.querySelectorAll(".content");
                gsap.to(contents, {
                    alpha: 1,
                    stagger: 0.03,
                    onComplete: done,
                });
            },
            before(data) {
                var done = this.async();
                const contents =
                    data.current.container.querySelectorAll(".content");
                gsap.to(contents, {
                    alpha: 0,
                    stagger: 0.03,
                    onComplete: done,
                });
                // block scroll
                // hide all content
            },
            leave(data) {
                var done = this.async();
                animateLinesOut(data.current.container, done);
            },
            enter(data) {
                var done = this.async();
                animateLinesIn(data.next.container, done);
                loadScriptsFromView(data.next.namespace, data.next.container);
                // animate all new lines
            },
            afterEnter(data) {
                var done = this.async();
                const contents =
                    data.next.container.querySelectorAll(".content");
                gsap.to(contents, {
                    alpha: 1,
                    stagger: 0.03,
                    onComplete: done,
                });
                // show all contents
                // unblock scroll
            },
            after(data) {
                preventProfileLinks(data.next.container);
            },
        },
    ],
});

export { updateIframeRegister };
