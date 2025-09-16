/* présence rp */
const PRESENCE_FIELD_ID = "field_id1";

function setLocalWithExpiry(key, value, ttl) {
    const now = new Date();

    // `item` is an object which contains the original value
    // as well as the time when it's supposed to expire
    const item = {
        value: value,
        expiry: now.getTime() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
}

function getLocalWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    // if the item doesn't exist, return null
    if (!itemStr) {
        return null;
    }
    const item = JSON.parse(itemStr);
    const now = new Date();
    // compare the expiry time of the item with the current time
    if (now.getTime() > item.expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        localStorage.removeItem(key);
        return null;
    }
    return item.value;
}

const memoizedStatus = () => {
    let cache = {};
    return (n) => {
        if (n in cache) {
            console.log("Fetching from cache");
            return cache[n];
        } else {
            var result = "";
            console.log("Calculating result");
            switch (n) {
                case "Présent(e)":
                    result = "present";
                    break;
                case "Réduite":
                    result = "slowed";
                    break;
                case "Absent(e)":
                    result = "away";
                    break;
            }
            cache[n] = result;
            return result;
        }
    };
};
const getStatus = memoizedStatus();

const user_anchors = document.querySelectorAll('a[href^="/u"]');

const getUsersPresence = () => {
    const user_list = {};
    user_anchors.forEach((el) => {
        const user_url = el.pathname;
        const user_id = el.pathname.slice(2);
        user_list[user_id] = user_url;
    });
    return user_list;
};

const parseUsersPresence = async (id, url) => {
    const user_list = [];
    await fetch(url)
        .then((res) => res.text())
        .then((html) => {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, "text/html");
            user_list.push({
                id,
                status: doc.querySelector(
                    `#${PRESENCE_FIELD_ID} div.field_uneditable`
                ).innerText,
            });
        });
    user_list.forEach((obj) => {
        document
            .querySelectorAll(`a[href="/u${obj.id}"] strong`)
            .forEach((el) => {
                const statusElement = document.createElement("span");
                statusElement.classList.add("status", getStatus(obj.status));

                el.appendChild(statusElement);
            });
    });
};

export function initPresence() {
    for (const [id, url] of Object.entries(getUsersPresence())) {
        parseUsersPresence(id, url);
    }
}

/* présence rp */
