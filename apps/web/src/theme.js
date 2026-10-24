import { createSystem, defaultConfig } from '@chakra-ui/react'

export const system = createSystem(defaultConfig, {
  globalCss: {
    body: { bg: 'bg', color: 'fg' },
    '::selection': { background: '#dceaff' },
    ':focus-visible': { outlineColor: '#9cc4ff', outlineOffset: '3px' },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
        heading: { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' },
      },
      colors: {
        blue: {
          50: { value: '#edf4ff' },
          100: { value: '#dceaff' },
          200: { value: '#b7d3ff' },
          500: { value: '#0751b6' },
          600: { value: '#0751b6' },
          700: { value: '#003d91' },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: '#f7f8fa' },
          panel: { value: '#ffffff' },
          muted: { value: '#eef1f5' },
          subtle: { value: '#fbfcfd' },
        },
        fg: {
          DEFAULT: { value: '#19212d' },
          muted: { value: '#657181' },
          subtle: { value: '#788392' },
        },
        border: { DEFAULT: { value: '#e8ebef' } },
        blue: {
          solid: { value: '#0751b6' },
          fg: { value: '#0751b6' },
          subtle: { value: '#edf4ff' },
          contrast: { value: '#ffffff' },
          focusRing: { value: '#9cc4ff' },
        },
      },
    },
    slotRecipes: {
      card: { base: { root: { borderRadius: '13px' } } },
    },
  },
})
