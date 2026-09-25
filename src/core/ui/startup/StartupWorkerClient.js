/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StartupWorkerClient.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Keep startup database work behind a small, acknowledged worker protocol.
 *
 * Acknowledging each packet is deliberate: it applies back pressure and
 * prevents a large local database from flooding the main thread.
 */
export const yieldStartupTask = () => globalThis.scheduler?.yield
    ? globalThis.scheduler.yield()
    : new Promise(resolve => setTimeout(resolve, 0))

/**
 * Give the browser an idle window before deferred startup work.
 * The timeout keeps the queue moving in busy tabs.
 */
export const yieldStartupIdleTask = () => {
    if (typeof globalThis.requestIdleCallback === 'function') {
        return new Promise(resolve => globalThis.requestIdleCallback(resolve, {timeout: 500}))
    }

    return new Promise(resolve => {
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(() => setTimeout(resolve, 0))
            return
        }

        setTimeout(resolve, 16)
    })
}

/** Maximum time allowed for one acknowledged startup worker request. */
const STARTUP_WORKER_REQUEST_TIMEOUT = 30_000

export class StartupWorkerClient {
    #worker
    #pending = null
    #disposed = false
    #requestTimeout
    #nextRequestId = 0

    constructor(worker = new Worker(new URL('./startupData.worker.js', import.meta.url), {type: 'module'}), {requestTimeout = STARTUP_WORKER_REQUEST_TIMEOUT} = {}) {
        this.#worker = worker
        this.#requestTimeout = Number.isFinite(requestTimeout) && requestTimeout > 0
            ? requestTimeout
            : STARTUP_WORKER_REQUEST_TIMEOUT
        worker.onmessage = this.#receive
        worker.onerror = () => this.dispose(new Error('Startup data worker failed'))
        worker.onmessageerror = () => this.dispose(new Error('Startup data worker message could not be decoded'))
    }

    #receive = async event => {
        const packet = event?.data
        const pending = this.#pending
        if (!pending || !packet) {
            return
        }

        if (packet.type === 'error') {
            this.#rejectPending(new Error(packet.message || 'Startup data worker failed'))
            return
        }

        if (packet.type === 'done') {
            this.#resolvePending(packet.result)
            return
        }

        if (packet.type !== 'packet') {
            return
        }

        pending.lastPacketType = packet.data?.type ?? 'unknown'
        pending.lastPacketId = packet.id ?? null
        try {
            await pending.consume?.(packet.data)
            await yieldStartupTask()
            if (this.#pending !== pending) {
                return
            }
            this.#worker.postMessage({type: 'ack', id: packet.id})
        }
        catch (error) {
            if (this.#pending !== pending) {
                return
            }
            this.#cancelPending(pending)
            this.#rejectPending(error)
        }
    }

    #clearPending = () => {
        if (this.#pending?.timeoutId !== null) {
            clearTimeout(this.#pending.timeoutId)
        }
        this.#pending = null
    }

    /** Rejects and clears the active worker request. */
    #rejectPending = error => {
        const pending = this.#pending
        if (!pending) {
            return
        }

        this.#clearPending()
        pending.reject(error)
    }

    /** Resolves and clears the active worker request. */
    #resolvePending = result => {
        const pending = this.#pending
        if (!pending) {
            return
        }

        this.#clearPending()
        pending.resolve(result)
    }

    /** Requests cancellation of the active worker operation. */
    #cancelPending = pending => {
        try {
            this.#worker.postMessage({type: 'cancel', requestId: pending.requestId})
        }
        catch {
            // The worker may already have terminated during request cleanup.
        }
    }

    request = (request, consume) => {
        if (this.#disposed) {
            return Promise.reject(new Error('Startup data worker client is disposed'))
        }
        if (this.#pending) {
            return Promise.reject(new Error('A startup data request is already running'))
        }

        return new Promise((resolve, reject) => {
            const requestId = ++this.#nextRequestId
            const pending = {
                consume,
                lastPacketId: null,
                lastPacketType: null,
                reject,
                requestId,
                resolve,
                timeoutId: null,
            }
            this.#pending = pending
            pending.timeoutId = setTimeout(() => {
                if (this.#pending !== pending) {
                    return
                }

                this.#cancelPending(pending)
                const lastPacket = pending.lastPacketType
                    ? `; last packet: ${pending.lastPacketType}#${pending.lastPacketId}`
                    : '; no packet received'
                this.dispose(new Error(`Startup data worker request ${requestId} timed out after ${this.#requestTimeout} ms${lastPacket}`))
            }, this.#requestTimeout)
            try {
                const {type: requestType = 'request', ...payload} = request ?? {}
                this.#worker.postMessage({
                    ...payload,
                    requestType,
                    requestId,
                    type: 'request',
                })
            }
            catch (error) {
                this.#rejectPending(error)
            }
        })
    }

    dispose = (error = new DOMException('Startup data worker was disposed', 'AbortError')) => {
        if (this.#disposed) {
            return
        }

        this.#disposed = true
        this.#worker.terminate?.()
        this.#rejectPending(error)
    }
}
