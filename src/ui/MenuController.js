// menu.js
let teardown = null;

export function initMenu() {
    // évite les doublons si ré-init (ex: navigation Barba)
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
        btn.classList.toggle("active", open); // ← classe active sur le bouton
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    };
    const toggle = () => setOpen(!isOpen());

    const onBtnClick = (e) => {
        e.stopPropagation();
        toggle();
    };

    const onDocClick = (e) => {
        // ferme si on clique en dehors du conteneur du menu
        if (!e.target.closest(".layout__menu") && isOpen()) setOpen(false);
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape" && isOpen()) setOpen(false);
    };

    // listeners
    btn.addEventListener("click", onBtnClick);
    document.documentElement.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);

    // aligne l'état initial si SSR a déjà mis/retiré .open
    setOpen(isOpen());

    // expose teardown pour Barba
    teardown = () => {
        btn.removeEventListener("click", onBtnClick);
        document.documentElement.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onKeyDown);
    };

    return teardown;
}
