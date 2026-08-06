/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const HTML_ENTITY_PATTERN = /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/i
const HTML_ENTITY_REPLACE_PATTERN = /&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi

const NAMED_ENTITIES = {
    amp:    '&',
    apos:   '\'',
    gt:     '>',
    lt:     '<',
    nbsp:   ' ',
    quot:   '"',
    aacute: '\u00e1',
    acirc:  '\u00e2',
    agrave: '\u00e0',
    aring:  '\u00e5',
    atilde: '\u00e3',
    auml:   '\u00e4',
    ccedil: '\u00e7',
    eacute: '\u00e9',
    ecirc:  '\u00ea',
    egrave: '\u00e8',
    euml:   '\u00eb',
    iacute: '\u00ed',
    icirc:  '\u00ee',
    igrave: '\u00ec',
    iuml:   '\u00ef',
    ntilde: '\u00f1',
    oacute: '\u00f3',
    ocirc:  '\u00f4',
    ograve: '\u00f2',
    oslash: '\u00f8',
    otilde: '\u00f5',
    ouml:   '\u00f6',
    uacute: '\u00fa',
    ucirc:  '\u00fb',
    ugrave: '\u00f9',
    uuml:   '\u00fc',
    yuml:   '\u00ff',
}

let decoderElement

const decodeWithDOM = (value) => {
    if (typeof document === 'undefined') {
        return null
    }

    decoderElement ??= document.createElement('textarea')
    decoderElement.innerHTML = value
    return decoderElement.value
}

const decodeWithoutDOM = (value) => {
    return value.replace(HTML_ENTITY_REPLACE_PATTERN, (match, decimal, hexadecimal, named) => {
        if (decimal) {
            return String.fromCodePoint(Number.parseInt(decimal, 10))
        }
        if (hexadecimal) {
            return String.fromCodePoint(Number.parseInt(hexadecimal, 16))
        }
        return NAMED_ENTITIES[named.toLowerCase()] ?? match
    })
}

export const decodeHTMLEntities = (value = '') => {
    if (value === null || value === undefined) {
        return ''
    }

    let decoded = `${value}`
    if (!HTML_ENTITY_PATTERN.test(decoded)) {
        return decoded
    }

    for (let index = 0; index < 3; index++) {
        const next = decodeWithDOM(decoded) ?? decodeWithoutDOM(decoded)
        if (next === decoded || !HTML_ENTITY_PATTERN.test(next)) {
            return next
        }
        decoded = next
    }

    return decoded
}
