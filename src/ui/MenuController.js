import { Presence } from "./Presence.js";

let teardown = null;

export function initMenu() {
  if (teardown) teardown();

  const btn = document.getElementById("menu");
  const sidebar = document.getElementById("sidebar");

  if (!btn || !sidebar) {
    teardown = null;
    return () => {};
  }

  const isOpen = () => sidebar.classList.contains("open");
  const setOpen = (open) => {
    sidebar.classList.toggle("open", open);
    btn.classList.toggle("active", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const toggle = () => setOpen(!isOpen());

  const onBtnClick = (e) => {
    e.stopPropagation();
    toggle();
  };

  const onDocClick = (e) => {
    if (!e.target.closest(".layout__menu") && isOpen()) setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false);
  };

  btn.addEventListener("click", onBtnClick);
  document.documentElement.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeyDown);

  setOpen(isOpen());

  teardown = () => {
    btn.removeEventListener("click", onBtnClick);
    document.documentElement.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKeyDown);
  };

  /* init presence */
  new Presence();

  return teardown;
}
