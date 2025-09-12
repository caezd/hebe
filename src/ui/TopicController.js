import { qs } from "../core/utils";

export class TopicController {
    constructor({ map }) {
        this.map = map;
        this.topicsContainer = qs(document, ".map__asideContainer.topicList");
        this.asideContainer = qs(document, ".map__asideContainer.newTopic");
        this.toggleButton = qs(document, ".newTopic__closeButton");
        this.isCreating = false;
        this.isAsideOpened = false;
        this.loadState();
    }

    loadState() {
        /* consulte le localstore pour voir si un topic est en cours de création */
        const savedTopic = localStorage.getItem("newTopic");
        if (savedTopic) {
            const { coords, district, subject, message } =
                JSON.parse(savedTopic);
            this.isCreating = { coords, district, subject, message };
            this.toggleButton.classList.add("show");
        }
    }

    updateState() {
        console.log("updateState", this.isCreating);
        if (this.isCreating) {
            localStorage.setItem("newTopic", JSON.stringify(this.isCreating));
        }
    }

    initNewTopic(coords, district) {
        this.isCreating = { coords, district };
        this.openAside();
        this.moveNewTopic();
    }

    moveNewTopic(coords, district) {
        this.isCreating = { ...this.isCreating, coords, district };
        this.updateState();

        this.openAside();
    }

    toggleAside() {
        this.isAsideOpened = !this.isAsideOpened;
        if (this.isAsideOpened) {
            this.openAside();
        } else {
            this.closeAside();
        }
    }

    openAside() {
        this.asideContainer.classList.add("active");
        this.topicsContainer.classList.remove("active");
    }

    closeAside() {
        this.asideContainer.classList.remove("active");
        this.isCreating = false;
    }
}
