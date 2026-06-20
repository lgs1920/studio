/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ElevationProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ProfileChart }                                             from '@Components/Profile/ProfileChart'
import {
    EDIT_WIDGET_ICON,
    SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import {
    ElevationServer,
}                                                                   from '@Core/Elevation/ElevationServer'
import { Export }                                                   from '@Core/ui/Export'
import {
    WidgetDynamicRenderer,
}                                                                   from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { TrackUtils }                                               from '@Utils/cesium/TrackUtils'
import { UIToast }                                                  from '@Utils/UIToast'
import {
    WaButton, WaIcon, WaOption, WaProgressBar, WaSelect, WaSwitch, WaTooltip,
}                                                                   from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState }                 from 'react'
import { useSnapshot }                                              from 'valtio'

const setProfileWidgetVisible = visible => {
    lgs.stores.main.components.profile.show = visible
}

/**
 * ElevationProfile component to manage and display elevation data and widgets
 * @param {Object} props
 * @returns {JSX.Element}
 */
export const ElevationProfile = (props) => {
    const $profile = lgs.stores.main.components.profile
    const $unitStore = lgs.settings.unitSystem
    const $journeyEditor = lgs.stores.journeyEditor

    const profile = useSnapshot($profile)
    const {current: unitSystem} = useSnapshot($unitStore)
    const {journey, isProcessing} = useSnapshot($journeyEditor)
    const widget = useSnapshot(lgs.stores.ui.widget)

    const [canShowProgress, setCanShowProgress] = useState(false)
    const [profileChartConfigId, setProfileChartConfigId] = useState(null)
    const [backgroundImage, setBackgroundImage] = useState(null)
    const [lastValidData, setLastValidData] = useState({journeySlug: null, data: null})
    const previewZoneRef = useRef(null)
    const [previewZoneReady, setPreviewZoneReady] = useState(false)

    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'profile-widget'
    const GROUP = SCENE_WIDGETS
    const HIDDEN_CLASS = 'lgs-widget-hidden'

    const currentSnapshot = widget.currentSnapshot
    const currentProfileSnapshotImage = currentSnapshot?.image && profileChartConfigId && currentSnapshot.entity === profileChartConfigId
                                        ? currentSnapshot.image
                                        : null

    /**
     * Syncs the chart configuration ID from existing widgets
     */
    const syncProfileChartConfigId = useCallback(() => {
        const entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        setProfileChartConfigId(entity ?? null)
        return entity
    }, [renderer])

    const renderProfileWidget = useCallback(async () => {
        let entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!entity) {
            await renderer.renderWidget(GROUP, WIDGET_KEY, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
            entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        }
        else if (!__.ui.widgetManager.getElementById(entity)) {
            await renderer.renderWidget(GROUP, entity, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
        }

        if (entity) {
            __.ui.widgetManager.getElementById(entity)?.classList.remove(HIDDEN_CLASS)
        }

        return entity
    }, [GROUP, renderer])

    const ensureProfileWidget = useCallback(async () => {
        const entity = await renderProfileWidget()

        if (entity) {
            setProfileChartConfigId(entity)
        }

        return entity
    }, [renderProfileWidget])

    const resetProfileWidget = useCallback(async (entity) => {
        if (!entity) {
            return
        }

        const element = __.ui.widgetManager.getElementById(entity)
        const type = entity.split('#')[0]
        const elements = lgs.settings.widgets[type]?.configuration?.elements

        if (elements?.[entity]) {
            delete elements[entity]
        }

        renderer.destroyWidget(entity)

        if (element) {
            await __.ui.widgetManager.disposeElement(element)
        }
        await __.ui.widgetManager.deleteWidgetPosition(entity)

        setProfileChartConfigId(null)
    }, [renderer])

    /**
     * Prepare data for the profile chart
     * Moved up to avoid ReferenceError in effects
     */
    const currentData = useMemo(() => {
        const _raw = __.ui.profiler?.prepareData()
        return {
            dataset:      _raw,
            hasElevation: _raw?.dataset?.length > 0,
        }
    }, [
                             profile.key,
                             profile.elevationData,
                             unitSystem,
                             journey?.elevationServer,
                             isProcessing,
                         ])
    const journeySlug = journey?.slug ?? null
    const data = currentData.hasElevation
                 ? currentData
                 : (lastValidData.journeySlug === journeySlug ? lastValidData.data : null)
    const hasElevation = Boolean(data?.hasElevation)

    useEffect(() => {
        const schedule = typeof queueMicrotask === 'function'
                         ? queueMicrotask
                         : callback => Promise.resolve().then(callback)

        if (currentData.hasElevation) {
            if (lastValidData.journeySlug !== journeySlug || lastValidData.data !== currentData) {
                schedule(() => setLastValidData({
                    journeySlug,
                    data:        currentData,
                }))
            }
            return
        }

        if (lastValidData.journeySlug !== journeySlug) {
            schedule(() => setLastValidData({
                journeySlug,
                data:        null,
            }))
        }
    }, [currentData, journeySlug, lastValidData.data, lastValidData.journeySlug])


    /**
     * Resolves the profile background asynchronously
     */
    const getProfileBackground = useCallback(async () => {
        // We have one snapshot, let's use it
        if (currentProfileSnapshotImage) {
            return currentProfileSnapshotImage
        }

        // We do not have one, we need to make it
        lgs.scene.render()
        const targetWidth = Math.min(window.innerWidth, 500)
        const targetHeight = Math.min(window.innerHeight, 300)

        const _offscreen = document.createElement('canvas')
        _offscreen.width = targetWidth
        _offscreen.height = targetHeight
        const _ctx = _offscreen.getContext('2d')

        // Calculate source coordinates (centered)
        const sx = (lgs.canvas.width - targetWidth) / 2
        const sy = (lgs.canvas.height - targetHeight) / 2

        try {
            _ctx.drawImage(
                lgs.canvas,
                sx, sy, targetWidth, targetHeight,
                0, 0, targetWidth, targetHeight,
            )
            return _offscreen.toDataURL('image/webp')
        }
        catch {
            return null
        }

    }, [currentProfileSnapshotImage])

    /**
     * Initial sync of the toggle state
     */
    useEffect(() => {
        let cancelled = false

        const syncProfileWidget = async () => {
            const _id = syncProfileChartConfigId()

            if (_id) {
                const _el = __.ui.widgetManager.getElementById(_id)
                if (_el) {
                    setProfileWidgetVisible(!_el.classList.contains(HIDDEN_CLASS))
                }
                return
            }

            if (profile.show && hasElevation && !isProcessing) {
                const entity = await renderProfileWidget()
                if (!cancelled && entity) {
                    setProfileWidgetVisible(true)
                }
            }
        }

        syncProfileWidget()

        return () => {
            cancelled = true
        }
    }, [hasElevation, isProcessing, profile.show, renderProfileWidget, syncProfileChartConfigId])

    /**
     * Handles background image updates
     */
    useEffect(() => {
        let isMounted = true

        const updateBg = async () => {
            const url = await getProfileBackground()
            if (isMounted) {
                setBackgroundImage(url)
            }
        }

        if (!isProcessing && hasElevation) {
            updateBg()
        }

        return () => {
            isMounted = false
        }
    }, [isProcessing, hasElevation, getProfileBackground])

    useLayoutEffect(() => {
        const element = previewZoneRef.current
        if (!element) {
            return
        }

        let raf1 = 0
        let raf2 = 0
        const updateReadyState = () => {
            const rect = element.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) {
                setPreviewZoneReady(true)
            }
        }

        updateReadyState()
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateReadyState) : null
        observer?.observe(element)
        raf1 = requestAnimationFrame(() => {
            updateReadyState()
            raf2 = requestAnimationFrame(updateReadyState)
        })

        return () => {
            if (raf1) {
                cancelAnimationFrame(raf1)
            }
            if (raf2) {
                cancelAnimationFrame(raf2)
            }
            observer?.disconnect()
        }
    }, [hasElevation, isProcessing, profile.show, profileChartConfigId])

    /**
     * Auto-hide widget if no elevation data is available
     */
    useEffect(() => {
        if (!isProcessing && !hasElevation && profile.show) {
            const _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
            if (_id) {
                const _el = __.ui.widgetManager.getElementById(_id)
                if (_el && !_el.classList.contains(HIDDEN_CLASS)) {
                    _el.classList.add(HIDDEN_CLASS)
                    setProfileWidgetVisible(false)
                }
            }
        }
    }, [hasElevation, isProcessing, profile.show, renderer])

    useEffect(() => {
        if (!profile.show || !hasElevation || isProcessing) {
            return
        }

        let cancelled = false

        renderProfileWidget().then(entity => {
            if (!cancelled && entity) {
                setProfileWidgetVisible(true)
            }
        })

        return () => {
            cancelled = true
        }
    }, [hasElevation, isProcessing, profile.show, renderProfileWidget])

    /**
     * Toggles the profile widget visibility
     */
    const toggleProfileButton = async () => {
        let _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!_id) {
            await ensureProfileWidget()
            syncProfileChartConfigId()
            setProfileWidgetVisible(true)
            return
        }

        if (lgs.stores.ui.widget.restrictions.has(_id)) {
            return
        }

        const _el = __.ui.widgetManager.getElementById(_id)
        const _nextState = !profile.show

        if (!_nextState) {
            await resetProfileWidget(_id)
            setProfileWidgetVisible(false)

            if (lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
                lgs.stores.ui.drawers.open = null
            }
            return
        }

        if (_el) {
            _el.classList.remove(HIDDEN_CLASS)
        }
        else {
            await ensureProfileWidget()
        }

        syncProfileChartConfigId()
        setProfileWidgetVisible(true)
    }

    const journeyElevationServer = journey?.elevationServer
    const journeyHasElevation = journey?.hasElevation
    const selectedServer = useMemo(() => {
        const _ids = props.servers.map(s => s.id)
        if (journeyElevationServer && _ids.includes(journeyElevationServer)) {
            return journeyElevationServer
        }
        if (journeyHasElevation !== false && _ids.includes(ElevationServer.FILE_CONTENT)) {
            return ElevationServer.FILE_CONTENT
        }
        return props.default || _ids[0] || ''
    }, [journeyElevationServer, journeyHasElevation, props.default, props.servers])

    useEffect(() => {
        if (!isProcessing && canShowProgress) {
            const _id = requestAnimationFrame(() => setCanShowProgress(false))
            return () => cancelAnimationFrame(_id)
        }
    }, [isProcessing, canShowProgress])

    useEffect(() => {
        if (journey && selectedServer && !isProcessing && journey.elevationServer !== selectedServer) {
            $journeyEditor.journey.elevationServer = selectedServer
        }
    }, [selectedServer, isProcessing])

    const handleServerChange = (e) => {
        const _val = e.target.value
        if (!_val || _val === selectedServer) {
            return
        }
        const _server = props.servers.find(s => s.id === _val)
        setCanShowProgress(!!(_server?.url || _server?.origin))
        if (props.onChange) {
            props.onChange(e)
        }
    }

    const exportChartToPNG = () => {
        const _name = `${journey.title}-profile`
        Export.toPNG('#journey-profile-chart-in-settings', _name, 2).then(() => {
            UIToast.success({caption: 'Export success', text: `Exported to ${_name}.png`})
        })
    }

    const openWidgetProfileEditor = async () => {
        let entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!entity) {
            entity = await ensureProfileWidget()
        }

        if (!entity) {
            return
        }

        setProfileChartConfigId(entity)

        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
            detail: {entity},
        }))
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
            action:  'edit-current',
            entity,
            stacked: true,
        })
        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
            detail: {entity},
        }))
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    return (
        <>
            <WaSelect appearance="filled" className="lgs--elevation-source-select"
                      size="s"
                      label={props.label}
                      value={selectedServer}
                      onChange={handleServerChange}>
                {props.servers.map(s => (
                    <WaOption key={s.id} value={s.id}>
                        <WaIcon name={selectedServer === s.id ? (s.iconSelection || s.icon) : s.icon} slot="start"
                                variant="regular"/>
                        {selectedServer === s.id ? (s.labelSelection || s.label) : s.label}
                    </WaOption>
                ))}
            </WaSelect>

            {canShowProgress ? (
                <WaProgressBar indeterminate/>
            ) : (
                 <div className="journey-profile-chart-menu">
                     <WaSwitch
                         size="xs"
                         label-at-start
                         width-auto
                         disabled={!hasElevation}
                         checked={profile.show && hasElevation}
                         onChange={toggleProfileButton}
                     >
                         {'Add Profile widget on scene'}
                     </WaSwitch>
                     {hasElevation && (
                         <>
                             <WaTooltip for="edit-profile-widget-in-settings">{'Edit widget'}</WaTooltip>
                             <WaButton id="edit-profile-widget-in-settings" appearance="plain" variant="brand"
                                       onClick={openWidgetProfileEditor}>
                                 <WaIcon variant="regular" name={EDIT_WIDGET_ICON}/>
                             </WaButton>
                             <WaTooltip for="snap-profile-widget-in-settings">{'Export to image'}</WaTooltip>
                             <WaButton id="snap-profile-widget-in-settings" appearance="plain" variant="brand"
                                       onClick={exportChartToPNG}>
                                 <WaIcon variant="regular" name="camera"/>
                             </WaButton>
                         </>
                     )}
                 </div>
             )}

            {hasElevation && (
                <div
                    ref={previewZoneRef}
                    className="editor-preview-zone lgs-widget-preview"
                    data-widget-preview-entity={profileChartConfigId ?? undefined}
                    style={{'--lgs-widget-preview-bg': backgroundImage ? `url(${backgroundImage})` : 'none'}}
                >
                    {previewZoneReady && (
                        <ProfileChart
                            key={profileChartConfigId ?? 'profile'}
                            id="journey-profile-chart-in-settings"
                            configId={profileChartConfigId}
                            data={data?.dataset}
                            height="180px"
                            width="100%"
                        />
                    )}
                </div>
            )}
        </>
    )
}
