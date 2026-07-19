/** @type {import('tailwindcss').Config} */
// ModForge 调色板:channel CSS 变量驱动双主题(dark 默认 :root / light .light,定义见 globals.css)。
// 颜色统一 rgb(var(--x) / <alpha-value>) —— 保证 bg-xxx/20、border-xxx/40 等透明度修饰跨主题生效。
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          titlebar: 'rgb(var(--bg-titlebar) / <alpha-value>)',
          panel: 'rgb(var(--bg-panel) / <alpha-value>)',
          panelTop: 'rgb(var(--bg-panelTop) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          cardBottom: 'rgb(var(--bg-cardBottom) / <alpha-value>)',
          input: 'rgb(var(--bg-input) / <alpha-value>)',
          select: 'rgb(var(--bg-select) / <alpha-value>)',
          selectBottom: 'rgb(var(--bg-selectBottom) / <alpha-value>)',
          deepest: 'rgb(var(--bg-deepest) / <alpha-value>)'
        },
        border: {
          frame: 'rgb(var(--border-frame) / <alpha-value>)',
          subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
          inner: 'rgb(var(--border-inner) / <alpha-value>)',
          brand: 'rgb(var(--border-brand) / <alpha-value>)',
          ok: 'rgb(var(--border-ok) / <alpha-value>)',
          info: 'rgb(var(--border-info) / <alpha-value>)',
          danger: 'rgb(var(--border-danger) / <alpha-value>)'
        },
        fg: {
          base: 'rgb(var(--fg-base) / <alpha-value>)',
          mute: 'rgb(var(--fg-mute) / <alpha-value>)',
          muteBright: 'rgb(var(--fg-muteBright) / <alpha-value>)',
          muteDim: 'rgb(var(--fg-muteDim) / <alpha-value>)',
          accentInfo: 'rgb(var(--fg-accentInfo) / <alpha-value>)'
        },
        brand: {
          base: 'rgb(var(--brand-base) / <alpha-value>)',
          bright: 'rgb(var(--brand-bright) / <alpha-value>)',
          deep: 'rgb(var(--brand-deep) / <alpha-value>)',
          glow: 'rgb(var(--brand-glow) / <alpha-value>)'
        },
        status: {
          ok: 'rgb(var(--status-ok) / <alpha-value>)',
          warn: 'rgb(var(--status-warn) / <alpha-value>)',
          danger: 'rgb(var(--status-danger) / <alpha-value>)',
          live: 'rgb(var(--status-live) / <alpha-value>)',
          highlight: 'rgb(var(--status-highlight) / <alpha-value>)',
          info: 'rgb(var(--status-info) / <alpha-value>)'
        },
        // 蒙层基色(alpha 由 bg-overlay/70 等 utility 控制;dark=黑 light=深灰)
        overlay: 'rgb(var(--overlay) / <alpha-value>)'
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
        // 实为纯色(语义保留 *-gradient 名,组件零改动);原笔误写成纯 hex 作 background-image 非法被丢弃,
        // 现改为合法的"同色 linear-gradient" → 背景真正生效,light 主题层次正确(见计划决策 5)。
        'panel-gradient': 'linear-gradient(rgb(var(--gradient-panel)), rgb(var(--gradient-panel)))',
        'card-gradient': 'linear-gradient(rgb(var(--gradient-card)), rgb(var(--gradient-card)))',
        'select-gradient': 'linear-gradient(rgb(var(--gradient-select)), rgb(var(--gradient-select)))',
        'brand-gradient': 'linear-gradient(rgb(var(--gradient-brand)), rgb(var(--gradient-brand)))'
      },
      transitionProperty: {
        soft: 'background-color, border-color, color, opacity'
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }
  },
  plugins: []
}
