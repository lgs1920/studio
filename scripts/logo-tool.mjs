#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { JSDOM } from 'jsdom'

const ROOT = process.cwd()
const DEFAULT_LOGO_DIR = path.join(ROOT, 'public', 'assets', 'logo')
const DEFAULT_LOGO_FILES = ['logo.svg', 'logo-horizontal.svg', 'logo-vertical.svg']
const PNG_PADDING = 40

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8')
const writeFile = (filePath, content) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, content)
}
const writeBinaryFile = (filePath, content) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, content)
}

const usage = () => {
    console.log(`Usage:
  bun scripts/logo-tool.mjs export [input] [output]
  bun scripts/logo-tool.mjs import [input] [output]
  bun scripts/logo-tool.mjs png [input] [output]

Defaults:
  export: ${path.join(DEFAULT_LOGO_DIR, 'logo.svg')} -> ${path.join(DEFAULT_LOGO_DIR, 'logo-editable.svg')}
  import: ${path.join(DEFAULT_LOGO_DIR, 'logo-editable.svg')} -> ${path.join(DEFAULT_LOGO_DIR, 'logo.svg')}
  png: all canonical SVG logos -> matching PNG files
`)
}

const normalizeSvgMarkup = (svgText) => svgText
    .replace(/<\?xml-stylesheet[^>]*>\s*/i, '')
    .replace(/<\?xml[^>]*>\s*/i, '')
    .replace(/xmlns:ns0="http:\/\/www\.w3\.org\/2000\/svg"/i, 'xmlns="http://www.w3.org/2000/svg"')
    .replace(/\sxmlns:ns1="http:\/\/www\.w3\.org\/1999\/xlink"/i, '')
    .replace(/<\/?ns0:/g, match => match === '</ns0:' ? '</' : '<')
    .replace(/\sns1:href="[^"]*"/g, '')

const svgNamespace = 'http://www.w3.org/2000/svg'

const cloneRequiredElement = (document, selector, description) => {
    const element = document.querySelector(selector)

    if (!element) {
        throw new Error(`Missing ${description} in source SVG`)
    }

    return element.cloneNode(true)
}

const createSvgElement = (document, name) => document.createElementNS(svgNamespace, name)

