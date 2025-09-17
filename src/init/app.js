import Context from "../core/context.js";
import CursorController from "../ui/CursorController.js";
import { initBarba, onNamespace, getRegisteredNamespaces } from "./barba.js";

import { initRegisterScripts } from "../features/register.js";
import { initTopicScripts } from "../features/topic.js";
import { initLayoutScripts } from "../features/layout.js";
import { initFAQScripts } from "../features/faq.js";
import { initEnochian } from "../ui/Enochian.js";
import { initTimelineCalendar, CalendarKill } from "../features/calendar.js";

import Glossary from "../ui/Glossary.js";
import { Notepad } from "../ui/Notepad.js";

// ex:

export function initUI() {
  document
    .querySelectorAll('div[style^="height:"')
    .forEach((el) => el.remove());

  Context.container =
    document.querySelector('section[data-barba="container"]') || document;

  const cursor = CursorController.init();

  new Notepad();

  initLayoutScripts();
  // REGISTER
  onNamespace("register", { afterEnter: async () => initRegisterScripts() });
  // TOPIC
  onNamespace("topic", {
    afterEnter: async ({ next }) => {
      initTopicScripts(next.container);
      initEnochian(next.container);
    },
  });
  // FAQ
  onNamespace("faq", {
    afterEnter: async ({ next }) => {
      initFAQScripts(next.container);
      initEnochian(next.container);
      Glossary.init({
        url: "http://127.0.0.1:8080/faq.json",
      });
    },
  });

  onNamespace("calendar", {
    afterEnter: async ({ next }) => {
      await initTimelineCalendar(next.container);
    },
  });

  console.debug("[barba] registered ns hooks:", getRegisteredNamespaces());

  initBarba({ cursor });

  return { Context, cursor };
}
