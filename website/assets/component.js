
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

class HtmlComponent extends HTMLElement {
  async connectedCallback() {
    const src = this.getSrcAttr();

    const parentContext = (() => {
      let contextSrc = window.location.href;
      /** @type {HtmlComponent|null|undefined} */
      const parent = this.parentElement?.closest(HtmlComponent.htmlTagName);
      if (parent) {
        const parentContext = parent.getAttribute("context");
        if (parentContext) {
          contextSrc = (new URL(parentContext, window.location.href)).href;
        } else {
          console.error("missing src on parent html-component");
        }
      }
      return (new URL(".", contextSrc)).href; 
    })();

    const resolvedSrc = (new URL(src, parentContext)).href;

    console.log(`resolved context for html-component ${src}: ${parentContext}`); // dbg

    const newContextUrl = new URL(".", resolvedSrc);

    this.setAttribute("context", newContextUrl.pathname);
    await this.injectComponentBody(resolvedSrc);
    await this.injectScripts(newContextUrl.href);

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

      // prop-attr-liek-this
      const kebabName = attr.name.toLowerCase();
      // propAttrLiekThis
      const camelName = kebabName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

      html = html
        .replaceAll(
          `{{${kebabName}}}`,
          attr.value
        )
        .replaceAll(
          `{{${camelName}}}`,
          attr.value
        );
        //console.log("camel name : ", camelName); // dbg
    }

    // save existing custom child nodes to append back later
    const customChildren = Array.from(this.childNodes);

    // the main injection
    this.innerHTML = html;

    // restore custom child nodes
    const slotElement = this.querySelector('slot');
    if (slotElement) {
      // rplc placeholder <slot>
      slotElement.replaceWith(...customChildren);
      console.log(`component - injected children to slot`); // dbg
    } else if (customChildren.length > 0) {
      // fallback: no slot found - append to end
      this.append(...customChildren);
      
      console.log(`component - appended children to end`); // dbg
    }
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

  static get htmlTagName() {
    return "html-component";
  }
}

customElements.define(HtmlComponent.htmlTagName, HtmlComponent);