const buildEditableSvg = (svgText) => {
    const dom = new JSDOM(svgText, {contentType: 'image/svg+xml'})
    const {document} = dom.window
    const sourceRoot = document.documentElement
    const serializeNode = (node) => new dom.window.XMLSerializer().serializeToString(node)

    const title = sourceRoot.querySelector('title')?.textContent ?? 'LGS1920 logo'
    const desc = sourceRoot.querySelector('desc')?.textContent ?? ''

    const titleNode = createSvgElement(document, 'title')
    titleNode.textContent = title
    const descNode = createSvgElement(document, 'desc')
    descNode.textContent = desc

    const logoMark = createSvgElement(document, 'g')
    logoMark.setAttribute('id', 'logo-mark')
    logoMark.setAttribute('class', 'lgs--logo-mark')
    logoMark.setAttribute(
        'transform',
        cloneRequiredElement(document, '#logo-mark', 'logo-mark group').getAttribute('transform') ?? 'translate(-312.136 -350.958)',
    )

    const bodyShape = cloneRequiredElement(document, '#logo-body-shape', 'logo body shape')
    bodyShape.setAttribute('fill', '#0d426d')
    logoMark.appendChild(bodyShape)

    const secondaryGroup = createSvgElement(document, 'g')
    secondaryGroup.setAttribute('id', 'logo-secondary-shapes')
    secondaryGroup.setAttribute('class', 'lgs--logo-secondary-shapes')

    const sourceSecondaryGroup = document.querySelector('#logo-secondary-shapes')
    for (const child of [...sourceSecondaryGroup?.children ?? []]) {
        const shape = child.cloneNode(true)
        shape.setAttribute('fill', '#bfa062')
        secondaryGroup.appendChild(shape)
    }
    logoMark.appendChild(secondaryGroup)

    const arrowOutline = cloneRequiredElement(document, '#logo-play-arrow-outline', 'logo arrow outline')
    arrowOutline.setAttribute('fill', '#0d426d')
    arrowOutline.setAttribute('opacity', '0')
    logoMark.appendChild(arrowOutline)

    const arrowFill = cloneRequiredElement(document, '#logo-play-arrow-outline', 'logo arrow outline')
    arrowFill.setAttribute('id', 'logo-play-arrow-fill')
    arrowFill.setAttribute('fill', '#0d426d')
    arrowFill.setAttribute('transform', 'translate(528 651) scale(0.75) translate(-528 -651)')
    logoMark.appendChild(arrowFill)

    const arrowBorder = cloneRequiredElement(document, '#logo-play-arrow-outline', 'logo arrow outline')
    arrowBorder.setAttribute('id', 'logo-play-arrow-border')
    arrowBorder.setAttribute('fill', 'none')
    arrowBorder.setAttribute('stroke', '#bfa062')
    arrowBorder.setAttribute('stroke-width', '30')
    arrowBorder.setAttribute('stroke-linecap', 'round')
    arrowBorder.setAttribute('stroke-linejoin', 'round')
    logoMark.appendChild(arrowBorder)

    const rootAttributes = [
        ['version', sourceRoot.getAttribute('version')],
        ['role', sourceRoot.getAttribute('role')],
        ['class', sourceRoot.getAttribute('class')],
        ['viewBox', sourceRoot.getAttribute('viewBox')],
        ['width', sourceRoot.getAttribute('width')],
        ['height', sourceRoot.getAttribute('height')],
    ]
        .filter(([, value]) => Boolean(value))
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ')

    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" ${rootAttributes}>`,
        serializeNode(titleNode),
        serializeNode(descNode),
        serializeNode(logoMark),
        '</svg>',
    ].join('')
}

const exportEditable = (inputPath, outputPath) => {
    const svgText = normalizeSvgMarkup(readFile(inputPath))
    const editableText = buildEditableSvg(svgText)

    writeFile(outputPath, editableText)
}

const importEditable = (inputPath, outputPath) => {
    const svgText = normalizeSvgMarkup(readFile(inputPath))
    const sourceTemplatePath = path.join(DEFAULT_LOGO_DIR, 'logo.svg')
    const templateSvg = normalizeSvgMarkup(readFile(sourceTemplatePath))
    const editableDom = new JSDOM(svgText, {contentType: 'image/svg+xml'})
    const templateDom = new JSDOM(templateSvg, {contentType: 'image/svg+xml'})

    const getPathData = (selector, description) => {
        const element = editableDom.window.document.querySelector(selector)
        if (!element) {
            throw new Error(`Missing ${description} in editable SVG`)
        }

        const d = element.getAttribute('d')
        if (!d) {
            throw new Error(`Missing path data for ${description}`)
        }

        return d
    }

    const sourceDocument = templateDom.window.document
    sourceDocument.querySelector('#logo-body-shape')?.setAttribute('d', getPathData('#logo-body-shape', 'logo body shape'))
    sourceDocument.querySelector('#logo-play-arrow-outline')?.setAttribute('d', getPathData('#logo-play-arrow-outline', 'logo arrow outline'))

    const editableSecondary = editableDom.window.document.querySelector('#logo-secondary-shapes')
    const templateSecondary = sourceDocument.querySelector('#logo-secondary-shapes')

    if (!editableSecondary || !templateSecondary) {
        throw new Error('Missing secondary shape group in editable or template SVG')
    }

    const editablePathsById = new Map([...editableSecondary.querySelectorAll('[id]')].map((element) => [element.getAttribute('id'), element]))
    for (const templateChild of [...templateSecondary.children]) {
        const id = templateChild.getAttribute('id')
        const editableChild = id ? editablePathsById.get(id) : null

        if (editableChild?.getAttribute('d')) {
            templateChild.setAttribute('d', editableChild.getAttribute('d'))
        }
    }

    const restoredSvg = '<?xml version="1.0" encoding="utf-8"?>\n<?xml-stylesheet type="text/css" href="style.css"?>\n' + sourceDocument.documentElement.outerHTML

    writeFile(outputPath, restoredSvg)
    writeFile(path.join(path.dirname(outputPath), 'style.css'), readFile(path.join(DEFAULT_LOGO_DIR, 'style.css')).trimEnd() + '\n')
}

