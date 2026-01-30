#!/usr/bin/env node
/**
 * Enforces that all colors come from src/constants/colors.ts (and index.css for variable definitions).
 * - Every color in THEME_COLORS must have both .light and .dark.
 * - THEME_COLORS values must match index.css (:root = dark, @media light = light).
 * - No hex (#xxx, #xxxxxx) or rgba/rgb() may appear in .ts/.tsx except in constants/colors.ts.
 * - No hex or rgba may appear in .css except in index.css (where theme variables are defined).
 *
 * Run from budget-app directory: node scripts/check-colors.cjs
 */

const fs = require('fs')
const path = require('path')

const SRC_DIR = path.join(__dirname, '..', 'src')
const COLORS_TS = path.join(SRC_DIR, 'constants', 'colors.ts')
const INDEX_CSS = path.join(SRC_DIR, 'index.css')

// Match hex colors: #rgb #rgba #rrggbb #rrggbbaa (with optional space/comma)
const HEX_RE = /#[\da-fA-F]{3,8}\b/g
// Match rgb/rgba(...) but not var(-- or url( or 0px
const RGB_RGBA_RE = /rgba?\s*\([^)]+\)/g

/** Normalize a color value for comparison (trim, collapse spaces) */
function normalizeValue(val) {
  if (typeof val !== 'string') return ''
  return val.trim().replace(/\s+/g, ' ')
}

function getAllFiles(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      getAllFiles(full, ext, fileList)
    } else if (e.isFile() && e.name.endsWith(ext)) {
      fileList.push(full)
    }
  }
  return fileList
}

