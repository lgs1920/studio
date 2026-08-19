/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-loader-samples.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-11
 * Last modified: 2026-07-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyLoaderUI } from '@Components/FileLoader/JourneyLoaderUI'
import {
    getLoadableJourneySamples,
    journeySampleUrl,
    normalizeJourneySamplesCatalog,
} from '@Components/FileLoader/journeySamples'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { proxyMap } from 'valtio/utils'

const mocks = vi.hoisted(() => ({
    loadJourneyFromFile: vi.fn(),
    toastError:          vi.fn(),
    toastSuccess:        vi.fn(),
    toastWarning:        vi.fn(),
}))

vi.mock('@Components/FileLoader/JourneyFilesList', () => ({
    JourneyFilesList: () => <div data-testid="journey-files-list"/>,
}))

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   mocks.toastError,
        success: mocks.toastSuccess,
        warning: mocks.toastWarning,
    },
}))

vi.mock('@Utils/cesium/TrackUtils', () => ({
    ALREADY_IMPORTED:     {caption: 'Already imported', text: 'already imported'},
    IMPORT_FAILED:        {caption: 'Import failed', text: 'could not be imported'},
    IMPORT_NOT_SUPPORTED: {caption: 'Unsupported', text: 'is not supported'},
    IMPORT_SUCCESS:       {caption: 'Imported', text: 'was imported'},
    JOURNEY_EXISTS:       2,
    JOURNEY_KO:           0,
    JOURNEY_OK:           1,
    JOURNEY_WAITING:      3,
    TrackUtils:           {
        loadJourneyFromFile: mocks.loadJourneyFromFile,
    },
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, loading, variant, size, ...props}) => <button type={props.type ?? 'button'} {...props}>{children}</button>,
    WaCopyButton: ({from, ...props}) => <button data-copy-from={from} {...props}>{'Copy error'}</button>,
    WaDetails: ({children, open, summary, onWaShow, onWaHide, ...props}) => (
        <div {...props}>
            <button type="button" onClick={() => open ? onWaHide?.() : onWaShow?.()}>{summary}</button>
            {open ? children : null}
        </div>
    ),
    WaDialog: ({children, open, onWaRequestClose, ...props}) => open ? <div role="dialog" {...props}>{children}</div> : null,
    WaDivider: () => <hr/>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
    WaInput: ({children, name, value = '', onInput, onChange, placeholder, appearance, size, withClear, ...props}) => (
        <label>
            {placeholder}
            <input
                aria-label={name ?? placeholder}
                value={value}
                onInput={onInput}
                onChange={onChange}
                {...props}
            />
            {children}
        </label>
    ),
    WaOption: ({children, value, disabled, title}) => <option value={value} disabled={disabled} title={title}>{children}</option>,
    WaSelect: ({children, label, value = '', onChange, placeholder, appearance, size, ...props}) => (
        <label>
            {label}
            <select aria-label={label} value={value} onChange={onChange} data-placeholder={placeholder ?? ''} {...props}>
                {children}
            </select>
        </label>
    ),
    WaTextarea: ({label, value, ...props}) => (
        <label>
            {label}
            <textarea aria-label={label} value={value} readOnly {...props}/>
        </label>
    ),
    WaTooltip: ({children}) => <span>{children}</span>,
}))

const slugify = value => String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')

const setSlug = ({content}) => Array.isArray(content)
                               ? content.map(slugify).join('#')
                               : slugify(content)

const createLgs = ({loaded = []} = {}) => {
    const journeys = new Map(loaded.map(slug => [slug, {}]))

    return {
        axios: {
            get: vi.fn(async () => ({data: '<gpx />'})),
        },
        versions: {studio: '1.0.0-test'},
        platform: 'test',
        build: {date: '2026-08-17'},
        journeys,
        settings: proxy({
            samples: {
                journeys: {
                    basePath: 'samples/journeys',
                    items:    [
                        {
                            slug:        'sample-one#gpx',
                            name:        'Sample one',
                            description: 'Already loaded sample.',
                            filename:    'SampleOne.gpx',
                            format:      'gpx',
                        },
                        {
                            slug:        'sample-two#gpx',
                            name:        'Sample two',
                            description: 'Loadable sample.',
                            filename:    'SampleTwo.gpx',
                            format:      'gpx',
                        },
                    ],
                },
            },
        }),
        stores:   {
            main: proxy({
                components: {
                    fileLoader: {
                        fileList: proxyMap(),
                    },
                },
            }),
            ui:   proxy({
                mainUI: {
                    journeyLoader: {
                        visible: true,
                    },
                },
            }),
        },
        theJourney: {
            globalSettings: vi.fn(),
        },
    }
}

