#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const ROOT = process.cwd()
const DEFAULT_LOGO_DIR = path.join(ROOT, 'public', 'assets', 'logo')

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8')
const writeFile = (filePath, content) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, content)
}

const usage = () => {
    console.log(`Usage:
  bun scripts/logo-tool.mjs export [input] [output]
  bun scripts/logo-tool.mjs import [input] [output]

Defaults:
  export: ${path.join(DEFAULT_LOGO_DIR, 'logo.svg')} -> ${path.join(DEFAULT_LOGO_DIR, 'logo-editable.svg')}
  import: ${path.join(DEFAULT_LOGO_DIR, 'logo-editable.svg')} -> ${path.join(DEFAULT_LOGO_DIR, 'logo.svg')}
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
    } else if (command === 'import') {
        importEditable(inputPath, outputPath)
    } else {
        usage()
        process.exit(1)
    }
} catch (error) {
    console.error(error.message)
    process.exit(1)
}
