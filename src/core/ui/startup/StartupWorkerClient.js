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
 * Last modified: 2026-09-20
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

export class StartupWorkerClient {
    #worker
    #pending = null
    #disposed = false

    constructor(worker = new Worker(new URL('./startupData.worker.js', import.meta.url), {type: 'module'})) {
        this.#worker = worker
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
            pending.reject(new Error(packet.message || 'Startup data worker failed'))
            this.#clearPending()
            return
        }

        if (packet.type === 'done') {
            pending.resolve(packet.result)
            this.#clearPending()
            return
        }

        if (packet.type !== 'packet') {
            return
        }

        try {
            await pending.consume?.(packet.data)
            await yieldStartupTask()
            this.#worker.postMessage({type: 'ack', id: packet.id})
        }
        catch (error) {
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
        this.#worker.terminate?.()
        this.#pending?.reject(error)
        this.#clearPending()
    }
}
