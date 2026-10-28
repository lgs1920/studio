/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: video-recording-settings-toolbar.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import {Children, cloneElement} from 'react'

vi.mock('@Components/LGSPopup', () => ({
    LGSPopup: ({active, children, placement}) => active ? <div data-testid="settings-popup" data-placement={placement}>{children}</div> : null,
}))

vi.mock('@Components/ToolsUI/cropper/widgets/CropRatioEditorToolbar', () => ({
    CropRatioEditorToolbar: ({mainTheme, unifiedChoices}) => <div data-testid="ratio-popup-content" data-main-theme={mainTheme} data-unified-choices={unifiedChoices}>Ratio choices</div>,
}))

vi.mock('@Components/MainUI/video/toolbox/VideoPresetToolbar', () => ({
    VideoPresetToolbar: ({compactBasic, inlineCustom, mainTheme}) => <div data-testid="preset-popup-content" data-compact-basic={compactBasic} data-inline-custom={inlineCustom} data-main-theme={mainTheme}>Preset, FPS and quality choices</div>,
}))

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name, variant, id}) => <span id={id} data-icon={name} data-variant={variant}/>,
    WaColorPicker: ({id, value, onInput, disabled, 'aria-label': ariaLabel}) => (
        <input id={id} aria-label={ariaLabel} value={value} onInput={onInput} disabled={disabled} readOnly/>
    ),
    WaSelect: ({children, className, value, onChange, label, 'label-at-start': labelAtStart}) => {
        const items = Children.toArray(children)
        const startItems = items.filter(item => item.props?.slot === 'start')
        const options = items.filter(item => item.props?.value !== undefined)

        return (
            <div className={className} data-label-at-start={labelAtStart ? 'true' : undefined}>
                {startItems}
                <select aria-label={label} value={value} onChange={onChange}>{options}</select>
            </div>
        )
    },
    WaOption: ({children, value}) => {
        const items = Children.toArray(children)
        const icon = items.find(item => item.props?.name)
        return (
            <option value={value} data-icon={icon?.props.name} data-variant={icon?.props.variant}>
                {items.filter(item => typeof item === 'string').join('')}
            </option>
        )
    },
    WaRadioGroup: ({children, value, onChange, label, className}) => (
        <div role="radiogroup" aria-label={label} className={className}>
            {children.map(child => cloneElement(child, {checked: child.props.value === value, onChange}))}
        </div>
    ),
    WaRadio: ({children, id, value, checked, onChange, 'aria-label': ariaLabel}) => (
        <label id={id}>
            <input type="radio" aria-label={ariaLabel} checked={checked}
                   onChange={() => onChange({currentTarget: {value}})}/>
            {children}
        </label>
    ),
    WaSwitch: ({children, checked, className, onChange, 'label-at-start': labelAtStart, 'width-auto': widthAuto}) => (
        <label className={className}
               data-label-at-start={labelAtStart ? 'true' : undefined}
               data-width-auto={widthAuto ? 'true' : undefined}>
            <input type="checkbox" checked={checked} onChange={onChange}/>
            {children}
        </label>
    ),
    WaNumberInput: ({className, value, label, min, max, step, onInput, 'aria-label': ariaLabel, 'label-at-start': labelAtStart, 'width-auto': widthAuto}) => (
        <input type="number" className={className} aria-label={ariaLabel ?? label} value={value} min={min} max={max} step={step}
               data-label-at-start={labelAtStart ? 'true' : undefined}
               data-width-auto={widthAuto ? 'true' : undefined}
               onInput={onInput}/>
    ),
    WaTooltip: ({children, for: targetId}) => <span data-tooltip-for={targetId}>{children}</span>,
}))

vi.mock('@Components/MainUI/video/videoEditingCleanup', () => ({
    cancelVideoEditing: vi.fn(),
    prepareVideoCaptureUi: vi.fn(),
    prepareVideoEditingUi: vi.fn(),
}))

import {
    cancelVideoEditing,
    prepareVideoCaptureUi,
    prepareVideoEditingUi,
} from '@Components/MainUI/video/videoEditingCleanup'
import { VideoSettingsInfo } from '@Components/MainUI/video/VideoSettingsInfo'
import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'