function checkThemeColorsHasLightDark() {
  const content = fs.readFileSync(COLORS_TS, 'utf8')
  const start = content.indexOf('export const THEME_COLORS')
  const end = content.indexOf('export const COLOR_VARS', start)
  if (start === -1 || end === -1) {
    console.error('❌ Could not find THEME_COLORS or COLOR_VARS in constants/colors.ts')
    return false
  }
  const block = content.slice(start, end)
  const keyMatches = [...block.matchAll(/\n\s+(\w+):\s*\{/g)]
  const missing = []
  for (const m of keyMatches) {
    const key = m[1]
    const keyStart = m.index + m[0].length
    let depth = 1
    let pos = keyStart
    while (pos < block.length && depth > 0) {
      const c = block[pos]
      if (c === '{') depth++
      else if (c === '}') depth--
      pos++
    }
    const entryBlock = block.slice(keyStart, pos - 1)
    const hasLight = /light:\s*['"]/.test(entryBlock)
    const hasDark = /dark:\s*['"]/.test(entryBlock)
    if (!hasLight || !hasDark) {
      missing.push(key + (hasLight ? '' : ' (missing light)') + (hasDark ? '' : ' (missing dark)'))
    }
  }
  if (missing.length > 0) {
    console.error('❌ constants/colors.ts: Every THEME_COLORS entry must have light and dark:')
    missing.forEach((x) => console.error('   -', x))
    return false
  }
  return true
}

/** Parse THEME_COLORS key -> { light, dark } string values from colors.ts */
function parseThemeColorsValues() {
  const content = fs.readFileSync(COLORS_TS, 'utf8')
  const start = content.indexOf('export const THEME_COLORS')
  const end = content.indexOf('export const COLOR_VARS', start)
  if (start === -1 || end === -1) return null
  const block = content.slice(start, end)
  const result = {}
  const keyMatches = [...block.matchAll(/\n\s+(\w+):\s*\{/g)]
  for (const m of keyMatches) {
    const key = m[1]
    const keyStart = m.index + m[0].length
    let depth = 1
    let pos = keyStart
    while (pos < block.length && depth > 0) {
      const c = block[pos]
      if (c === '{') depth++
      else if (c === '}') depth--
      pos++
    }
    const entryBlock = block.slice(keyStart, pos - 1)
    const lightM = entryBlock.match(/light:\s*['"]([^'"]*)['"]/)
    const darkM = entryBlock.match(/dark:\s*['"]([^'"]*)['"]/)
    if (lightM && darkM) result[key] = { light: lightM[1], dark: darkM[1] }
  }
  return result
}

/** Parse COLOR_VARS key -> '--var-name' from colors.ts */
function parseColorVarsFromTs() {
  const content = fs.readFileSync(COLORS_TS, 'utf8')
  const start = content.indexOf('export const COLOR_VARS')
  if (start === -1) return null
  const block = content.slice(start, start + 4000)
  const result = {}
  const matches = block.matchAll(/(\w+):\s*['"](--[^'"]+)['"]/g)
  for (const m of matches) result[m[1]] = m[2]
  return result
}

/** Extract CSS custom property definitions from a block string (e.g. ":root { ... }" content). */
function parseCssVarsFromBlock(blockContent) {
  const vars = {}
  const re = /--([a-zA-Z0-9-]+):\s*([^;]+);/g
  let m
  while ((m = re.exec(blockContent)) !== null) {
    vars['--' + m[1]] = m[2].trim()
  }
  return vars
}

/** Find the first {...} block after a given pattern (e.g. ':root {'). Returns inner content. */
function findBlockAfter(content, pattern) {
  const idx = content.indexOf(pattern)
  if (idx === -1) return null
  const start = idx + pattern.length
  let depth = 1
  let pos = start
  while (pos < content.length && depth > 0) {
    const c = content[pos]
    if (c === '{') depth++
    else if (c === '}') depth--
    pos++
  }
  return content.slice(start, pos - 1)
}

/** Verify THEME_COLORS and index.css theme variables are in sync. */
function checkThemeSync() {
  const themeColors = parseThemeColorsValues()
  const colorVars = parseColorVarsFromTs()
  if (!themeColors || !colorVars) return { ok: true }

  const cssContent = fs.readFileSync(INDEX_CSS, 'utf8')
  const darkBlock = findBlockAfter(cssContent, ':root {')
  const mediaLightStart = cssContent.indexOf('@media (prefers-color-scheme: light)')
  const lightBlock = mediaLightStart === -1 ? null : findBlockAfter(cssContent.slice(mediaLightStart), ':root {')

  if (!darkBlock || !lightBlock) return { ok: true }

  const darkVars = parseCssVarsFromBlock(darkBlock)
  const lightVars = parseCssVarsFromBlock(lightBlock)

  const mismatches = []
  for (const key of Object.keys(themeColors)) {
    const cssVar = colorVars[key]
    if (!cssVar) continue
    const expectedDark = normalizeValue(themeColors[key].dark)
    const expectedLight = normalizeValue(themeColors[key].light)
    const actualDark = normalizeValue(darkVars[cssVar])
    const actualLight = normalizeValue(lightVars[cssVar])

    if (actualDark !== undefined && actualDark !== expectedDark) {
      mismatches.push({ key, mode: 'dark', expected: expectedDark, actual: actualDark })
    }
    if (actualLight !== undefined && actualLight !== expectedLight) {
      mismatches.push({ key, mode: 'light', expected: expectedLight, actual: actualLight })
    }
  }

  return { ok: mismatches.length === 0, mismatches }
}

function findColorViolations(filePath, content) {
  const violations = []
  const lines = content.split('\n')
  const hexMatches = [...content.matchAll(HEX_RE)]
  const rgbaMatches = [...content.matchAll(RGB_RGBA_RE)]
  const lineNum = (idx) => {
    let count = 0
    let pos = 0
    for (let i = 0; i < lines.length; i++) {
      pos += lines[i].length + 1
      if (pos > idx) return i + 1
    }
    return lines.length
  }
  for (const m of hexMatches) {
    // Allow in comments
    const line = lines[lineNum(m.index) - 1]
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
    violations.push({ line: lineNum(m.index), match: m[0], file: filePath })
  }
  for (const m of rgbaMatches) {
    const line = lines[lineNum(m.index) - 1]
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue
    violations.push({ line: lineNum(m.index), match: m[0].slice(0, 30), file: filePath })
  }
  return violations
}

function main() {
  let exitCode = 0

  console.log('🔍 Checking theme color constants and usage...')
  console.log('')

  if (!checkThemeColorsHasLightDark()) {
    exitCode = 1
  } else {
    console.log('✅ THEME_COLORS: every entry has light and dark')
  }

  const sync = checkThemeSync()
  if (!sync.ok) {
    console.log('❌ constants/colors.ts and index.css are out of sync:')
    sync.mismatches.forEach(({ key, mode, expected, actual }) => {
      console.log(`   ${key} (${mode}): THEME_COLORS has "${expected}", index.css has "${actual}"`)
    })
    console.log('   Update index.css to match THEME_COLORS (or vice versa).')
    console.log('')
    exitCode = 1
  } else {
    console.log('✅ constants/colors.ts and index.css theme values are in sync')
  }

  const tsFiles = getAllFiles(SRC_DIR, '.ts').concat(getAllFiles(SRC_DIR, '.tsx'))
  const allowedTs = path.normalize(COLORS_TS)
  const violationsTs = []
  for (const f of tsFiles) {
    const norm = path.normalize(f)
    if (norm === allowedTs) continue
    const content = fs.readFileSync(f, 'utf8')
    const v = findColorViolations(f, content)
    violationsTs.push(...v)
  }

  const cssFiles = getAllFiles(SRC_DIR, '.css')
  const allowedCss = path.normalize(INDEX_CSS)
  const violationsCss = []
  for (const f of cssFiles) {
    const norm = path.normalize(f)
    if (norm === allowedCss) continue
    const content = fs.readFileSync(f, 'utf8')
    const v = findColorViolations(f, content)
    violationsCss.push(...v)
  }

  if (violationsTs.length > 0) {
    console.log('❌ Raw colors (hex/rgba) found outside constants/colors.ts:')
    violationsTs.forEach(({ file, line, match }) => {
      const rel = path.relative(path.join(__dirname, '..'), file)
      console.log(`   ${rel}:${line}  ${match}`)
    })
    console.log('   Use CSS variables from constants/colors.ts (e.g. var(--page-background)) or import COLOR_VARS.')
    console.log('')
    exitCode = 1
  } else {
    console.log('✅ No raw colors in .ts/.tsx outside constants/colors.ts')
  }

  if (violationsCss.length > 0) {
    console.log('❌ Raw colors (hex/rgba) found in CSS files other than index.css:')
    violationsCss.forEach(({ file, line, match }) => {
      const rel = path.relative(path.join(__dirname, '..'), file)
      console.log(`   ${rel}:${line}  ${match}`)
    })
    console.log('   Only index.css may define theme variable values (hex/rgba).')
    console.log('')
    exitCode = 1
  } else if (cssFiles.length > 1) {
    console.log('✅ No raw colors in .css outside index.css')
  }

  if (exitCode === 0) {
    console.log('')
    console.log('✅ All color checks passed!')
  } else {
    console.log('❌ Color checks failed. See above.')
  }

  process.exit(exitCode)
}

main()
