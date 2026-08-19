/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ErrorDiagnosticUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { formatBuildInfo, UNKNOWN_BUILD_INFO } from '@Utils/BuildInfoUtils'

export const UNKNOWN_DIAGNOSTIC_VALUE = 'Unavailable'

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]))

/**
 * Sanitizes error markup before it is rendered inside a callout.
 * @param {unknown} value
 * @returns {string}
 */
export const sanitizeErrorHtml = value => {
    const source = typeof value === 'string'
        ? value
        : value == null
            ? ''
            : JSON.stringify(value) ?? ''
    if (typeof document === 'undefined') {
        return escapeHtml(source)
    }

    const container = document.createElement('div')
    container.innerHTML = source
    container.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(node => node.remove())
    container.querySelectorAll('*').forEach(node => {
        Array.from(node.attributes).forEach(attribute => {
            const isEventAttribute = /^on/i.test(attribute.name)
            const isJavascriptUrl = ['href', 'src', 'xlink:href'].includes(attribute.name)
                && /^\s*javascript:/i.test(attribute.value)
            if (isEventAttribute || isJavascriptUrl) {
                node.removeAttribute(attribute.name)
            }
        })
    })

    return container.innerHTML
}

const getErrorMessage = error => {
    if (typeof error === 'string') {
        return error
    }

    return String(error?.message ?? error ?? UNKNOWN_DIAGNOSTIC_VALUE)
}

const getErrorCode = error => {
    if (error?.code === undefined || error?.code === null || error?.code === '') {
        return UNKNOWN_DIAGNOSTIC_VALUE
    }

    return String(error.code)
}

const getFileModified = file => {
    if (!Number.isFinite(file?.lastModified) || file.lastModified <= 0) {
        return UNKNOWN_DIAGNOSTIC_VALUE
    }

    try {
        return new Date(file.lastModified).toISOString()
    }
    catch {
        return UNKNOWN_DIAGNOSTIC_VALUE
    }
}

const getReadStrategies = (error, readStrategies) => {
    const attempts = Array.isArray(error?.readAttempts)
        ? error.readAttempts.map(attempt => attempt?.strategy).filter(Boolean)
        : []
    const strategies = attempts.length > 0 ? attempts : readStrategies

    return Array.isArray(strategies) && strategies.length > 0
        ? strategies.join(', ')
        : UNKNOWN_DIAGNOSTIC_VALUE
}

/**
 * Collects environment, file, read, and error information without including file contents.
 * @param {Object} options
 * @param {unknown} options.error
 * @param {File|Object} [options.file]
 * @param {string} [options.fileName]
 * @param {string|string[]} [options.readStrategies]
 * @param {string} [options.suggestedFix]
 * @param {Object} [options.context]
 * @returns {Object}
 */
export const collectErrorDiagnostic = ({
    context = globalThis.lgs,
    error,
    file,
    fileName,
    readStrategies = [],
    suggestedFix,
} = {}) => {
    const browser = globalThis.navigator?.userAgent
    const resolvedFileName = fileName ?? file?.name
    const resolvedStrategies = typeof readStrategies === 'string' ? [readStrategies] : readStrategies
    const build = formatBuildInfo(context?.build)

    return {
        version:        context?.versions?.studio ?? UNKNOWN_DIAGNOSTIC_VALUE,
        build:          build === UNKNOWN_BUILD_INFO ? UNKNOWN_DIAGNOSTIC_VALUE : build,
        platform:       context?.platform ?? UNKNOWN_DIAGNOSTIC_VALUE,
        browser:        browser || UNKNOWN_DIAGNOSTIC_VALUE,
        fileName:       resolvedFileName || UNKNOWN_DIAGNOSTIC_VALUE,
        fileType:       file?.type || UNKNOWN_DIAGNOSTIC_VALUE,
        fileSize:       Number.isFinite(file?.size) ? `${file.size} bytes` : UNKNOWN_DIAGNOSTIC_VALUE,
        fileModified:   getFileModified(file),
        readStrategy:   getReadStrategies(error, resolvedStrategies),
        errorName:      error?.name || (error ? 'Error' : UNKNOWN_DIAGNOSTIC_VALUE),
        errorCode:      getErrorCode(error),
        suggestedFix:   suggestedFix || UNKNOWN_DIAGNOSTIC_VALUE,
        originalError:  getErrorMessage(error),
        errorStack:     error?.stack ? String(error.stack) : UNKNOWN_DIAGNOSTIC_VALUE,
    }
}

/**
 * Formats a diagnostic object as readable, copyable plain text.
 * @param {Object} diagnostic
 * @returns {string}
 */
export const formatErrorDiagnostic = diagnostic => [
    `Studio version: ${diagnostic?.version ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Studio build: ${diagnostic?.build ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Platform: ${diagnostic?.platform ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Browser: ${diagnostic?.browser ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `File name: ${diagnostic?.fileName ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `File type: ${diagnostic?.fileType ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `File size: ${diagnostic?.fileSize ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `File modified: ${diagnostic?.fileModified ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Read strategy: ${diagnostic?.readStrategy ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Error name: ${diagnostic?.errorName ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    `Error code: ${diagnostic?.errorCode ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    '',
    `Suggested fix: ${diagnostic?.suggestedFix ?? UNKNOWN_DIAGNOSTIC_VALUE}`,
    '',
    'Original error:',
    diagnostic?.originalError ?? UNKNOWN_DIAGNOSTIC_VALUE,
    ...(diagnostic?.errorStack && diagnostic.errorStack !== UNKNOWN_DIAGNOSTIC_VALUE
        ? ['', 'Error stack:', diagnostic.errorStack]
        : []),
].join('\n')
