const NOTEPAD_STORE_KEY = "notepad";
const notepad_element = document.getElementById("js-notepad");
const notepad_text = localStorage.getItem(NOTEPAD_STORE_KEY) || "";

export class Notepad {
    constructor() {
        if (notepad_element) {
            notepad_element.value = notepad_text;
        }
        notepad_element.addEventListener("input", function () {
            localStorage.setItem(NOTEPAD_STORE_KEY, this.value);
        });
    }
}