describe('journey sample catalog', () => {
    beforeEach(() => {
        globalThis.__ = {
            app: {
                isDevelopment: () => true,
                setSlug,
                slugify,
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
        vi.clearAllMocks()
    })

    it('normalizes catalog entries and filters already loaded journeys', () => {
        const catalog = normalizeJourneySamplesCatalog({
            journeys: {
                basePath: '/custom/journeys/',
                items:    [
                    {filename: 'First-Route.GPX', description: 'First sample'},
                    {slug: 'manual#kml', filename: 'Manual.kml', name: 'Manual'},
                    {filename: ''},
                ],
            },
        })

        expect(catalog).toHaveLength(2)
        expect(catalog[0]).toMatchObject({
            basePath: 'custom/journeys',
            slug:     'first-route#gpx',
            file:     {
                name:      'First-Route',
                extension: 'gpx',
            },
        })
        expect(journeySampleUrl(catalog[0], {isDevelopment: true})).toBe('/public/custom/journeys/First-Route.GPX')
        expect(journeySampleUrl({
            basePath: 'samples/journeys',
            filename: 'Mont Blanc.gpx',
        }, {isDevelopment: true})).toBe('/public/samples/journeys/Mont%20Blanc.gpx')
        expect(getLoadableJourneySamples(catalog, new Map([['first-route#gpx', {}]])).map(sample => sample.slug))
            .toEqual(['manual#kml'])
    })

    it('loads the selected sample and hides the selector when no sample remains loadable', async () => {
        globalThis.lgs = createLgs({loaded: ['sample-one#gpx']})
        mocks.loadJourneyFromFile.mockImplementation(async () => {
            globalThis.lgs.journeys.set('sample-two#gpx', {})
            return 1
        })

        render(<JourneyLoaderUI multiple/>)

        const select = screen.getByLabelText('Load a Sample')
        expect(select.getAttribute('data-placeholder')).toBe('Select')
        const loadedOption = within(select).getByRole('option', {name: 'Sample one'})
        const availableOption = within(select).getByRole('option', {name: 'Sample two'})
        expect(loadedOption.disabled).toBe(true)
        expect(loadedOption.getAttribute('title')).toBe('Already loaded sample.')
        expect(loadedOption.querySelector('[data-icon="xmark"]')).not.toBeNull()
        expect(availableOption.disabled).toBe(false)
        expect(availableOption.getAttribute('title')).toBe('Loadable sample.')
        expect(availableOption.querySelector('[data-icon="check"]')).not.toBeNull()

        fireEvent.change(select, {target: {value: 'sample-two#gpx'}})

        await waitFor(() => {
            expect(globalThis.lgs.axios.get).toHaveBeenCalledWith('/public/samples/journeys/SampleTwo.gpx')
            expect(mocks.loadJourneyFromFile).toHaveBeenCalledWith({
                name:      'SampleTwo',
                extension: 'gpx',
                content:   '<gpx />',
            }, {onError: expect.any(Function)})
        })
        await waitFor(() => expect(screen.getByLabelText('Load a Sample')).toBeTruthy())
    })

    it('keeps the sample selector visible and disables all items when every sample is loaded', () => {
        globalThis.lgs = createLgs({loaded: ['sample-one#gpx', 'sample-two#gpx']})

        render(<JourneyLoaderUI multiple/>)

        const select = screen.getByLabelText('Load a Sample')
        expect(within(select).getByRole('option', {name: 'Sample one'}).disabled).toBe(true)
        expect(within(select).getByRole('option', {name: 'Sample two'}).disabled).toBe(true)
        expect(within(select).getByRole('option', {name: 'Sample one'}).querySelector('[data-icon="xmark"]')).not.toBeNull()
        expect(within(select).getByRole('option', {name: 'Sample two'}).querySelector('[data-icon="xmark"]')).not.toBeNull()
    })

    it('shows the original import error in a copyable dialog', async () => {
        const importError = new Error('Unexpected GPX parser error')
        mocks.loadJourneyFromFile.mockImplementationOnce(async (_journey, options) => {
            options.onError(importError)
            return 0
        })
        globalThis.lgs = createLgs()

        render(<JourneyLoaderUI multiple/>)

        const file = new File(['<gpx>'], 'downloaded-track.gpx', {type: 'application/gpx+xml'})
        fireEvent.change(document.querySelector('input[type="file"]'), {target: {files: [file]}})

        await waitFor(() => {
            expect(screen.getByText('The file "downloaded-track.gpx" could not be imported.')).toBeTruthy()
            expect(screen.queryByRole('button', {name: 'Copy error'})).toBeNull()
            fireEvent.click(screen.getByText('Complete diagnostic report'))
            expect(screen.getByText(/Unexpected GPX parser error/)).not.toBeNull()
            expect(screen.getByRole('button', {name: 'Copy error'}).getAttribute('data-copy-from')).toBe('journey-import-error-details')
        })
    })

    it('shows format validation errors in the diagnostic dialog', async () => {
        globalThis.lgs = createLgs()

        render(<JourneyLoaderUI multiple/>)

        const file = new File(['<gpx>'], 'downloaded-track.gpx.xml', {type: 'application/gpx+xml'})
        fireEvent.change(document.querySelector('input[type="file"]'), {target: {files: [file]}})

        await waitFor(() => {
            expect(screen.getByText('The file "downloaded-track.gpx.xml" could not be imported.')).toBeTruthy()
        })

        fireEvent.click(screen.getByText('Complete diagnostic report'))
        expect(screen.getByText(/Format not supported/)).not.toBeNull()
    })

    it('keeps the multi-file picker on Android browsers', () => {
        const originalUserAgent = navigator.userAgent

        Object.defineProperty(navigator, 'userAgent', {
            configurable: true,
            value:        'Mozilla/5.0 (Linux; Android 10; Mobile)',
        })

        try {
            globalThis.lgs = createLgs()
            render(<JourneyLoaderUI multiple/>)

            expect(document.querySelector('input[type="file"]').multiple).toBe(true)
        }
        finally {
            Object.defineProperty(navigator, 'userAgent', {
                configurable: true,
                value:        originalUserAgent,
            })
        }
    })

})
