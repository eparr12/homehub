import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const WEB_ROOT = join(REPO_ROOT, 'src', 'web');
const THEMES_FILE = join(WEB_ROOT, 'styles', 'themes.css');
const PUBLIC_DIR = `${join(WEB_ROOT, 'public')}${sep}`;
const IMAGE_FILE = /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i;

// #rgb, #rgba, #rrggbb or #rrggbbaa, but not a reference such as repo#1234
// or an HTML character reference such as &#8230;.
const HEX_COLOR =
  /(?<![\w&])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])/gi;
// An issue link such as TODO(#123) (DOC-5) isn't a color.
const ISSUE_LINK = /\(#\d+\)/g;
const COLOR_FUNCTION =
  /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const QUOTED_TEXT = /(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
// CSS Color 4's named colors, without the keywords transparent and
// currentcolor, which name no color of their own.
const CSS_COLOR_NAMES = `
  aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
  chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink
  deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
  fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey
  honeydew hotpink indianred indigo ivory khaki lavender lavenderblush
  lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow
  lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime
  limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
  mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff
  peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
  saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle
  tomato turquoise violet wheat white whitesmoke yellow yellowgreen
`
  .trim()
  .split(/\s+/);
const NAMED_COLOR = new RegExp(
  `(?<![\\w-])(?:${CSS_COLOR_NAMES.join('|')})(?![\\w-])`,
  'gi',
);

const THEME_BLOCK = /\[data-theme='([\w-]+)'\]\s*\{([^}]*)\}/g;
const TOKEN = /--([\w-]+)\s*:\s*([^;]*);/g;
const RRGGBB = /^#[\da-f]{6}$/i;

// WCAG AA contrast minimums (WEB-6).
const BODY_TEXT = 4.5;
const UI_PART = 3;

/**
 * The text and background pairs the shell draws: text and text-muted on
 * pages, cards and the navigation; accent for the navigation's current view
 * and the focus outlines on cards and pages; and surface on text for the
 * offline badge and the wall's buttons.
 */
const SHELL_PAIRS = [
  { text: 'text', background: 'surface', minimum: BODY_TEXT },
  { text: 'text-muted', background: 'surface', minimum: BODY_TEXT },
  { text: 'text', background: 'surface-raised', minimum: BODY_TEXT },
  { text: 'text-muted', background: 'surface-raised', minimum: BODY_TEXT },
  { text: 'accent', background: 'surface-raised', minimum: BODY_TEXT },
  { text: 'surface', background: 'text', minimum: BODY_TEXT },
  { text: 'accent', background: 'surface', minimum: UI_PART },
] as const;

// WCAG's relative luminance: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
const LUMINANCE_WEIGHTS = { red: 0.2126, green: 0.7152, blue: 0.0722 };

const THEMES = readThemes();

describe('themes.css', () => {
  it('holds every color in src/web and vite.config.ts (WEB-5)', () => {
    const files = [join(REPO_ROOT, 'vite.config.ts'), ...listWebFiles()];

    expect(files.flatMap(findColors)).toEqual([]);
  });

  describe.each([...THEMES.keys()])('the %s theme', (theme) => {
    it.each(SHELL_PAIRS)(
      'gives $text on $background at least $minimum:1 (WEB-6)',
      ({ text, background, minimum }) => {
        const ratio = contrastRatio(
          token(theme, text),
          token(theme, background),
        );

        expect(ratio).toBeGreaterThanOrEqual(minimum);
      },
    );
  });
});

/** Every file under src/web but themes.css itself and the images in public/. */
function listWebFiles(): string[] {
  return readdirSync(WEB_ROOT, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (file) =>
        file !== THEMES_FILE &&
        !(file.startsWith(PUBLIC_DIR) && IMAGE_FILE.test(file)),
    );
}

/**
 * Each color the file names, as "path:line: color". A named color counts
 * where code would use one: in CSS outside comments, and elsewhere inside a
 * string. A color word in a comment's prose doesn't.
 */
function findColors(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const isCss = file.endsWith('.css');
  const code = isCss
    ? text.replaceAll(CSS_COMMENT, (comment) => comment.replaceAll(/./g, ' '))
    : text;
  const codeLines = code.split('\n');
  const path = relative(REPO_ROOT, file).replaceAll(sep, '/');
  return text.split('\n').flatMap((line, index) => {
    const codeLine = codeLines[index] ?? '';
    const namedColorPlaces = isCss
      ? [codeLine]
      : (codeLine.match(QUOTED_TEXT) ?? []);
    const colors = [
      ...(line.replaceAll(ISSUE_LINK, '').match(HEX_COLOR) ?? []),
      ...(line.match(COLOR_FUNCTION) ?? []),
      ...namedColorPlaces.flatMap((place) => place.match(NAMED_COLOR) ?? []),
    ];
    return colors.map((color) => `${path}:${String(index + 1)}: ${color}`);
  });
}

/** Each [data-theme] block's tokens, which must all be #rrggbb. */
function readThemes(): Map<string, Map<string, string>> {
  const themes = new Map<string, Map<string, string>>();
  const css = readFileSync(THEMES_FILE, 'utf8');
  for (const [, theme = '', body = ''] of css.matchAll(THEME_BLOCK)) {
    const tokens = new Map<string, string>();
    for (const [, name = '', value = ''] of body.matchAll(TOKEN)) {
      if (!RRGGBB.test(value.trim())) {
        throw new Error(`--${name} in the ${theme} theme isn't #rrggbb`);
      }
      tokens.set(name, value.trim());
    }
    themes.set(theme, tokens);
  }
  if (themes.size === 0) throw new Error('themes.css has no [data-theme]');
  return themes;
}

function token(theme: string, name: string): string {
  const value = THEMES.get(theme)?.get(name);
  if (value === undefined) {
    throw new Error(`The ${theme} theme has no --${name}`);
  }
  return value;
}

function contrastRatio(first: string, second: string): number {
  const [a, b] = [relativeLuminance(first), relativeLuminance(second)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function relativeLuminance(rrggbb: string): number {
  return (
    LUMINANCE_WEIGHTS.red * linearChannel(rrggbb, 1) +
    LUMINANCE_WEIGHTS.green * linearChannel(rrggbb, 3) +
    LUMINANCE_WEIGHTS.blue * linearChannel(rrggbb, 5)
  );
}

/** One sRGB channel, from its two hex digits at `start`, made linear. */
function linearChannel(rrggbb: string, start: number): number {
  const value = Number.parseInt(rrggbb.slice(start, start + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
