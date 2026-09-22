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
 * Last modified: 2026-09-22
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

const STARTUP_TRACE_ENABLED = () => globalThis.lgs?.stores?.main?.readyForTheShow === true

export class StartupWorkerClient {
    #worker
    #pending = null
    #disposed = false

    constructor(worker = new Worker(new URL('./startupData.worker.js', import.meta.url), {type: 'module'})) {
        this.#worker = worker
        if (STARTUP_TRACE_ENABLED()) {
            console.log('[StartupTrace] worker-client-created', {
                at: performance.now(),
            })
        }
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

        if (STARTUP_TRACE_ENABLED() && packet.data?.type !== 'geometry') {
            console.log('[StartupTrace] worker-message', {
                at:         performance.now(),
                packetType: packet.type,
                dataType:   packet.data?.type,
                id:         packet.id,
            })
        }

        if (packet.type === 'error') {
            pending.reject(new Error(packet.message || 'Startup data worker failed'))
            this.#clearPending()
            return
        }

        if (packet.type === 'done') {
            if (STARTUP_TRACE_ENABLED()) {
                console.log('[StartupTrace] worker-done', {
                    at: performance.now(),
                })
            }
            pending.resolve(packet.result)
            this.#clearPending()
            return
        }

        if (packet.type !== 'packet') {
            return
        }

        try {
            const consumeStart = performance.now()
            await pending.consume?.(packet.data)
            if (STARTUP_TRACE_ENABLED() && packet.data?.type !== 'geometry') {
                console.log('[StartupTrace] worker-consume-end', {
                    at:       performance.now(),
                    dataType: packet.data?.type,
                    duration: performance.now() - consumeStart,
                    id:       packet.id,
                })
            }
            await yieldStartupTask()
            if (STARTUP_TRACE_ENABLED() && packet.data?.type !== 'geometry') {
                console.log('[StartupTrace] worker-ack', {
                    at:       performance.now(),
                    dataType: packet.data?.type,
                    id:       packet.id,
                })
            }
            this.#worker.postMessage({type: 'ack', id: packet.id})
        }
        catch (error) {
            if (STARTUP_TRACE_ENABLED()) {
                console.log('[StartupTrace] worker-consume-error', {
                    at:       performance.now(),
                    dataType: packet.data?.type,
                    id:       packet.id,
                    message:  error?.message,
                })
            }
            pending.reject(error)
            this.#clearPending()
            this.#worker.postMessage({type: 'cancel', id: packet.id})
        }
    }

    #clearPending = () => {
        this.#pending = null
    }

    request = (request, consume) => {
        if (this.#disposed) {
            return Promise.reject(new Error('Startup data worker client is disposed'))
        }
        if (this.#pending) {
            return Promise.reject(new Error('A startup data request is already running'))
        }

        return new Promise((resolve, reject) => {
            this.#pending = {consume, reject, resolve}
            try {
                const {type: requestType = 'request', ...payload} = request ?? {}
                if (STARTUP_TRACE_ENABLED()) {
                    console.log('[StartupTrace] worker-request', {
                        at:          performance.now(),
                        key:         payload.key,
                        primary:     payload.primary,
                        requestType,
                    })
                }
                this.#worker.postMessage({
                    ...payload,
                    requestType,
                    type: 'request',
                })
            }
            catch (error) {
                reject(error)
                this.#clearPending()
            }
        })
    }

    dispose = (error = new DOMException('Startup data worker was disposed', 'AbortError')) => {
        if (this.#disposed) {
            return
        }

        this.#disposed = true
        if (STARTUP_TRACE_ENABLED()) {
            console.log('[StartupTrace] worker-client-dispose', {
                at:      performance.now(),
                message: error?.message,
                name:    error?.name,
            })
        }
        this.#worker.terminate?.()
        this.#pending?.reject(error)
        this.#clearPending()
    }
}
