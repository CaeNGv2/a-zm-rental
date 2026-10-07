
/**
 * @type {HtmlComponent|null}
 */
let currentComponent = null;
/**
 * Vue style component loaded hook
 * @param {Function} fn called after component is loaded
 */
window.onMounted = (fn) => {
  if (currentComponent) {
    currentComponent.addEventListener("loaded", () => fn.call(currentComponent, currentComponent), { once: true });
  } else {
    console.warn("onMounted() must be called during component init");
  }
};

// A global execution stack to keep track of the current HTML base path context
const componentStack = new (class ComponentStack {
  #baseContextStack = [window.location.href];
  
  /**
   * update the stack context for any nested children before injection
   * @param {string} rawSrc 
   */
  push(rawSrc) {
    const currentBaseContext = this.#baseContextStack.at(-1);

    const resolvedUrl = new URL(rawSrc, currentBaseContext);
    const targetUrl = resolvedUrl.href;

    // We get the directory containing the HTML file we are about to fetch
    const nestedBaseContext = new URL(".", targetUrl).href;
    this.#baseContextStack.push(nestedBaseContext);

    console.log(rawSrc, this.#baseContextStack); // tmp dbg

    return { contextDir: nestedBaseContext, resolvedSrc: targetUrl };
  }
  pop() {
    console.log("pop: ", this.peek()); // tmp dbg
    return this.#baseContextStack.pop();
  }
  peek() {
    return this.#baseContextStack.at(-1);
  }
})();

class HtmlComponent extends HTMLElement {
  async connectedCallback() {
    const src = this.getSrcAttr();

    // track level
    const { resolvedSrc, contextDir } = componentStack.push(src);

    await this.injectComponentBody(resolvedSrc);
    await this.injectScripts(contextDir);

    // wait for the next paint cycle to complete (innerhtml to effect)
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)));

    // untrack after inject
    componentStack.pop();

    // trigger a finish load event so other logic can work on the injected component
    this.dispatchEvent(new CustomEvent("loaded", {
      detail: { src }
    }));
  }

  getSrcAttr() {
    const src = this.getAttribute("src");
    if (!src) throw new Error("html-component must define src.");
    return src;
  }

  /**
   * 
   * @param {string} src 
   */
  async injectComponentBody(src) {
    console.log("fetch " + src); // dbg
    const response = await fetch(src);
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
  // only register the block if <script type="module"></script> (and IDE recognise "module" for js support)
  /**
   * 
   * @param {string} contextDir the base path/url to resolve script src against
   */
  async injectScripts(contextDir) {
    const componentScripts = Array.from(this.querySelectorAll('script[type="module"]'));

    for (const existingScript of componentScripts) {
      const srcAttr = existingScript.getAttribute("src");
      currentComponent = this;

      if (srcAttr) {
        try {
          const scriptUrl = new URL(srcAttr, contextDir).href;
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
          const handler = new Function(existingScript.textContent);
          handler.call(window);
        } catch (err) {
          console.error("Error executing inline component script:", err);
        } finally {
          currentComponent = null;
        }
      }

      // it's a dummy block, just label it to mark that is executed
      existingScript.setAttribute("type", "vm/module");
      existingScript.setAttribute("component", this.getSrcAttr());
      existingScript.toggleAttribute("loaded", true);
    }
  }
}

customElements.define("html-component", HtmlComponent);
