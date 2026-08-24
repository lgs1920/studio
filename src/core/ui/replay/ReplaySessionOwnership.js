/**
 * Explicit ownership leases for replay lifecycle side effects.
 */

const replaySessionOwnershipByOwner = new WeakMap()

/**
 * Return whether a value can own a replay session lease.
 *
 * @param {*} owner - Potential session owner.
 * @returns {boolean} Whether the owner can be used in a WeakMap.
 */
const isReplaySessionOwnershipOwner = owner => Boolean(
    owner
    && (typeof owner === 'object' || typeof owner === 'function'),
)

/**
 * Start a new replay lifecycle lease and invalidate every older lease.
 *
 * @param {Object} owner - Replay mode or render host that owns side effects.
 * @param {Object} metadata - Plain session metadata.
 * @returns {Object|null} New immutable ownership lease.
 */
export const beginReplaySessionOwnership = (owner, metadata = {}) => {
    if (!isReplaySessionOwnershipOwner(owner)) {
        return null
    }

    const previous = replaySessionOwnershipByOwner.get(owner)
    const sequence = (previous?.sequence ?? 0) + 1
    const lease = Object.freeze({
        id: `replay-session-${sequence}`,
        sequence,
        source: metadata?.source ?? 'draft',
        startedAt: globalThis.performance?.now?.() ?? Date.now(),
    })
    replaySessionOwnershipByOwner.set(owner, {sequence, lease})
    return lease
}

/**
 * Return the current replay lifecycle lease for one owner.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Active ownership lease.
 */
export const currentReplaySessionOwnership = owner => {
    if (!isReplaySessionOwnershipOwner(owner)) {
        return null
    }

    return replaySessionOwnershipByOwner.get(owner)?.lease ?? null
}

/**
 * Return whether a lease still owns replay lifecycle side effects.
 *
 * @param {Object} owner - Replay session owner.
 * @param {Object|null} lease - Lease to validate.
 * @returns {boolean} Whether the lease is current.
 */
export const ownsReplaySession = (owner, lease) => Boolean(
    lease
    && currentReplaySessionOwnership(owner)?.id === lease.id,
)

/**
 * Release a replay lease only when it is still current.
 *
 * @param {Object} owner - Replay session owner.
 * @param {Object|null} lease - Lease to release.
 * @returns {boolean} Whether the active lease was released.
 */
export const releaseReplaySessionOwnership = (owner, lease) => {
    if (!ownsReplaySession(owner, lease)) {
        return false
    }

    const current = replaySessionOwnershipByOwner.get(owner)
    replaySessionOwnershipByOwner.set(owner, {
        sequence: current?.sequence ?? lease.sequence,
        lease: null,
    })
    return true
}

/**
 * Invalidate active ownership without resetting its monotonic sequence.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {boolean} Whether an active lease was invalidated.
 */
export const invalidateReplaySessionOwnership = owner => {
    const lease = currentReplaySessionOwnership(owner)
    return lease ? releaseReplaySessionOwnership(owner, lease) : false
}
