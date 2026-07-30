/**
 * @file CountApi.js
 * @description Sends anonymous aggregate count events to the Studio backend.
 */

const COUNT_EVENT_PATHS = Object.freeze({
    visit:      'visit',
    journey:    'journey',
    draftVideo: 'video/draft',
    hqVideo:    'video/hq',
})

let visitEventSent = false

/**
 * Resolve the browser's IANA time zone for count calendar periods.
 *
 * @returns {string} Browser time zone, or UTC when the browser does not expose one.
 */
const getClientTimeZone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    }
    catch {
        return 'UTC'
    }
}

/**
 * Builds the backend URL for a count event.
 *
 * @param {string} eventPath - Relative count event path
 * @returns {string|null} Count endpoint URL or null when the backend is unavailable
 */
const getCountEventUrl = eventPath => {
    const backendApi = globalThis.lgs?.BACKEND_API
    if (!backendApi) {
        return null
    }

    return `${backendApi.replace(/\/+$/, '')}/count/${eventPath}`
}

/**
 * Sends one anonymous count event and its calendar time zone without blocking the caller.
 *
 * @param {string} eventPath - Relative count event path
 * @returns {Promise<boolean>} Whether the request was accepted by the browser and backend
 */
const postCountEvent = eventPath => {
    const url = getCountEventUrl(eventPath)
    const fetchImplementation = globalThis.fetch
    if (!url || typeof fetchImplementation !== 'function') {
        return Promise.resolve(false)
    }

    try {
        return Promise.resolve(fetchImplementation(url, {
            method:      'POST',
            credentials: 'omit',
            headers:     {'Content-Type': 'application/json'},
            body:        JSON.stringify({timeZone: getClientTimeZone()}),
            keepalive:   true,
        }))
            .then(response => response?.ok !== false)
            .catch(() => false)
    }
    catch {
        return Promise.resolve(false)
    }
}

/**
 * Provides the anonymous aggregate count event operations used by Studio.
 */
export class CountApi {
    /**
     * Records one successful bootstrap visit for the current application session.
     *
     * @returns {Promise<boolean>} Whether the request was accepted by the browser and backend
     */
    static sendVisit = () => {
        if (visitEventSent) {
            return Promise.resolve(false)
        }

        visitEventSent = true
        return postCountEvent(COUNT_EVENT_PATHS.visit)
    }

    /**
     * Records one successfully loaded journey.
     *
     * @returns {Promise<boolean>} Whether the request was accepted by the browser and backend
     */
    static sendJourney = () => postCountEvent(COUNT_EVENT_PATHS.journey)

    /**
     * Records one successfully produced draft video.
     *
     * @returns {Promise<boolean>} Whether the request was accepted by the browser and backend
     */
    static sendDraftVideo = () => postCountEvent(COUNT_EVENT_PATHS.draftVideo)

    /**
     * Records one successfully completed HQ video export.
     *
     * @returns {Promise<boolean>} Whether the request was accepted by the browser and backend
     */
    static sendHqVideo = () => postCountEvent(COUNT_EVENT_PATHS.hqVideo)

    /**
     * Resets in-memory session guards for isolated tests.
     *
     * @returns {void}
     */
    static resetSessionForTests = () => {
        visitEventSent = false
    }
}
