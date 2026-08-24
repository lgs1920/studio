import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => {
    const Stub = ({children, ...props}) => <div {...props}>{children}</div>
    return new Proxy({default: Stub}, {
        get: () => Stub,
    })
})

vi.mock('@Components/MainUI/compass/Compass', () => ({
    Compass: () => <div data-testid="compass"/>,
}))
vi.mock('@Components/FullScreenButton/FullScreenButton', () => ({
    FullScreenButton: () => <div data-testid="fullscreen-button"/>,
}))
vi.mock('@Components/MainUI/context-menu/ContextMenuRenderer', () => ({
    ContextMenuRenderer: () => <div data-testid="context-menu-renderer"/>,
}))
vi.mock('@Components/MainUI/context-menu/MapPointContextMenuTrigger', () => ({
    MapPointContextMenuTrigger: () => <div data-testid="map-point-context-menu-trigger"/>,
}))
vi.mock('@Components/MainUI/geocoding/GeocodingButton', () => ({
    GeocodingButton: () => <div data-testid="geocoding-button"/>,
}))
vi.mock('@Components/MainUI/geocoding/GeocodingWidget', () => ({
    GeocodingWidget: () => <div data-testid="geocoding-widget"/>,
}))
vi.mock('@Components/MainUI/MapPOI/MapPOIMonitor', () => ({
    MapPOIMonitor: () => <div data-testid="map-poi-monitor"/>,
}))
vi.mock('@Components/MainUI/PanoramaWidget', () => ({
    PanoramaWidget: () => <div data-testid="panorama-widget"/>,
}))
vi.mock('@Components/MainUI/OrbitWidget', () => ({
    OrbitWidget: () => <div data-testid="orbit-widget"/>,
}))
vi.mock('@Components/MainUI/OrbitButton', () => ({
    OrbitButton: () => <div data-testid="orbit-button"/>,
}))
vi.mock('@Editor/EditorPanelButton', () => ({
    EditorPanelButton: () => <div data-testid="editor-panel-button"/>,
}))
vi.mock('@Components/MainUI/video/VideoButton', () => ({
    VideoButton: () => <div data-testid="video-button"/>,
}))
vi.mock('@Components/MainUI/video/VideoDownloadAndShareDialog', () => ({
    VideoDownloadAndShareDialog: () => <div data-testid="video-share-dialog"/>,
}))
vi.mock('@Components/MainUI/video/ReplayRecordingMonitorWidget', () => ({
    ReplayRecordingMonitorWidget: () => <div data-testid="replay-controls"/>,
}))
vi.mock('@Components/MainUI/SyncLinkBadge', () => ({
    SyncLinkBadge: () => <div data-testid="sync-link-badge"/>,
}))
vi.mock('@Components/Text/TextButton', () => ({
    TextButton: () => <div data-testid="text-button"/>,
}))
vi.mock('@Components/TracksEditor/TracksEditor', () => ({
    TracksEditor: () => <div data-testid="tracks-editor"/>,
}))
vi.mock('@Editor/groups/JourneyGroupsDrawer', () => ({
    JourneyGroupsDrawer: () => <div data-testid="journey-groups-drawer"/>,
}))
vi.mock('@Components/JourneyReplay/JourneyReplayButton', () => ({
    JourneyReplayButton: () => <div data-testid="replay-launch-button"/>,
}))
vi.mock('@Components/JourneyReplay/JourneyReplayDrawer', () => ({
    JourneyReplayDrawer: () => <div data-testid="replay-drawer"/>,
}))
vi.mock('../FileLoader/JourneyLoaderUI', () => ({
    JourneyLoaderUI: () => <div data-testid="journey-loader"/>,
}))
vi.mock('../InformationPanel/Panel', () => ({
    Panel: () => <div data-testid="information-panel"/>,
}))
vi.mock('../InformationPanel/PanelButton', () => ({
    PanelButton: () => <div data-testid="information-button"/>,
}))
vi.mock('../Settings/layers/Panel', () => ({
    Panel: () => <div data-testid="layers-panel"/>,
}))
vi.mock('../Settings/layers/PanelButton', () => ({
    PanelButton: () => <div data-testid="layers-button"/>,
}))
vi.mock('../Settings/Panel', () => ({
    Panel: () => <div data-testid="settings-panel"/>,
}))
vi.mock('../Settings/PanelButton', () => ({
    PanelButton: () => <div data-testid="settings-button"/>,
}))
vi.mock('./CallForActions', () => ({
    CallForActions: () => <div data-testid="call-for-actions"/>,
}))
vi.mock('./CameraTarget', () => ({
    CameraTarget: () => <div data-testid="camera-target"/>,
}))
vi.mock('./credits/CreditsBar', () => ({
    CreditsBar: () => <div data-testid="credits-bar"/>,
}))
vi.mock('./MapPOI/Panel', () => ({
    Panel: () => <div data-testid="map-poi-edit-panel"/>,
}))
vi.mock('./MapPOI/PanelButton', () => ({
    PanelButton: () => <div data-testid="poi-edit-button"/>,
}))
vi.mock('./SceneModeSelector', () => ({
    SceneModeSelector: () => <div data-testid="scene-mode-selector"/>,
}))
vi.mock('./SupportUI', () => ({
    SupportUI: () => <div data-testid="support-ui"/>,
}))
vi.mock('./SupportUIButton', () => ({
    SupportUIButton: () => <div data-testid="support-button"/>,
}))
vi.mock('./widgets/management/WidgetManagementDrawer', () => ({
    WidgetManagementDrawer: () => <div data-testid="widget-management-drawer"/>,
}))
vi.mock('./widgets/editor/WidgetEditorPanel', () => ({
    WidgetEditorPanel: () => <div data-testid="widget-editor-panel"/>,
}))
vi.mock('@Components/FileLoader/JourneyLoaderUI', () => ({
    JourneyLoaderUI: () => <div data-testid="journey-loader"/>,
}))
vi.mock('@Components/InformationPanel/Panel', () => ({
    Panel: () => <div data-testid="information-panel"/>,
}))
vi.mock('@Components/InformationPanel/PanelButton', () => ({
    PanelButton: () => <div data-testid="information-button"/>,
}))
vi.mock('@Components/Settings/layers/Panel', () => ({
    Panel: () => <div data-testid="layers-panel"/>,
}))
vi.mock('@Components/Settings/layers/PanelButton', () => ({
    PanelButton: () => <div data-testid="layers-button"/>,
}))
vi.mock('@Components/Settings/Panel', () => ({
    Panel: () => <div data-testid="settings-panel"/>,
}))
vi.mock('@Components/Settings/PanelButton', () => ({
    PanelButton: () => <div data-testid="settings-button"/>,
}))
vi.mock('@Components/MainUI/MapPOI/Panel', () => ({
    Panel: () => <div data-testid="map-poi-edit-panel"/>,
}))
vi.mock('@Components/MainUI/MapPOI/PanelButton', () => ({
    PanelButton: () => <div data-testid="poi-edit-button"/>,
}))
vi.mock('@Components/MainUI/widgets/editor/WidgetEditorPanel', () => ({
    WidgetEditorPanel: () => <div data-testid="widget-editor-panel"/>,
}))
vi.mock('@Components/MainUI/SupportUI', () => ({
    SupportUI: () => <div data-testid="support-ui"/>,
}))

