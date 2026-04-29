/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ChangelogManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export class ChangelogManager {
    #filesPromise = null
    #contentCache = new Map()
    #pageCache = new Map()

    constructor() {
        // Singleton
        if (ChangelogManager.instance) {
            return ChangelogManager.instance
        }
        ChangelogManager.instance = this
    }

    /**
     * List the change log directory and get all markdown files.
     * @return {{files:[],last:{}}}
     */
    list = async () => {
      return lgs.axios.get(`${[lgs.BACKEND_API,'changelog','list'].join('/')}?extension=md`)
            .then(function (response) {
                return response.data
            })
            .catch(function () {
                return {list: [], last: undefined}
            })
    }

    /**
     * Get all th files that were created after the last visit
     *
     * @param {[{name,time}]} files
     * @param {timestamp} lastVisit  the last visit date
     *
     * @return {[{name,time}]}
     */
    whatsNew = (files,lastVisit) => {
        return files.filter(file=> file.time > lastVisit)
    }

    /**
     * Read  changelog file
     */
    read =async(file)=> {
        return lgs.axios.get([lgs.BACKEND_API,'changelog','read',file].join('/'))
            .then(function (response) {
                return response.data.content
            })
            .catch(function (error) {
                console.error(error)
                return ''
            })
    }

    /**
     * Lazily load and cache the changelog file list.
     */
    getFiles = async () => {
        if (!this.#filesPromise) {
            this.#filesPromise = this.list().then(files => {
                const data = files ?? {}
                const list = Array.isArray(data.list)
                             ? [...data.list].sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
                             : []

                const normalizedFiles = {
                    ...data,
                    list,
                    last: data.last ?? list[0],
                }

                lgs.changelog = {
                    files:  normalizedFiles,
                    toRead: this.whatsNew(list, lgs.settings.app.lastVisit),
                }

                return normalizedFiles
            })
        }

        return this.#filesPromise
    }

    /**
     * Read one changelog file once and keep its content in memory.
     *
     * @param {string} file
     * @return {Promise<string>}
     */
    readFile = async (file) => {
        if (!file) {
            return ''
        }

        if (!this.#contentCache.has(file)) {
            this.#contentCache.set(file, this.read(encodeURIComponent(file)))
        }

        return this.#contentCache.get(file)
    }

    /**
     * Read a page of changelog entries.
     *
     * @param {number} page
     * @param {number} pageSize
     * @return {Promise<{entries: *[], page: number, pageSize: number, total: number, hasPrevious: boolean, hasNext:
     *     boolean, last: *}>}
     */
    getPage = async (page = 0, pageSize = 5) => {
        const pageIndex = Math.max(0, page)
        const key = `${pageIndex}:${pageSize}`

        if (!this.#pageCache.has(key)) {
            this.#pageCache.set(key, this.getFiles().then(async files => {
                const start = pageIndex * pageSize
                const pageFiles = files.list.slice(start, start + pageSize)
                const content = await Promise.all(pageFiles.map(news => this.readFile(news.file)))

                return {
                    entries:     pageFiles.map((news, index) => ({
                        ...news,
                        content: content[index],
                    })),
                    page:        pageIndex,
                    pageSize,
                    total:       files.list.length,
                    hasPrevious: pageIndex > 0,
                    hasNext:     start + pageSize < files.list.length,
                    last:        files.last,
                }
            }))
        }

        return this.#pageCache.get(key)
    }

    /**
     * Warm up a future page without forcing a render.
     */
    prefetchPage = async (page = 0, pageSize = 5) => {
        await this.getPage(page, pageSize)
    }
}
