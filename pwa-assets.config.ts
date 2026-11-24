import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// `npm run icons` makes the PWA icons from icon.svg into src/web/public, and
// they're committed, so no build needs the generator.
export default defineConfig({
  images: ['src/web/public/icon.svg'],
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The preset shrinks the artwork in these two and frames it in white.
    // icon.svg already fills its square and keeps the house inside the
    // maskable safe zone, so they use it as it is.
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
});