import { MainUI } from '@Components/MainUI/MainUI'

describe('MainUI replay mask', () => {
    beforeEach(() => {
        globalThis.__ = {
            app: {
                setSlug: ({content}) => content.join('-'),
            },
            canvasEvents: {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            },
            device: {
                isMobile: false,
            },
            tools: {
                debounce: fn => fn,
            },
            ui: {
                css: {
                    getCSSVariable: () => '0',
                    setCSSVariable: () => {},
                },
                drawerManager: {
                    close: vi.fn(),
                    drawerRoot: null,
                    isCurrent: vi.fn(() => false),
                    isStacked: vi.fn(() => false),
                    reset: vi.fn(),
                },
                menuManager: {
                    reset: vi.fn(),
                },
            },
        }

        globalThis.lgs = {
            platform: 'test',
            versions: {
                studio: '0.0.0',
            },
            editorSettingsProxy: {
                menu: proxy({
                    drawer: 'right',
                }),
            },
            scene: {
                morphTo2D: vi.fn(),
            },
            settings: {
                getSwatches: {
                    list: [],
                },
                scene: {
                    mode: {
                        value: '3d',
                    },
                },
                ui: {
                    menu: proxy({
                        drawers: {
                            fromBottom: false,
                            fromStart: false,
                        },
                        toolBar: {
                            fromStart: false,
                        },
                    }),
                },
            },
            stores: {
                replay: proxy({
                    active: false,
                    playing: false,
                    paused: false,
                    mainUiHidden: true,
                    toolbarVisible: true,
                    recordingSync: false,
                }),
                main: proxy({
                    readyForTheShow: true,
                    theJourney: {
                        slug: 'journey-a',
                    },
                    components: {
                        geocoder: {
                            dialog: proxy({mounted: false}),
                        },
                    },
                }),
                ui: proxy({
                    drawers: proxy({
                        open: null,
                    }),
                    mainUI: proxy({
                        callForActions: proxy({
                            active: false,
                            initialized: true,
                        }),
                        support: proxy({
                            visible: false,
                        }),
                        journeyLoader: proxy({
                            visible: false,
                        }),
                    }),
                    video: proxy({
                        editing: false,
                        recording: false,
                        preRecording: false,
                        snapshot: false,
                        finalizing: false,
                    }),
                }),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('hides the main UI but keeps the replay toolbar visible while running', () => {
        const {container} = render(<MainUI/>)

        expect(container.querySelector('#lgs-main-ui')).toBeNull()
        expect(screen.getByTestId('replay-controls')).not.toBeNull()
        expect(screen.getByTestId('map-poi-monitor')).not.toBeNull()
    })
})
