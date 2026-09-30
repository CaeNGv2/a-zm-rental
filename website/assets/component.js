let currentComponent = null;
/**
 * Vue style component loaded hook
 * @param {Function} fn called after component is loaded
 */
globalThis.onMounted = (fn) => {
  if (currentComponent) {
    currentComponent.addEventListener("loaded", () => fn.call(currentComponent, currentComponent), { once: true });
  } else {
    console.warn("onMounted() must be called during component init");
  }
};

class HtmlComponent extends HTMLElement {
  async connectedCallback() {
    await this.injectComponentBody();
    await this.injectScripts();

    // trigger a finish load event so other logic can work on the injected component
    this.dispatchEvent(new CustomEvent("loaded", {
      detail: { src: this.getAttribute("src") }
    }));
  }

  async injectComponentBody() {
    const response = await fetch(this.getAttribute("src"));
    let html = await response.text();

    for (const attr of this.attributes) {
      if (attr.name === "src") continue;

      html = html.replaceAll(
        `{{${attr.name}}}`,
        attr.value
      );
    }

    this.innerHTML = html;
  }

  // because the component is lazily injected by innerHTML, browsers dont execute scripts within.
  // we need to extract the intended scripts, then execute.
  // only register the block if <script type="module"></script> because type="module"
  // wont be executed by browser (and IDE recognise "module" for js support)
  async injectScripts() {
    const componentScripts = Array.from(this.querySelectorAll('script[type="module"]'));

    for (const existingScript of componentScripts) {
      const srcAttr = existingScript.getAttribute("src");
      currentComponent = this;

      if (srcAttr) {
        try {
          const scriptUrl = new URL(srcAttr, window.location.href).href;
          const mod = await import(scriptUrl);

          // if (typeof mod.onMounted === "function") {
          //   this.addEventListener("loaded", () => mod.onMounted.call(this, this), { once: true });
          // }
        } catch (e) {
          console.error("Error loading component module:", srcAttr, e);
        } finally {
          currentComponent = null;
        }
      } else {
        try {
          // execute the existingScript.textContent
          const handler = new Function("component", existingScript.textContent);
          handler(globalThis);
        } catch (err) {
          console.error("Error executing inline component script:", err);
        } finally {
          currentComponent = null;
        }
      }

      // it's a dummy block, just label it to mark that is executed
      existingScript.setAttribute("component", this.getAttribute("src"));
      existingScript.setAttribute("loaded", true);
    }
  }
}

customElements.define("html-component", HtmlComponent);