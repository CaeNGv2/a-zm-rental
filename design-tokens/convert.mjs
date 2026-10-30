import fs from "fs";
import path from "path";

// ==========================================================================
// CONFIGURATION BLOCK
// ==========================================================================
const CONFIG = {
  inputFile: "./tokens.json",
  outputFile: "./gen-theme.css",

  // If a W3C $type matches a key here, the value is used as a prefix (e.g., --color-primary)
  prefix: {
    color: "color",
  },

  // Map functional theme selectors to tokens json set key name
  sets: {
    default: "Colors/Default",
    dark: "Colors/Dark",
  },
};

// ==========================================================================
// PARSING & GENERATION ENGINE
// ==========================================================================

/**
 * Resolves W3C token references like "{text-dark}" into CSS "var(--color-text-dark)"
 * It looks up the referenced token in the data block to prepend the correct type prefix if needed.
 */
function resolveReferences(value, tokenSet) {
  if (typeof value !== "string") return value;

  // Match curly braces
  return value.replace(/\{([^}]+)\}/g, (match, refKey) => {
    const referencedToken = tokenSet[refKey];
    let prefixStr = "";

    // Check if the referenced token has a type that needs a prefix mapping
    if (referencedToken && referencedToken.$type && CONFIG.prefix[referencedToken.$type]) {
      prefixStr = `${CONFIG.prefix[referencedToken.$type]}-`;
    }

    return `var(--${prefixStr}${refKey})`;
  });
}

/**
 * Converts a specific Penpot token set into clean CSS variable strings
 */
function generateCssVariables(tokenSet, refGlobalTokenSet) {
  const variables = [];

  for (const [key, tokenData] of Object.entries(tokenSet)) {
    // Skip Penpot structural metadata
    if (key.startsWith("$")) continue;

    if (tokenData && tokenData.$value !== undefined) {
      // Determine if a custom prefix should be applied based on the token's $type
      let prefixStr = "";
      if (tokenData.$type && CONFIG.prefix[tokenData.$type]) {
        prefixStr = `${CONFIG.prefix[tokenData.$type]}-`;
      }

      // Resolve aliases using the local and global token set to match prefixes correctly
      const cleanValue = resolveReferences(tokenData.$value, {...refGlobalTokenSet, ...tokenSet});

      // Preserve comments if descriptions exist
      const comment = tokenData.$description ? ` /* ${tokenData.$description} */` : "";

      variables.push(`  --${prefixStr}${key}: ${cleanValue};${comment}`);
    }
  }

  return variables;
}

function build() {
  try {
    const outputDir = path.dirname(CONFIG.outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load and parse the source tokens.json
    const rawData = JSON.parse(fs.readFileSync(CONFIG.inputFile, "utf8"));

    // Resolve token lists via configuration definitions
    const defaultKey = CONFIG.sets.default;
    const darkKey = CONFIG.sets.dark;

    const globalTokens = rawData[defaultKey] || {};
    //const darkTokens = { ...lightTokens, ...(rawData[darkKey] || {}) }; // apply default override
    const darkTokens = rawData[darkKey] || {};

    const defaultLightVars = generateCssVariables(globalTokens);
    const darkVars = generateCssVariables(darkTokens, globalTokens); // Only output unique dark token entries

    const cssContent = [
      `/* ==========================================================================`,
      `   GENERATED DESIGN TOKENS (DO NOT EDIT DIRECTLY VIA CODE)`,
      `   ========================================================================== */`,
      ``,
      `:root, [data-theme="light"] {`,
      ...defaultLightVars,
      `}`,
      ``,
      `[data-theme="dark"] {`,
      ...darkVars,
      `}`,
    ].join("\n");

    //output
    fs.writeFileSync(CONFIG.outputFile, cssContent, "utf8");
    console.log(
      `\x1b[32m✓ Configured CSS variables built successfully at: ${CONFIG.outputFile}\x1b[0m`
    );
  } catch (error) {
    console.error("\x1b[31m✗ Token compilation failure:\x1b[0m", error.stack);
    process.exit(1);
  }
}

build();