/**
 * Embeds the shared stylesheet so the standalone renderer can render the logo
 * without relying on an XML stylesheet processing instruction.
 *
 * @param {string} svgText - SVG markup to prepare for rasterization.
 * @param {string} inputPath - Path used to resolve the adjacent stylesheet.
 * @returns {string} SVG markup with the shared stylesheet embedded.
 */
const prepareSvgForPng = (svgText, inputPath) => {
    const normalizedSvg = normalizeSvgMarkup(svgText)
    const dom = new JSDOM(normalizedSvg, {contentType: 'image/svg+xml'})
    const {document} = dom.window
    const stylesheetPath = path.join(path.dirname(inputPath), 'style.css')
    const importedLogo = document.querySelector('image[href="logo.svg"]')
    const wordmarkPosition = document.querySelector('#wordmark-position')

    wordmarkPosition?.classList.remove('lgs--logo-gap-horizontal', 'lgs--logo-gap-vertical')

    if (importedLogo) {
        const standaloneSvg = normalizeSvgMarkup(readFile(path.join(DEFAULT_LOGO_DIR, 'logo.svg')))
        const standaloneDom = new JSDOM(standaloneSvg, {contentType: 'image/svg+xml'})
        const standaloneRoot = standaloneDom.window.document.documentElement
        const inlineLogo = createSvgElement(document, 'g')
        const x = importedLogo.getAttribute('x') ?? '0'
        const y = importedLogo.getAttribute('y') ?? '0'

        inlineLogo.setAttribute('transform', `translate(${x} ${y})`)
        for (const child of [...standaloneRoot.children]) {
            inlineLogo.appendChild(document.importNode(child, true))
        }
        importedLogo.replaceWith(inlineLogo)
    }

    if (fs.existsSync(stylesheetPath)) {
        const stylesheet = readFile(stylesheetPath)
            .replace(/@import\s+url\([^)]*\)\s*;?/gi, '')
            .replaceAll('var(--lgs--logo-primary)', '#f3bb35')
            .replaceAll('var(--lgs--logo-secondary)', '#000000')
            .replaceAll('var(--lgs--logo-text-primary)', '#f3bb35')
            .replaceAll('var(--lgs--logo-text-secondary)', '#f3bb35')
            .replaceAll('var(--lgs--logo-secondary-opacity)', '1')
            .replaceAll('var(--lgs--logo-gap-horizontal)', '100px')
            .replaceAll('var(--lgs--logo-horizontal-wordmark-offset-y)', '50px')
            .replaceAll('var(--lgs--logo-gap-vertical)', '60px')
            .replaceAll('var(--lgs--logo-play-arrow-border-width)', '30px')
            .replaceAll('var(--lgs--logo-wordmark-font-family)', 'Noto Sans, sans-serif')
            .replaceAll('var(--lgs--logo-wordmark-font-size)', '150px')
            .replaceAll('var(--lgs--logo-wordmark-main-weight)', '700')
            .replaceAll('var(--lgs--logo-wordmark-year-weight)', '700')
        const styleNode = document.createElementNS(svgNamespace, 'style')
        styleNode.textContent = stylesheet
        document.documentElement.insertBefore(styleNode, document.documentElement.firstChild)
    }

    return document.documentElement.outerHTML
        .replaceAll('var(--lgs--logo-primary, #f3bb35)', '#f3bb35')
        .replaceAll('var(--lgs--logo-secondary, #000000)', '#000000')
        .replaceAll('var(--lgs--logo-text-primary, var(--lgs--logo-primary, #0d426d))', '#f3bb35')
        .replaceAll('var(--lgs--logo-text-primary, var(--lgs--logo-primary, #f3bb35))', '#f3bb35')
        .replaceAll('var(--lgs--logo-text-primary, #f3bb35)', '#f3bb35')
        .replaceAll('var(--lgs--logo-text-secondary, var(--lgs--logo-secondary, #bfa062))', '#f3bb35')
}

