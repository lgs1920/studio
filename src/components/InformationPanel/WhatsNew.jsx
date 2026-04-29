/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WhatsNew.jsx
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

import { LGSScrollbars }                                     from '@Components/MainUI/LGSScrollbars'
import { ChangelogManager }                                  from '@Core/ui/ChangelogManager'
import { WaButton, WaDetails, WaDivider, WaIcon, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { DateTime }                                          from 'luxon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { default as ReactMarkdown }                          from 'react-markdown'

const PAGE_SIZE = 5

const initialState = {
    data:        [],
    page:        0,
    total:       0,
    hasPrevious: false,
    hasNext:     false,
    loading:     false,
    loaded:      false,
    error:       false,
}

const formatNews = pageData => pageData.entries.map((news) => {
    const file = news.file ?? ''

    return {
        name:    file.slice(0, -3).replace(/_/gi, ' '),
        date:    DateTime.fromMillis(news.time).toLocaleString(DateTime.DATE_MED),
        time:    news.time,
        version: news.version,
        content: news.content,
    }
})

const runWhenIdle = callback => {
    if (typeof window === 'undefined') {
        callback()
        return
    }

    if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(callback, {timeout: 1000})
        return
    }

    window.setTimeout(callback, 0)
}

export const WhatsNew = ({visible = false}) => {
    const changelog = useMemo(() => new ChangelogManager(), [])
    const newsList = useRef(null)
    const requestId = useRef(0)
    const [state, setState] = useState(initialState)
    const [openDetails, setOpenDetails] = useState(new Set())

    const prefetchPage = useCallback((page) => {
        runWhenIdle(() => {
            changelog.prefetchPage(page, PAGE_SIZE).catch(console.error)
        })
    }, [changelog])

    const loadPage = useCallback(async (page) => {
        const currentRequest = ++requestId.current

        setState(previous => ({
            ...previous,
            loading: true,
            error:   false,
        }))

        try {
            const pageData = await changelog.getPage(page, PAGE_SIZE)

            if (currentRequest !== requestId.current) {
                return
            }

            const data = formatNews(pageData)
            setState({
                         data,
                         page:        pageData.page,
                         total:       pageData.total,
                         hasPrevious: pageData.hasPrevious,
                         hasNext:     pageData.hasNext,
                         loading:     false,
                         loaded:      true,
                         error:       false,
                     })
            setOpenDetails(new Set(data[0]?.name ? [data[0].name] : []))

            if (pageData.hasNext) {
                prefetchPage(pageData.page + 1)
            }
        }
        catch (error) {
            console.error(error)

            if (currentRequest !== requestId.current) {
                return
            }

            setState(previous => ({
                ...previous,
                loading: false,
                loaded:  true,
                error:   true,
            }))
        }
    }, [changelog, prefetchPage])

    const showDetails = useCallback((name) => {
        setOpenDetails(previous => {
            const next = new Set(previous)
            next.add(name)
            return next
        })
    }, [])

    const hideDetails = useCallback((name) => {
        setOpenDetails(previous => {
            if (!previous.has(name)) {
                return previous
            }

            const next = new Set(previous)
            next.delete(name)
            return next
        })
    }, [])

    useEffect(() => {
        if (visible && !state.loaded && !state.loading) {
            const timeout = window.setTimeout(() => loadPage(0), 0)
            return () => window.clearTimeout(timeout)
        }
    }, [loadPage, state.loaded, state.loading, visible])

    const pageStart = state.total === 0 ? 0 : state.page * PAGE_SIZE + 1
    const pageEnd = Math.min((state.page + 1) * PAGE_SIZE, state.total)

    return (
        <LGSScrollbars>
            <div className="lgs--details-list lgs--whats-new-list" ref={newsList}>
                {state.loading && state.data.length === 0 && (
                    <div className="lgs--whats-new-state">
                        <WaSpinner/>
                    </div>
                )}

                {state.error && (
                    <div className="lgs--whats-new-state">
                        {'Changelog unavailable'}
                    </div>
                )}

                {state.loaded && !state.error && state.data.length === 0 && (
                    <div className="lgs--whats-new-state">
                        {'No changelog available'}
                    </div>
                )}

                {state.data.map(file => {
                    const isOpen = openDetails.has(file.name)

                    return (
                        <WaDetails small
                                   appearance="Filled-outlined"
                                   open={isOpen}
                                   key={file.name}
                                   name="whats-new-list"
                                   className={`lgs--details-hoverable ${isOpen ? 'wa-details-open' : ''}`}
                                   onWaShow={() => showDetails(file.name)}
                                   onWaHide={() => hideDetails(file.name)}
                        >
                            <span slot="summary"><strong>{file.version}</strong> - {file.date}</span>
                            <WaDivider/>
                            <div className="version-content">
                                <ReactMarkdown children={file.content}/>
                            </div>
                        </WaDetails>
                    )
                })}

                {(state.hasPrevious || state.hasNext) && (
                    <div className="lgs--whats-new-pagination">
                        {state.hasPrevious
                         ? (
                             <WaButton size="small"
                                       appearance="plain"
                                       variant="brand"
                                       disabled={state.loading}
                                       onClick={() => loadPage(state.page - 1)}>
                                 <WaIcon slot="start" name="arrow-left" variant="regular"/>
                                 {'Next'}
                             </WaButton>
                         )
                         : <span className="lgs--whats-new-pagination-spacer"/>}

                        <span>{pageStart} - {pageEnd} / {state.total}</span>

                        {state.hasNext
                         ? (
                             <WaButton size="small"
                                       appearance="plain"
                                       variant="brand"
                                       disabled={state.loading}
                                       onClick={() => loadPage(state.page + 1)}>
                                 {'Previous'}
                                 <WaIcon slot="end" name="arrow-right" variant="regular"/>
                             </WaButton>
                         )
                         : <span className="lgs--whats-new-pagination-spacer"/>}
                    </div>
                )}
            </div>
        </LGSScrollbars>


    )
}
