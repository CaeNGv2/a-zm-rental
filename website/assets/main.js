// workaround for white/dark flash when navigating.
// quick setting of color-scheme & theme before body loads.
// proper theme management will still happen separately and asynchronously (deferred).
// note: only works as intended when imported before body synchronously (i.e. no type="module" and no defer)
(() => {
  const themeMode = localStorage.getItem("site.theme") ?? "auto";
  const workingTheme = themeMode === "auto"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark" : "light"
      : themeMode;
  document.documentElement.style.colorScheme = workingTheme;
  document.documentElement.setAttribute("data-theme", workingTheme);
  document.documentElement.setAttribute("data-theme-mode", themeMode);
  console.log(`theme set : ${themeMode}`);
})();

(async () => {
  const asyncImports = [
    import("./api.js"),
    import("./component.js"),
    import("./lib.js")
  ];

  await Promise.all(asyncImports);

  const domLoadedHandler = () => {
    console.log("dom load handler");
    window.siteApi.restoreTheme();
    window.siteApi.domLoadedBinds();
  };
  // trigger for dom loaded event
  if (document.readyState === "loading") {
    // likely wont be here because async only run after dom loaded. but just in case
    window.addEventListener("DOMContentLoaded", domLoadedHandler);
  } else {
    domLoadedHandler(); // load straught away
  }

  // site should listen to this event rather than DOMContentLoaded, when libs have been loaded
  document.dispatchEvent(new CustomEvent("DOMAndLibsLoaded", { bubbles: true }));

  // loaded component may require programatic binds
  window.addEventListener("componentLoaded", (src) => {
    console.log(`component load: ${src}`);
    window.siteApi.bindAllToggles();
  });
})();