/**
 * Expands a rendered bounding box by the configured PNG safety margin.
 *
 * @param {import('@resvg/resvg-js').BBox} bbox - Visible SVG bounds.
 * @returns {import('@resvg/resvg-js').BBox} Padded bounds.
 */
const paddedBBox = bbox => {
    bbox.x -= PNG_PADDING
    bbox.y -= PNG_PADDING
    bbox.width += PNG_PADDING * 2
    bbox.height += PNG_PADDING * 2
    return bbox
}

/**
 * Returns the visible SVG bounds required to crop a PNG while preserving a safety margin.
 *
 * @param {Resvg} renderer - SVG renderer used to calculate visible bounds.
 * @returns {import('@resvg/resvg-js').BBox} Padded visible bounds.
 */
const getPngCropBBox = renderer => {
    const bbox = renderer.getBBox()

    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        throw new Error('The SVG must contain visible geometry to generate a cropped PNG')
    }

    return paddedBBox(bbox)
}

/**
 * Renders an SVG and crops the PNG to its visible geometry plus a safety margin.
 *
 * @param {string} inputPath - Source SVG path.
 * @param {string} outputPath - Destination PNG path.
 * @returns {void}
 */
const renderPng = (inputPath, outputPath) => {
    const svgText = prepareSvgForPng(readFile(inputPath), inputPath)
    const renderer = new Resvg(svgText, {
        resourcesDir: path.dirname(inputPath),
        background: 'rgba(0, 0, 0, 0)',
    })

    renderer.cropByBBox(getPngCropBBox(renderer))
    writeBinaryFile(outputPath, renderer.render().asPng())
}

/**
 * Renders all canonical logo variants to matching PNG files.
 *
 * @returns {void}
 */
const renderCanonicalPngs = () => {
    for (const fileName of DEFAULT_LOGO_FILES) {
        const inputPath = path.join(DEFAULT_LOGO_DIR, fileName)
        const outputPath = inputPath.replace(/\.svg$/i, '.png')
        renderPng(inputPath, outputPath)
        console.log(`${fileName} -> ${path.basename(outputPath)}`)
    }
}

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help' || command === '-h') {
    usage()
    process.exit(0)
}

const inputPath = path.resolve(args[1] ?? path.join(DEFAULT_LOGO_DIR, command === 'export' ? 'logo.svg' : 'logo-editable.svg'))
const outputPath = path.resolve(args[2] ?? path.join(DEFAULT_LOGO_DIR, command === 'export' ? 'logo-editable.svg' : 'logo.svg'))

try {
    if (command === 'export') {
        exportEditable(inputPath, outputPath)
        renderCanonicalPngs()
    } else if (command === 'import') {
        importEditable(inputPath, outputPath)
        renderCanonicalPngs()
    } else if (command === 'png') {
        if (args[1]) {
            renderPng(inputPath, args[2] ? outputPath : inputPath.replace(/\.svg$/i, '.png'))
            console.log(`${path.basename(inputPath)} -> ${path.basename(args[2] ? outputPath : inputPath.replace(/\.svg$/i, '.png'))}`)
        } else {
            renderCanonicalPngs()
        }
    } else {
        usage()
        process.exit(1)
    }
} catch (error) {
    console.error(error.message)
    process.exit(1)
}
