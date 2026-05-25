/**
 * SVG → PNG (resvg-js, 透明背景) → ico/icns 派生图标。
 * electron-icon-builder 不支持 SVG 直读，需先 rasterize。
 */
const { execSync } = require('node:child_process')
const { copyFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const resources = join(root, 'resources')
const svg = join(resources, 'icon.svg')
const png = join(resources, 'icon.png')
const iconsDir = join(resources, 'icons')

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true })
}

if (!existsSync(svg)) {
  console.error('Missing resources/icon.svg')
  process.exit(1)
}

run('npx --yes @resvg/resvg-js-cli --fit-width 1024 resources/icon.svg resources/icon.png')
run('npx electron-icon-builder --input=resources/icon.png --output=resources --flatten')

const srcIco = join(iconsDir, 'icon.ico')
const srcIcns = join(iconsDir, 'icon.icns')
if (existsSync(srcIco)) copyFileSync(srcIco, join(resources, 'icon.ico'))
if (existsSync(srcIcns)) copyFileSync(srcIcns, join(resources, 'icon.icns'))

console.log('Icon pipeline done: resources/icon.{svg,png,ico,icns}')
