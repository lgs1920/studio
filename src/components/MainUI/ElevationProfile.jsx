/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ElevationProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-20
 * Last modified: 2026-04-20
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                              from 'valtio'

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

    const _bootstrapComputeRef = useRef('')
    const [canShowProgress, setCanShowProgress] = useState(false)
    const [profileChartConfigId, setProfileChartConfigId] = useState(null)
    const [backgroundImage, setBackgroundImage] = useState(null)

    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'profile-widget'
    const GROUP = SCENE_WIDGETS
    const HIDDEN_CLASS = 'lgs-widget-hidden'

    /**
     * Syncs the chart configuration ID from existing widgets
     */
    const syncProfileChartConfigId = useCallback(() => {
        const entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        setProfileChartConfigId(entity ?? null)
        return entity
    }, [renderer])

    /**
     * Prepare data for the profile chart
     * Moved up to avoid ReferenceError in effects
     */
    const data = useMemo(() => {
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


    /**
     * Resolves the profile background asynchronously
     */
    const getProfileBackground = useCallback(async () => {
        let entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!entity) {
            await renderer.renderWidget(GROUP, WIDGET_KEY, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
            entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
        }

        if (!entity) {
            return null
        }

        // We have one snapshot, let's use it
        if (lgs.stores.ui.widget.currentSnapshot) {
            return lgs.stores.ui.widget.currentSnapshot.image
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
        catch (e) {
            return null
        }

    }, [renderer])

    /**
     * Initial sync of the toggle state
     */
    useEffect(() => {
        const _id = syncProfileChartConfigId()
        if (!_id) {
            $profile.show = false
            return
        }

        const _el = __.ui.widgetManager.getElementById(_id)
        if (_el) {
            $profile.show = !_el.classList.contains(HIDDEN_CLASS)
        }
    }, [syncProfileChartConfigId])

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

        if (!isProcessing && data.hasElevation) {
            updateBg()
        }

        return () => {
            isMounted = false
        }
    }, [isProcessing, data.hasElevation, getProfileBackground])

    /**
     * Auto-hide widget if no elevation data is available
     */
    useEffect(() => {
        if (!isProcessing && !data.hasElevation && profile.show) {
            const _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
            if (_id) {
                const _el = __.ui.widgetManager.getElementById(_id)
                if (_el && !_el.classList.contains(HIDDEN_CLASS)) {
                    _el.classList.add(HIDDEN_CLASS)
                    $profile.show = false
                }
            }
        }
    }, [data.hasElevation, isProcessing, profile.show])

    /**
     * Toggles the profile widget visibility
     */
    const toggleProfileButton = useCallback(async () => {
        const _id = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!_id) {
            await renderer.renderWidget(GROUP, WIDGET_KEY, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
            syncProfileChartConfigId()
            $profile.show = true
            return
        }

        if (lgs.stores.ui.widget.restrictions.has(_id)) {
            return
        }

        const _el = __.ui.widgetManager.getElementById(_id)
        const _nextState = !profile.show

        if (_el) {
            _el.classList.toggle(HIDDEN_CLASS, !_nextState)
        }

        syncProfileChartConfigId()
        $profile.show = _nextState
        __.ui.widgetManager.updateWidgetVisibility(_id, _nextState)

        if (!_nextState && lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
            lgs.stores.ui.drawers.open = null
        }
    }, [profile.show, syncProfileChartConfigId])

    const selectedServer = useMemo(() => {
        const _ids = props.servers.map(s => s.id)
        if (journey?.elevationServer && _ids.includes(journey.elevationServer)) {
            return journey.elevationServer
        }
        if (journey?.hasElevation !== false && _ids.includes(ElevationServer.FILE_CONTENT)) {
            return ElevationServer.FILE_CONTENT
        }
        return props.default || _ids[0] || ''
    }, [journey?.elevationServer, journey?.hasElevation, props.default, props.servers])

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

    useEffect(() => {
        if (!journey?.slug || isProcessing || !props.onChange) {
            return
        }
        const _key = `${journey.slug}:${selectedServer}`
        if (_bootstrapComputeRef.current === _key || [ElevationServer.NONE, ElevationServer.CLEAR].includes(selectedServer)) {
            return
        }

        _bootstrapComputeRef.current = _key
        props.onChange({detail: {value: selectedServer, force: true}})
    }, [journey?.slug, selectedServer, isProcessing])

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
            UIToast.success({caption: 'Export success', text: `${_name}.png`})
        })
    }

    const openWidgetProfileEditor = async () => {
        let entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!entity) {
            await renderer.renderWidget(GROUP, WIDGET_KEY, {
                forceRefresh: true,
                widgetsBoard: SCENE_WIDGETS_BOARD,
            })
            entity = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)
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
            <WaSelect size="small" label={props.label} value={selectedServer} onChange={handleServerChange}>
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
                         size="xsmall"
                         label-at-start
                         width-auto
                         disabled={!data.hasElevation}
                         checked={profile.show && data.hasElevation}
                         onChange={toggleProfileButton}
                     >
                         {'Add Profile widget on scene'}
                     </WaSwitch>
                     {data.hasElevation && (
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

            {!isProcessing && data.hasElevation && (
                <div
                    className="editor-preview-zone lgs-widget-preview"
                    style={{'--lgs-widget-preview-bg': backgroundImage ? `url(${backgroundImage})` : 'none'}}
                >
                    <ProfileChart
                        id="journey-profile-chart-in-settings"
                        configId={profileChartConfigId}
                        data={data.dataset}
                        height="180px"
                        width="100%"
                    />
                </div>
            )}
        </>
    )
}