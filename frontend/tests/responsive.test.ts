/**
 * Responsive-layout guard.
 *
 * The site is not responsive when a construct can exceed a narrow viewport: a multi-column grid
 * with no small-screen rule, a fixed pixel width, or `white-space: nowrap` on something that can
 * hold a long string. These break silently — the build passes, typecheck passes, and every route
 * returns 200 — so they need an assertion.
 *
 * This is a static analysis of the stylesheets, not a rendered-pixel check. That is a deliberate
 * trade: it runs in CI with no browser, and it cannot catch everything (an unbreakable long word
 * in real content, for example). It does catch the classes of mistake that actually shipped here
 * — an undefined class used by a component, and a wide grid with no reflow rule.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP = dirname(fileURLToPath(import.meta.url));
const SRC = join(APP, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const cssFiles = walk(SRC).filter((f) => f.endsWith(".css"));
const tsxFiles = walk(SRC).filter((f) => f.endsWith(".tsx"));
const css = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");
/** globals.css owns the breakpoint tiers, so tier assertions must not slice across files. */
const globals = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const allTsx = tsxFiles.map((f) => readFileSync(f, "utf8")).join("\n");

/** Breakpoint tiers declared in globals.css, descending. */
const TIERS = [980, 700, 520, 360] as const;

describe("responsive foundation", () => {
  it("declares a viewport", () => {
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/export const viewport/);
    expect(layout).toMatch(/width:\s*"device-width"/);
  });

  it("has a mobile backstop so the page itself never scrolls sideways", () => {
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });

  it("declares every breakpoint tier it relies on", () => {
    for (const tier of TIERS) {
      expect(css, `missing @media (max-width: ${tier}px)`).toContain(
        `max-width: ${tier}px`,
      );
    }
  });
});

describe("nothing structurally wide is left unguarded", () => {
  it("the 5-column register reflows on small screens", () => {
    const narrow = globals.slice(globals.indexOf("max-width: 520px"));
    // Placement is explicit rather than grid-template-areas, because the title and its sub-line
    // share one wrapper div and an area would name a cell no child occupies.
    expect(narrow).toMatch(/\.register-row[\s\S]*grid-template-columns:\s*1fr/);
    expect(narrow).toMatch(/grid-row:\s*auto/);
  });

  it("the condensed register tier places every child explicitly", () => {
    const tier = globals.slice(
      globals.indexOf("max-width: 980px"),
      globals.indexOf("max-width: 700px"),
    );
    expect(tier).toMatch(/grid-row:\s*1 \/ span 3/);
    expect(tier).toMatch(/min-width:\s*0/);
  });

  it("the standards comparison table reflows (it is 4 columns of prose)", () => {
    const narrow = globals.slice(globals.indexOf("max-width: 520px"));
    expect(narrow).toMatch(/\.compare[\s\S]*display:\s*block/);
    // With the header hidden, each cell must regain its column label.
    expect(narrow).toMatch(/\.compare td::before/);
  });

  it("key/value rows stack instead of clipping long addresses and amounts", () => {
    const mid = globals.slice(
      globals.indexOf("max-width: 700px"),
      globals.indexOf("max-width: 520px"),
    );
    expect(mid).toMatch(/\.kv\s*\{[\s\S]*?flex-direction:\s*column/);
    expect(mid).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("no fixed width exceeds the narrowest supported viewport", () => {
    // 360px is the smallest tier we support; a hard width above that guarantees a scrollbar.
    const offenders = [...css.matchAll(/^\s*[\w-]+\s*\{[^}]*?\bwidth:\s*(\d{3,}px)/gm)]
      .map((m) => Number(m[1]))
      .filter((w) => w > 360);
    expect(offenders, `fixed widths wider than 360px: ${offenders.join(", ")}`).toEqual([]);
  });

  it("nowrap is not applied to elements that can hold long prose", () => {
    // .row-sub carries the acceptance criteria, so it must be allowed to wrap on small screens.
    const narrow = css.slice(css.indexOf("max-width: 980px"));
    expect(narrow).toMatch(/\.register-row \.row-sub[\s\S]*?white-space:\s*normal/);
  });
});

describe("touch targets meet the accessibility floor", () => {
  it("interactive controls are at least 44px tall on phones", () => {
    const narrow = globals.slice(globals.indexOf("max-width: 520px"));
    expect(narrow).toMatch(/min-height:\s*44px/);
  });
});

describe("components only reference classes that exist", () => {
  /**
   * `.form-grid` shipped in the create-docket form with no matching rule anywhere, so its
   * three side-by-side fields rendered as full-width blocks on desktop as well as mobile.
   * This catches that whole class of mistake: a class named in markup but never styled.
   */
  it("every className referenced in a component is defined in CSS", () => {
    // local styling hooks: state/motion helpers and structural names defined in CSS modules
    const ignore = new Set(["as-button", "shown", "active", "done", "failed", "reject", "pending"]);
    const referenced = new Set<string>();
    // Only literal values: className="a b" or className={`a b`} with no interpolation.
    // Template literals containing ${...} are computed at runtime and cannot be checked here.
    const patterns = [/className="([^"]*)"/g, /className=\{`([^`$]*)`\}/g];
    for (const re of patterns) {
      for (const m of allTsx.matchAll(re)) {
        for (const cls of m[1].split(/\s+/)) {
          if (cls && !cls.includes("$") && !ignore.has(cls)) referenced.add(cls);
        }
      }
    }
    const undefinedClasses = [...referenced].filter(
      (cls) => !new RegExp(`\\.${cls.replace(/[-]/g, "\\-")}(?![\\w-])`).test(css),
    );
    expect(undefinedClasses, `classes used but never styled: ${undefinedClasses.join(", ")}`)
      .toEqual([]);
  });
});
