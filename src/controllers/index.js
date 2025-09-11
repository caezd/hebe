export function initLayout({
    gsap,
    maplibregl,
    styleUrl,
    fetchForums,
    ...deps
}) {
    const menu = createHomeMenuController({ gsap, fetchForums, ...deps });
    const map = createMapController({ maplibregl, styleUrl, gsap, ...deps });

    menu.on("open", () => {
        /* ... */
    });
    return {
        destroy() {
            menu.destroy();
            map.destroy();
        },
        closeAll() {
            menu.close();
            map.close();
        },
    };
}
