import Context from "../core/context.js";
import CursorController from "../ui/CursorController.js";
import { initBarba, onNamespace, getRegisteredNamespaces } from "./barba.js";

import { initRegisterScripts } from "../features/register.js";
import { initTopicScripts } from "../features/topic.js";
import { initLayoutScripts } from "../features/layout.js";
import { initEnochian } from "../ui/Enochian.js";

// ex:

export function initUI() {
    document
        .querySelectorAll('div[style^="height:"')
        .forEach((el) => el.remove());

    Context.container =
        document.querySelector('section[data-barba="container"]') || document;

    const cursor = CursorController.init();

    initLayoutScripts();
    onNamespace("register", { afterEnter: async () => initRegisterScripts() });
    onNamespace("topic", {
        afterEnter: async ({ next }) => {
            initTopicScripts(next.container);
            initEnochian(next.container);
        },
    });

    console.debug("[barba] registered ns hooks:", getRegisteredNamespaces());

    initBarba({ cursor });

    return { Context, cursor };
}