describe('VideoRecordingSettingsToolbar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        globalThis.__ = {
            ui: {
                drawerManager: {
                    close: vi.fn(),
                    isCurrent: vi.fn(() => false),
                    open: vi.fn(),
                    toggle: vi.fn(),
                },
                cameraManager: {stopRotate: vi.fn(async () => {})},
                replay: {
                    prepareReplayCamera: vi.fn(async () => true),
                },
                widgetManager: {
                    windowResizing: false,
                    getElementById: vi.fn(() => document.createElement('div')),
                    syncCropDimensionsFromElement: vi.fn(async () => null),
                    toCenter: vi.fn(),
                },
            },
            mediaCapture: {},
        }

        globalThis.lgs = {
            theJourney: {slug: 'journey-a'},
            configuration: {
                videoFormats: [
                    {label: '16:9', value: '16x9', description: 'Landscape'},
                    {label: '4:5', value: '4x5', description: 'Portrait'},
                ],
            },
            settings: {
                ui: {
                    video: proxy({fps: 0, quality: 1, ratio: '16x9'}),
                    replay: proxy({basic: {duration: 15}}),
                },
            },
            stores: {
                ui: proxy({
                    video: proxy({
                        editing: true,
                        recording: false,
                        preRecording: false,
                        dryRunSelection: null,
                        snapshot: false,
                        finalizing: false,
                        fps: 0,
                        quality: 1,
                        ratio: '16x9',
                        cropper: proxy({}),
                    }),
                }),
                replay: proxy({
                    recordingSync: false,
                    basicPreparationActive: false,
                    active: false,
                    playing: false,
                    paused: false,
                    duration: 60,
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        vi.useRealTimers()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps the current ratio and video values visible in one horizontal HUD', () => {
        render(<VideoRecordingSettingsToolbar/>)

        expect(prepareVideoEditingUi).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', {name: 'Ratio: 16:9'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'}).querySelector('[data-icon="ranking-star"]')).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Record'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Cancel'})).not.toBeNull()
        expect(screen.getByRole('toolbar', {name: 'Video recording settings'})).not.toBeNull()
    })

    it('uses the main application theme when embedded in the timeline menu', () => {
        render(<VideoRecordingSettingsToolbar mainTheme/>)

        const toolbar = document.querySelector('.video-recording-settings-toolbar')
        expect(toolbar.classList).toContain('wa-theme-lgs1920')
        expect(toolbar.classList).not.toContain('wa-theme-lgs1920-on-map')
    })

    it('renders only ratio and quality controls in the timeline drawer mode', () => {
        render(<VideoRecordingSettingsToolbar mainTheme layout="timeline-drawer" mode="video-options"/>)

        expect(screen.getByRole('button', {name: 'Ratio: 16:9'})).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Record'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Cancel'})).toBeNull()
    })

    it('keeps only the cancel action in the linked timeline toolbar', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mainTheme mode="actions"/>)

        expect(screen.queryByRole('button', {name: 'Ratio: 16:9'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'High · 30 FPS'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Create Replay video'})).toBeNull()
        expect(screen.getByRole('button', {name: 'Cancel'})).not.toBeNull()
    })

    it('opens Ratio and Quality/FPS popups at the bottom end of their triggers', () => {
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByRole('button', {name: 'Ratio: 16:9'}).querySelector('[data-icon="chevron-down"]')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'High · 30 FPS'}).querySelector('[data-icon="chevron-down"]')).not.toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Ratio: 16:9'}))
        expect(screen.getByTestId('ratio-popup-content')).not.toBeNull()
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom-end')
        expect(screen.queryByTestId('fps-popup-content')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'High · 30 FPS'}))
        expect(screen.queryByTestId('ratio-popup-content')).toBeNull()
        expect(screen.getByTestId('preset-popup-content')).not.toBeNull()
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom-end')
    })

    it('passes the main application theme to custom-menu submenus', () => {
        render(<VideoRecordingSettingsToolbar mainTheme/>)

        fireEvent.click(screen.getByRole('button', {name: 'Ratio: 16:9'}))
        expect(screen.getByTestId('ratio-popup-content').dataset.mainTheme).toBe('true')

        fireEvent.click(screen.getByRole('button', {name: 'High · 30 FPS'}))
        expect(screen.getByTestId('preset-popup-content').dataset.mainTheme).toBe('true')
        expect(document.querySelector('.video-recording-settings-popup')?.classList).toContain('wa-theme-lgs1920')
        expect(document.querySelector('.video-recording-settings-popup')?.classList).not.toContain('wa-theme-lgs1920-on-map')
    })

    it('opens the Basic Replay settings above the widget and applies its selected duration', () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByText('16:9')).not.toBeNull()
        expect(screen.getByText('High · 30 FPS')).not.toBeNull()
        expect(screen.getByText('18s')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Video Settings'}).querySelector('[data-icon="gear"]')).not.toBeNull()
        expect(document.querySelector(`[data-tooltip-for="${screen.getByRole('button', {name: 'Video Settings'}).id}"]`)?.textContent).toBe('Video Settings')
        expect(document.querySelector('[data-tooltip-for="video-start-recording"]')?.textContent).toBe('Start Record')
        expect(document.querySelector('[data-tooltip-for="video-cancel-editing"]')?.textContent).toBe('Cancel')
        expect(document.querySelector('.basic-replay-settings-summary__separator')).not.toBeNull()
        expect(document.querySelector('.basic-replay-settings-summary')?.nextElementSibling?.classList).toContain('video-recording-settings-separator')
        expect(screen.queryByRole('button', {name: 'Journey Replay Settings'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Ratio: 16:9'})).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom')
        expect(screen.getByTestId('ratio-popup-content').dataset.unifiedChoices).toBe('true')
        expect(screen.getByText('Ratio')).not.toBeNull()
        expect(screen.getByText('Quality')).not.toBeNull()
        expect(screen.getByRole('group', {name: 'Duration'})).not.toBeNull()
        expect(screen.getByRole('button', {name: '15s'}).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByTestId('preset-popup-content').dataset.inlineCustom).toBe('false')
        expect(screen.getByTestId('preset-popup-content').dataset.compactBasic).toBe('true')

        globalThis.lgs.settings.ui.replay.basic.camera = {
            altitude: 3454,
            pitch: -30,
            cameraAngle: 82,
        }
        fireEvent.click(screen.getByRole('button', {name: '20s'}))
        expect(globalThis.lgs.settings.ui.replay.basic.duration).toBe(20)
        expect(globalThis.lgs.settings.ui.replay.basic.camera).not.toHaveProperty('altitude')
        expect(globalThis.lgs.settings.ui.replay.basic.camera).not.toHaveProperty('pitch')
        expect(globalThis.lgs.settings.ui.replay.basic.camera.cameraAngle).toBe(0)
        expect(globalThis.lgs.settings.ui.replay).not.toHaveProperty('duration')
        expect(globalThis.lgs.stores.replay.duration).toBe(20)
    })

    it('includes merged POI slowdowns in the Basic video duration shown before Record', () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        globalThis.lgs.stores.replay.totalDistance = 1000
        globalThis.lgs.stores.replay.direction = 1
        globalThis.lgs.stores.replay.nearbyPois = [
            {projectedAbscissa: 500, poi: {id: 'first', type: 'poi', expanded: true, replay: {visible: true, animated: true}}},
            {projectedAbscissa: 550, poi: {id: 'second', type: 'poi', expanded: true, replay: {visible: true, animated: true}}},
        ]
        globalThis.lgs.settings.ui.replay.basic = {
            duration: 10,
            animatePoisDuringJourneyReplay: true,
            poiAnimationDurationSeconds: 2,
        }

        render(<VideoRecordingSettingsToolbar/>)

        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('17s')
    })

    it('shows themed sample levels with matching regular icons and saves the selection per Journey', async () => {
        vi.useFakeTimers()
        globalThis.lgs.stores.replay.basicPreparationActive = true
        const persistToDatabase = vi.fn()
        globalThis.lgs.theJourney.replay = {basic: {}}
        globalThis.lgs.theJourney.persistToDatabase = persistToDatabase
        globalThis.lgs.stores.main = proxy({theJourney: globalThis.lgs.theJourney})
        render(<VideoRecordingSettingsToolbar mainTheme/>)
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))

        const select = screen.getByRole('combobox', {name: 'Sampling'})
        expect(select.value).toBe('1024')
        const samplingControl = document.querySelector('.basic-replay-sampling__select')
        expect(samplingControl?.getAttribute('data-label-at-start')).toBe('true')
        expect(document.querySelector('.basic-replay-sampling-control')?.classList).toContain('half-width')
        expect(document.querySelector('.video-recording-settings-popup')?.classList).toContain('wa-theme-lgs1920')
        const preparationRow = document.querySelector('.basic-replay-settings-row--preparation')
        expect(preparationRow?.children).toHaveLength(2)
        expect(preparationRow?.children[0].classList).toContain('half-width')
        expect(preparationRow?.children[0].querySelector('.basic-replay-dry-run-switch')?.getAttribute('data-label-at-start')).toBe('true')
        expect(preparationRow?.children[0].querySelector('.basic-replay-dry-run-switch')?.getAttribute('data-width-auto')).toBe('true')
        expect(preparationRow?.children[0].querySelector('.basic-replay-dry-run-switch')?.textContent).toContain('\u00a0')
        expect(preparationRow?.classList).not.toContain('basic-replay-settings-row--label-and-controls')
        for (const label of ['Aspect ratio', 'Duration']) {
            const settingsRow = document.querySelector(`.video-recording-settings-popup [role="group"][aria-label="${label}"]`)
            expect(settingsRow?.classList).toContain('basic-replay-settings-row--label-and-controls')
            expect(settingsRow?.classList).not.toContain('half-width')
        }
        const presetRow = document.querySelector('.video-recording-settings-popup [role="group"][aria-label="Video quality"]')
        if (presetRow) {
            expect(presetRow.classList).toContain('basic-replay-settings-row--label-and-controls')
            expect(presetRow.classList).not.toContain('half-width')
        }
        expect(document.querySelector('.basic-replay-sampling__select > [data-icon]')?.getAttribute('data-icon')).toBe('square-b')
        expect(document.querySelector('[data-tooltip-for="basic-replay-sampling-selected-icon"]')?.textContent).toBe('1024 pts')
        const toolbarSamplingTarget = document.querySelector('.basic-replay-settings-summary__sampling-target')
        expect(toolbarSamplingTarget?.getAttribute('id')).toBeTruthy()
        expect(toolbarSamplingTarget?.getAttribute('aria-label')).toBe('Sampling: Basic')
        expect(toolbarSamplingTarget?.querySelector('[data-icon="square-b"]')).not.toBeNull()
        expect(document.querySelector(`[data-tooltip-for="${toolbarSamplingTarget?.getAttribute('id')}"]`)?.textContent).toBe('Basic')
        for (const [value, icon] of [['512', 'square-l'], ['1024', 'square-b'], ['2048', 'square-m'], ['4096', 'square-h']]) {
            const option = select.querySelector(`option[value="${value}"]`)
            expect(option?.getAttribute('data-icon')).toBe(icon)
            expect(option?.getAttribute('data-variant')).toBe('regular')
            expect(document.querySelector(`[data-tooltip-for="basic-replay-sampling-option-${value}"]`)?.textContent).toBe(`${value} pts`)
        }
        expect(select.querySelector('option[value="512"]')?.textContent).toBe('Low')
        expect(select.querySelector('option[value="1024"]')?.textContent).toBe('Basic')
        expect(select.querySelector('option[value="2048"]')?.textContent).toBe('Medium')
        expect(select.querySelector('option[value="4096"]')?.textContent).toBe('High')

        await act(async () => fireEvent.change(select, {target: {value: '512'}}))
        expect(globalThis.lgs.settings.ui.replay.basic.sampleCount).toBe(512)
        expect(globalThis.lgs.theJourney.replay.basic.sampleCount).toBe(512)
        expect(document.querySelector('.basic-replay-sampling__select > [data-icon]')?.getAttribute('data-icon')).toBe('square-l')
        const lowToolbarTarget = document.querySelector('.basic-replay-settings-summary__sampling-target')
        expect(lowToolbarTarget?.getAttribute('aria-label')).toBe('Sampling: Low')
        expect(document.querySelector(`[data-tooltip-for="${lowToolbarTarget?.getAttribute('id')}"]`)?.textContent).toBe('Low')

        await act(async () => fireEvent.change(select, {target: {value: '2048'}}))
        const mediumToolbarTarget = document.querySelector('.basic-replay-settings-summary__sampling-target')
        expect(mediumToolbarTarget?.getAttribute('aria-label')).toBe('Sampling: Medium')
        expect(mediumToolbarTarget?.querySelector('[data-icon="square-m"]')).not.toBeNull()
        expect(document.querySelector(`[data-tooltip-for="${mediumToolbarTarget?.getAttribute('id')}"]`)?.textContent).toBe('Medium')

        await act(async () => fireEvent.change(select, {target: {value: '4096'}}))

        expect(globalThis.lgs.settings.ui.replay.basic.sampleCount).toBe(4096)
        expect(globalThis.lgs.theJourney.replay.basic.sampleCount).toBe(4096)
        expect(select.value).toBe('4096')
        expect(document.querySelector('.basic-replay-sampling__select > [data-icon]')?.getAttribute('data-icon')).toBe('square-h')
        expect(document.querySelector('[data-tooltip-for="basic-replay-sampling-selected-icon"]')?.textContent).toBe('4096 pts')
        const updatedToolbarSamplingTarget = document.querySelector('.basic-replay-settings-summary__sampling-target')
        expect(updatedToolbarSamplingTarget?.getAttribute('aria-label')).toBe('Sampling: High')
        expect(updatedToolbarSamplingTarget?.querySelector('[data-icon="square-h"]')).not.toBeNull()
        expect(document.querySelector(`[data-tooltip-for="${updatedToolbarSamplingTarget?.getAttribute('id')}"]`)?.textContent).toBe('High')
        expect(persistToDatabase).not.toHaveBeenCalled()
        await act(async () => vi.advanceTimersByTime(250))
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('selects 45-second and one-minute durations for Basic playback and recording', async () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        render(<VideoRecordingSettingsToolbar/>)
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))
        for (const [label, duration] of [['45s', 45], ['1 min', 60]]) {
            await act(async () => fireEvent.click(screen.getByRole('button', {name: label})))
            expect(globalThis.lgs.settings.ui.replay.basic.duration).toBe(duration)
            expect(globalThis.lgs.stores.replay.duration).toBe(duration)
            expect(screen.getByRole('button', {name: label}).getAttribute('aria-pressed')).toBe('true')
            if (duration === 60) {
                expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('1 min 3s')
            }
        }
    })

    it('selects and updates a Journey duration without changing global Replay duration', async () => {
        vi.useFakeTimers()
        globalThis.lgs.stores.replay.basicPreparationActive = true
        globalThis.lgs.settings.ui.replay.duration = 60
        globalThis.lgs.settings.ui.replay.basic.duration = 15
        const persistToDatabase = vi.fn()
        globalThis.lgs.theJourney.replay = {basic: {duration: 30}}
        globalThis.lgs.theJourney.persistToDatabase = persistToDatabase
        globalThis.lgs.stores.main = proxy({theJourney: globalThis.lgs.theJourney})
        render(<VideoRecordingSettingsToolbar/>)
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))

        expect(screen.getByRole('button', {name: '30s'}).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByRole('button', {name: '15s'}).getAttribute('aria-pressed')).toBe('false')
        await act(async () => fireEvent.click(screen.getByRole('button', {name: '45s'})))

        expect(globalThis.lgs.theJourney.replay.basic.duration).toBe(45)
        expect(globalThis.lgs.settings.ui.replay.basic.duration).toBe(15)
        expect(globalThis.lgs.settings.ui.replay.duration).toBe(60)
        expect(globalThis.lgs.stores.replay.duration).toBe(45)
        expect(screen.getByRole('button', {name: '45s'}).getAttribute('aria-pressed')).toBe('true')
        expect(screen.getByRole('button', {name: '30s'}).getAttribute('aria-pressed')).toBe('false')

        await act(async () => vi.advanceTimersByTime(250))
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('shows equal-size appearance choices without pixel or color labels and persists them', async () => {
        vi.useFakeTimers()
        globalThis.lgs.stores.replay.basicPreparationActive = true
        globalThis.lgs.theJourney.persistToDatabase = vi.fn()
        globalThis.__.ui.replay.refresh = vi.fn()
        render(<VideoRecordingSettingsToolbar/>)
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))
        expect(screen.queryByText('Border')).toBeNull()
        expect(screen.queryByText('Fill')).toBeNull()
        expect(screen.queryByText(/\d+(?:\.\d+)?\s*px/i)).toBeNull()
        const appearance = document.querySelector('.basic-replay-appearance')
        expect(appearance.children[0].getAttribute('data-icon')).toBe('paintbrush')
        expect(appearance.children[1].classList).toContain('basic-replay-appearance__colors')
        expect(appearance.children[2].classList).toContain('basic-replay-appearance__border-mode')
        expect(appearance.children[3].classList).toContain('basic-replay-appearance__reset')
        expect(appearance.querySelectorAll('[title]')).toHaveLength(0)
        for (const [targetId, text] of [
            ['basic-replay-border-color', 'Border color'],
            ['basic-replay-fill-color', 'Fill color'],
            ['basic-replay-with-border', 'With border'],
            ['basic-replay-without-border', 'No border'],
            ['basic-replay-appearance-reset', 'Reset'],
            ['basic-replay-size-thin', 'Thin'],
            ['basic-replay-size-small', 'Small'],
            ['basic-replay-size-medium', 'Medium'],
            ['basic-replay-size-large', 'Large'],
        ]) {
            expect(document.querySelector(`[data-tooltip-for="${targetId}"]`)?.textContent).toBe(text)
        }
        const borderMarkers = appearance.querySelectorAll('.basic-replay-appearance__border-mode .basic-replay-appearance__marker circle')
        expect(borderMarkers).toHaveLength(2)
        expect(borderMarkers[0].getAttribute('r')).toBe('8')
        expect(borderMarkers[0].getAttribute('stroke-width')).toBe('2')
        expect(borderMarkers[1].getAttribute('r')).toBe('7')
        expect(Number(borderMarkers[1].getAttribute('r'))).toBe(
            Number(borderMarkers[0].getAttribute('r')) - Number(borderMarkers[0].getAttribute('stroke-width')) / 2,
        )
        expect(appearance.querySelectorAll('.basic-replay-appearance__border-mode .basic-replay-appearance__marker path')).toHaveLength(0)
        const baselineRadius = Number(document.querySelector('.basic-replay-appearance__preview circle').getAttribute('r'))
        await act(async () => fireEvent.input(screen.getByLabelText('Replay fill color'), {target: {value: '#008000'}}))
        await act(async () => fireEvent.input(screen.getByLabelText('Replay border color'), {target: {value: '#0000ff'}}))
        for (const circle of document.querySelectorAll('.basic-replay-appearance__preview circle')) {
            expect(circle.getAttribute('fill')).toBe('#008000')
            expect(circle.getAttribute('stroke')).toBe('#0000ff')
        }
        const borderColorPicker = screen.getByLabelText('Replay border color')
        const withBorder = screen.getByRole('radio', {name: 'Trace with border'})
        const withoutBorder = screen.getByRole('radio', {name: 'Trace without border'})
        expect(withBorder.checked).toBe(true)
        await act(async () => fireEvent.click(withoutBorder))
        expect(withoutBorder.checked).toBe(true)
        expect(borderColorPicker.disabled).toBe(true)
        expect(globalThis.lgs.stores.replay.progression.border.opacity).toBe(0)
        for (const preview of document.querySelectorAll('.basic-replay-appearance__preview')) {
            expect(preview.querySelectorAll('line')).toHaveLength(1)
            expect(preview.querySelector('circle').getAttribute('stroke')).toBe('none')
        }
        await act(async () => fireEvent.click(withBorder))
        expect(borderColorPicker.disabled).toBe(false)
        expect(globalThis.lgs.stores.replay.progression.border.opacity).toBeGreaterThan(0)
        for (const [scale, sizeLabel, traceWidth, markerRadius] of [
            [0.65, 'thin', 1.95, 4],
            [1.5, 'medium', 4.5, 6],
            [2.3, 'large', 6.9, 9.2],
            [1, 'small', 3, 4],
        ]) {
            const radio = screen.getByRole('radio', {name: `Replay size ${sizeLabel}`})
            await act(async () => fireEvent.click(radio))
            expect(radio.checked).toBe(true)
            expect(globalThis.lgs.stores.replay.progression.sizeScale).toBe(scale)
            expect(globalThis.lgs.stores.replay.progression.markerSizeScale).toBe(scale === 0.65 ? 1 : scale)
            const preview = radio.parentElement.querySelector('svg')
            expect(preview.getAttribute('width')).toBe('36')
            expect(preview.getAttribute('height')).toBe('24')
            expect(preview.getAttribute('viewBox')).toBe('0 0 36 24')
            expect(Number(preview.querySelectorAll('line')[1].getAttribute('stroke-width'))).toBeCloseTo(traceWidth)
            expect(Number(preview.querySelector('circle').getAttribute('r'))).toBeCloseTo(markerRadius)
        }
        expect(Number(document.querySelector('.basic-replay-appearance__preview circle').getAttribute('r'))).toBe(baselineRadius)

        await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Reset Replay appearance to defaults'})))
        expect(screen.getByLabelText('Replay fill color').value).toBe('#ff6a00')
        expect(screen.getByLabelText('Replay border color').value).toBe('#ffffff')
        expect(globalThis.lgs.stores.replay.progression.sizeScale).toBe(1)
        expect(globalThis.lgs.stores.replay.progression.markerSizeScale).toBe(1)
        expect(globalThis.lgs.theJourney.replay.basic.presentation).toMatchObject({
            sizeScale: 1, markerSizeScale: 1, borderEnabled: true,
            fillColor: '#ff6a00', borderColor: '#ffffff',
        })
        expect(globalThis.__.ui.replay.refresh).toHaveBeenCalledWith({camera: false})
        await act(async () => vi.advanceTimersByTime(250))
        expect(globalThis.lgs.theJourney.persistToDatabase).toHaveBeenCalledTimes(1)
    })

    it('persists Basic Replay Dry run and hides quality choices without changing video preferences', async () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        render(<><VideoRecordingSettingsToolbar/><VideoSettingsInfo/></>)

        expect(screen.getByText('High · 30 FPS')).not.toBeNull()
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))
        expect(screen.getByText('Quality')).not.toBeNull()

        await act(async () => {
            fireEvent.click(screen.getByRole('checkbox', {name: 'Dry run'}))
            await Promise.resolve()
        })

        expect(globalThis.lgs.settings.ui.replay.basic.dryRun).toBe(true)
        expect(globalThis.lgs.settings.ui.video).toMatchObject({fps: 0, quality: 1})
        await vi.waitFor(() => {
            expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('Dry run')
            expect(document.querySelector('.video-settings-info')?.textContent).toContain('Mode : Dry run')
        })
        expect(screen.getByTestId('settings-popup')).not.toBeNull()
        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).not.toContain('FPS')
        expect(document.querySelector('.basic-replay-settings-summary [data-icon="bolt"]')?.getAttribute('data-variant')).toBe('regular')
        expect(document.querySelector('.basic-replay-settings-row--preparation [data-icon="bolt"]')?.getAttribute('data-variant')).toBe('regular')
        expect(document.querySelector('[aria-label="Video quality"]')).toBeNull()
        expect(screen.queryByTestId('preset-popup-content')).toBeNull()
        expect(screen.getAllByText('Dry run')).not.toHaveLength(0)
        expect(screen.getByRole('button', {name: 'Run Dry run'})).not.toBeNull()
    })

    it('configures an optional Basic Replay end focus and persists its 1-to-5-second duration', async () => {
        vi.useFakeTimers()
        globalThis.lgs.stores.replay.basicPreparationActive = true
        __.ui.replay.refresh = vi.fn()
        const persistToDatabase = vi.fn()
        globalThis.lgs.theJourney.replay = {basic: {}}
        globalThis.lgs.theJourney.persistToDatabase = persistToDatabase
        globalThis.lgs.stores.main = proxy({theJourney: globalThis.lgs.theJourney})
        render(<VideoRecordingSettingsToolbar/>)
        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))

        const focusSwitch = screen.getByRole('checkbox', {name: 'End Focus'})
        const durationInput = screen.getByRole('spinbutton', {name: 'Duration (s)'})
        const focusControls = document.querySelector('.basic-replay-end-focus-controls')
        expect(focusSwitch.checked).toBe(true)
        expect(durationInput.value).toBe('3')
        expect(durationInput.min).toBe('1')
        expect(durationInput.max).toBe('5')
        expect(durationInput.dataset.labelAtStart).toBe('true')
        expect(durationInput.parentElement).toBe(focusControls)
        expect(focusSwitch.closest('.basic-replay-end-focus-controls')).toBe(focusControls)
        expect(durationInput.classList).toContain('lgs--short-input')
        expect(durationInput.closest('.basic-replay-end-focus-row')).not.toBeNull()
        expect(screen.getByRole('spinbutton', {name: 'Duration (s)'})).toBe(durationInput)
        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('18s')

        await act(async () => fireEvent.input(durationInput, {target: {value: '5'}}))
        expect(globalThis.lgs.settings.ui.replay.basic.endFocus).toEqual({enabled: true, duration: 5})
        expect(globalThis.lgs.theJourney.replay.basic.endFocus).toEqual({enabled: true, duration: 5})
        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('20s')

        await act(async () => fireEvent.click(focusSwitch))
        expect(globalThis.lgs.settings.ui.replay.basic.endFocus.enabled).toBe(false)
        expect(globalThis.lgs.theJourney.replay.basic.endFocus.enabled).toBe(false)
        expect(screen.queryByRole('spinbutton', {name: 'Duration (s)'})).toBeNull()
        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('15s')
        expect(globalThis.__.ui.replay.refresh).toHaveBeenCalledWith({camera: false})

        await act(async () => fireEvent.click(focusSwitch))
        const restoredDurationInput = screen.getByRole('spinbutton', {name: 'Duration (s)'})
        expect(restoredDurationInput.value).toBe('5')
        expect(globalThis.lgs.settings.ui.replay.basic.endFocus.enabled).toBe(true)
        expect(globalThis.lgs.theJourney.replay.basic.endFocus.enabled).toBe(true)
        expect(document.querySelector('.basic-replay-settings-summary')?.textContent).toContain('20s')
        await act(async () => vi.advanceTimersByTime(250))
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('starts Basic Replay Dry run without requiring the media recorder', async () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        globalThis.lgs.settings.ui.replay.basic.dryRun = true
        delete globalThis.__.mediaCapture
        render(<VideoRecordingSettingsToolbar/>)

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Run Dry run'}))
        })

        await vi.waitFor(() => expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true))
        expect(globalThis.lgs.stores.ui.video.dryRun).toBe(true)
        expect(globalThis.lgs.stores.ui.video).toMatchObject({fps: 0, quality: 1})
        expect(prepareVideoCaptureUi).toHaveBeenCalledOnce()
    })

    it('uses the Basic Replay gear popup for the Expert timeline without duration', () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mainTheme mode="actions" timelineSettings/>)

        const summary = document.querySelector('.basic-replay-settings-summary')
        expect(summary.querySelector('button')?.getAttribute('aria-label')).toBe('Video Settings')
        expect(screen.getByText('16:9')).not.toBeNull()
        expect(screen.getByText('High · 30 FPS')).not.toBeNull()
        expect(screen.getByRole('button', {name: 'Video Settings'}).querySelector('[data-icon="gear"]')).not.toBeNull()
        expect(document.querySelector('[data-tooltip-for="open-replay-settings-from-timeline"]')?.textContent).toBe('Replay Settings')
        expect(document.querySelector('.basic-replay-settings-summary__separator')).not.toBeNull()
        expect(document.querySelector('.basic-replay-settings-summary')?.nextElementSibling?.classList).toContain('video-recording-settings-separator')
        const replaySettingsButton = screen.getByRole('button', {name: 'Replay Settings'})
        expect(replaySettingsButton.hasAttribute('title')).toBe(false)
        expect(screen.getByRole('button', {name: 'Record'})).not.toBeNull()
        expect(document.querySelector('[data-tooltip-for="video-start-recording"]')?.textContent).toBe('Start Record')
        expect(document.querySelector('[data-tooltip-for="video-cancel-editing"]')?.textContent).toBe('Cancel')
        expect(screen.queryByText('15s')).toBeNull()
        expect(screen.queryByText('Duration')).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Replay Settings'}))
        expect(globalThis.__.ui.drawerManager.toggle).toHaveBeenCalledWith('replay-drawer')

        fireEvent.click(screen.getByRole('button', {name: 'Video Settings'}))
        expect(screen.getByTestId('settings-popup').dataset.placement).toBe('bottom')
        expect(screen.getByTestId('ratio-popup-content').dataset.unifiedChoices).toBe('true')
        expect(screen.getByTestId('preset-popup-content').dataset.compactBasic).toBe('true')
        expect(screen.queryByText('Duration')).toBeNull()
    })

    it('waits for map rotation to stop before preparing a recording', async () => {
        lgs.stores.replay.basicPreparationActive = true
        let finishRotation
        __.ui.cameraManager.stopRotate.mockImplementation(() => new Promise(resolve => { finishRotation = resolve }))
        render(<VideoRecordingSettingsToolbar/>)
        fireEvent.click(screen.getByRole('button', {name: 'Record'}))
        await vi.waitFor(() => expect(__.ui.cameraManager.stopRotate).toHaveBeenCalledOnce())
        expect(__.ui.replay.prepareReplayCamera).not.toHaveBeenCalled()
        expect(lgs.stores.ui.video.preRecording).toBe(false)
        finishRotation()
        await vi.waitFor(() => expect(lgs.stores.ui.video.preRecording).toBe(true))
    })

    it('stops map rotation before preparing and entering Basic pre-recording', async () => {
        globalThis.lgs.stores.replay.basicPreparationActive = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.getByRole('button', {name: 'Record'})).not.toBeNull()
        expect(screen.queryByRole('button', {name: 'Create Replay video'})).toBeNull()

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        await vi.waitFor(() => expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true))
        expect(globalThis.lgs.stores.ui.video.editing).toBe(false)
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
        expect(__.ui.cameraManager.stopRotate).toHaveBeenCalledOnce()
        expect(__.ui.cameraManager.stopRotate.mock.invocationCallOrder[0]).toBeLessThan(__.ui.replay.prepareReplayCamera.mock.invocationCallOrder[0])
        expect(globalThis.__.ui.replay.prepareReplayCamera).toHaveBeenCalledWith({
            journey: globalThis.lgs.theJourney,
        })
    })

    it('exposes the same video launch action during the Expert timeline', async () => {
        globalThis.lgs.stores.replay.recordingSync = true
        render(<VideoRecordingSettingsToolbar mode="actions" timelineSettings/>)

        fireEvent.click(screen.getByRole('button', {name: 'Record'}))

        await vi.waitFor(() => expect(globalThis.lgs.stores.ui.video.preRecording).toBe(true))
        expect(prepareVideoCaptureUi).toHaveBeenCalledTimes(1)
    })

    it('disables video recording while linked interactive Replay is active or paused', async () => {
        globalThis.lgs.stores.replay.recordingSync = true
        globalThis.lgs.stores.replay.active = true
        globalThis.lgs.stores.replay.paused = true
        render(<VideoRecordingSettingsToolbar mode="actions" timelineSettings/>)

        const recordButton = screen.getByRole('button', {name: 'Record'})
        expect(recordButton.disabled).toBe(true)
        fireEvent.click(recordButton)
        expect(globalThis.__.ui.replay.prepareReplayCamera).not.toHaveBeenCalled()
        expect(prepareVideoCaptureUi).not.toHaveBeenCalled()
        expect(globalThis.lgs.stores.ui.video.preRecording).toBe(false)

        act(() => {
            globalThis.lgs.stores.replay.active = false
            globalThis.lgs.stores.replay.paused = false
        })
        await vi.waitFor(() => expect(recordButton.disabled).toBe(false))
    })

    it('waits for crop persistence before cancelling video setup', async () => {
        let resolveCropSync = null
        globalThis.__.ui.widgetManager.syncCropDimensionsFromElement = vi.fn(() => new Promise(resolve => {
            resolveCropSync = resolve
        }))
        render(<VideoRecordingSettingsToolbar/>)

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
        expect(cancelVideoEditing).not.toHaveBeenCalled()

        resolveCropSync()
        await vi.waitFor(() => expect(cancelVideoEditing).toHaveBeenCalledTimes(1))
    })

    it('hides the HUD while video finalization is active', () => {
        globalThis.lgs.stores.ui.video.finalizing = true
        render(<VideoRecordingSettingsToolbar/>)

        expect(screen.queryByRole('toolbar', {name: 'Video recording settings'})).toBeNull()
        expect(prepareVideoEditingUi).not.toHaveBeenCalled()
    })
})
