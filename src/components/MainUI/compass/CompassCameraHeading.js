/**
 * Resolve the heading exposed by a published HQ replay frame.
 *
 * @param {Object} options - Heading resolution options.
 * @param {Object|null} [options.hqFrame=null] - Published HQ frame state.
 * @param {number|null} [options.fallbackHeading=null] - Interactive camera fallback.
 * @returns {number|null} Camera heading in radians.
 */
export const resolveCompassCameraHeading = ({hqFrame = null, fallbackHeading = null} = {}) => {
    const candidates = [
        hqFrame?.renderContract?.cameraPose?.heading,
        hqFrame?.renderContract?.logicalFrame?.cameraPose?.heading,
        hqFrame?.intent?.scene?.cameraPose?.heading,
        fallbackHeading,
    ]

    for (const candidate of candidates) {
        const heading = Number(candidate)
        if (Number.isFinite(heading)) {
            return heading
        }
    }

    return null
}
