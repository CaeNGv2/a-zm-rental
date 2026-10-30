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

  // loaded component may require programatic binds
  window.addEventListener("componentLoaded", (src) => {
    console.log(`component load: ${src}`);
    window.siteApi.bindAllToggles();
  });
})();
