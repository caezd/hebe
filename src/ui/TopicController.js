import { qs } from "../core/utils";

export class TopicController {
    constructor({ map }) {
        this.map = map;
        this.topicsContainer = qs(document, ".map__asideContainer.topicList");
        this.asideContainer = qs(document, ".map__asideContainer.newTopic");
        this.isCreating = false;
        this.isAsideOpened = false;
    }

    initNewTopic(coords, district) {
        this.isCreating = { coords, district };
        this.openAside();
        this.moveNewTopic();
    }

    moveNewTopic(coords, district) {
        this.isCreating = { coords, district };
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
