/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Export.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-06
 * Last modified: 2026-04-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { snapdom }                from '@zumer/snapdom'
import { default as html2canvas } from 'html2canvas'
import { DateTime }               from 'luxon'

export class Export {

    static toPDF = async (element, file) => {


        if (typeof element === 'string') {
            element = document.querySelector(element)
        }

        element.classList.toggle('snapshot-in-progress')

        await html2canvas(element, {
            dpi: 600,
        }).then((canvas) => {
            element.classList.toggle('snapshot-in-progress')


            const orientation = canvas.width >= canvas.height ? 'l' : 'p'
            const imgData = canvas.toDataURL('image/png')
            const doc = new window.jspdf.jsPDF({
                orientation,
                unit: 'px',
                format: 'a4',
            })

            const ratio = canvas.height / canvas.width
            const margin = 20 //px
            let position = margin
            const fileName = `${file}.pdf`

            let componentWidth = Math.min(canvas.width, doc.internal.pageSize.width)
            let componentHeight = componentWidth * ratio
            if (orientation === 'p') {
                componentHeight = Math.min(canvas.height, doc.internal.pageSize.height)
                componentWidth = componentHeight / ratio
            }
            doc.internal.pageSize.width = componentWidth + 2 * margin
            doc.internal.pageSize.height = componentHeight + 2 * margin


            doc.addImage(imgData, 'PNG', margin, position, componentWidth, componentHeight)
            doc.setFontSize(10)
            doc.text(fileName, margin, position - margin / 2)
            doc.text(`Created on ${DateTime.now().toLocaleString(DateTime.DATETIME_FULL)}`,
                margin, doc.internal.pageSize.height - margin / 2)
            doc.save(fileName)
        })
    }
    static toPNG = async (element, file, scale = 1) => {
        if (typeof element === 'string') {
            element = document.querySelector(element)
        }
        element.parentElement.classList.toggle('snapshot-in-progress')
        snapdom(element, {scale}).then(snap => snap.toCanvas()).then((canvas) => {
            canvas.toBlob((blob) => Export.toFile(blob, `${file}.png`))
            element.parentElement.classList.toggle('snapshot-in-progress')
        })

    }

    /**
     * Export to SVG
     *
     * @param svg  {{dom:{Element},content:{string}}} svg dom and content
     * @param file
     */
    static async toSVG(svg, file) {
        svg.dom.parentElement.classList.toggle('snapshot-in-progress')
        await fetch(svg.content)
            .then(response => response.text())
            .then(content => {
                Export.toFile(content, `${file}.svg`, 'image/svg+xml')
                svg.dom.parentElement.classList.toggle('snapshot-in-progress')
            });
    }

    /**
     * Copy a string to the clipboard
     *
     * @param text
     *
     * @since 1.0
     *
     */
    static toClipboard = async (text) => {
        let result = true
        if (!navigator.clipboard) {
            let c = document.createElement('textarea')
            c.value = text
            c.style.maxWidth = '0px'
            c.style.maxHeight = '0px'
            c.style.position = 'fixed'  // Prevent scrolling to bottom of page in Microsoft Edge.
            document.body.appendChild(c)
            c.focus()
            c.select()
            try {
                document.execCommand('copy')
            }
            catch (error) {
                console.error(error)
                result = false
            } finally {
                document.body.removeChild(c)
            }
        } else {
            try {
                document.body.focus()
                await navigator.clipboard.writeText(text)
            }
            catch (error) {
                console.error(error)
                result = false
            }
        }
        return result
    }


    static CanvasToClipboard = async (canvas) => {
        await canvas.toBlob(function (blob) {
            const item = new ClipboardItem({'image/svg': blob})
            navigator.clipboard.write([item])
        })
    }
    /**
     * Export content to a file
     *
     * @param content
     * @param file
     * @param type
     */

    static toFile = async (content = '', file = 'sample.txt', type = 'text/Plain') => {
        const link = document.createElement('a')
        const blob = new Blob([content], {type: type})
        link.href = URL.createObjectURL(blob)
        link.download = file
        link.click()
        await URL.revokeObjectURL(link.href)
    }

    /**
     * Advanced text extraction for rows and items with title handling.
     * Titles force a newline BEFORE themselves to create clear sections.
     * @param {string} selector - CSS selector for the rows
     * @param {string} titleClass - Class name identifying title items
     * @param {ParentNode} root - DOM scope used for the query
     * @returns {string|false}
     */
    static toText = (selector, titleClass = 'title', root = document) => {
        const _rows = root.querySelectorAll(selector)
        if (_rows.length === 0) {
            return false
        }

        return Array.from(_rows)
            .map(($row) => {
                const _items = $row.querySelectorAll('.element-item')

                if (_items.length === 0) {
                    return $row.innerText.trim().replace(/\s+/g, ' ')
                }

                return Array.from(_items)
                    .map(($item, index) => {
                        // Extract text from child nodes to avoid merging
                        const _content = Array.from($item.childNodes)
                            .map(($node) => $node.textContent.trim())
                            .filter((_text) => _text !== '')
                            .join(' ')

                        const _isTitle = $item.classList.contains(titleClass)
                        const _isLast = index === _items.length - 1

                        // If it's a title, we want a newline BEFORE it to separate blocks
                        // We also add a ":" after the title for clarity
                        if (_isTitle) {
                            return `\n${_content}: `
                        }

                        // Otherwise, it's a value, we just add a tab if it's not the last item
                        return _isLast ? _content : `${_content} \t `
                    })
                    .join('')
            })
            .join('\n')
            .trim() // Removes leading/trailing whitespace including the first potential \n
    }
}
