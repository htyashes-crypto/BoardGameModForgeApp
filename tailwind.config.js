/** @type {import('tailwindcss').Config} */
// ModForge 调色板:黑底 + 橙金品牌色,参考 .claude/svg/modforge-*.svg 设计稿
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a0a',
          titlebar: '#0d0d0d',
          panel: '#1a1a1a',
          panelTop: '#2a2a2a',
          card: '#262626',
          cardBottom: '#181818',
          input: '#101010',
          select: '#3a2a14',
          selectBottom: '#1f1608'
        },
        border: {
          frame: '#3a3a3a',
          subtle: '#2a2a2a',
          inner: '#4a4a4a',
          brand: '#f5a623',
          ok: '#6bcb77',
          info: '#9cdcfe',
          danger: '#c14545'
        },
        fg: {
          base: '#e8e8e8',
          mute: '#aaa',
          muteBright: '#888',
          muteDim: '#555',
          accentInfo: '#9cdcfe'
        },
        brand: {
          base: '#f5a623',
          bright: '#ffb84d',
          deep: '#c88010',
          glow: '#ffc15c'
        },
        status: {
          ok: '#6bcb77',
          warn: '#ffb700',
          danger: '#ff6b6b',
          live: '#4ec9b0',
          highlight: '#ffd700',
          info: '#9cdcfe'
        }
      },
      fontFamily: {
        ui: ['"PingFang SC"', '"Microsoft YaHei"', '"Segoe UI"', 'sans-serif'],
        mono: ['Consolas', '"JetBrains Mono"', '"SF Mono"', 'monospace']
      },
      fontSize: {
        '2xs': '11px',
        '3xs': '10px'
      },
      backgroundImage: {
        'panel-gradient': 'linear-gradient(to bottom, #2a2a2a 0%, #1a1a1a 100%)',
        'card-gradient': 'linear-gradient(to bottom, #262626 0%, #181818 100%)',
        'select-gradient': 'linear-gradient(to bottom, #3a2a14 0%, #1f1608 100%)',
        'brand-gradient': 'linear-gradient(to bottom, #ffc15c 0%, #f5a623 50%, #c88010 100%)'
      }
    }
  },
  plugins: []
}
