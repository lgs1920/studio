/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ElevationProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ProfileChart }                                              from '@Components/Profile/ProfileChart'
import { SCENE_WIDGETS, SCENE_WIDGETS_BOARD, WIDGETS_EDITOR_DRAWER } from '@Core/constants'
import { ElevationServer }                                           from '@Core/Elevation/ElevationServer'
import { Export }                                                    from '@Core/ui/Export'
import {
    WidgetDynamicRenderer,
}                                                                    from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { TrackUtils }                                                from '@Utils/cesium/TrackUtils'
import { UIToast }                                                   from '@Utils/UIToast'
import {
    WaButton, WaIcon, WaOption, WaProgressBar, WaSelect, WaSwitch, WaTooltip,
}                                                                    from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect, useMemo, useRef, useState }               from 'react'
import { useSnapshot }                                               from 'valtio'

/**
 * ElevationProfile component to display and switch elevation data sources
 *
 * @param {object} props - Component props
 * @returns {JSX.Element}
 */
export const ElevationProfile = (props) => {
    // Proxies
    const $profile = lgs.stores.main.components.profile
    const $unitStore = lgs.settings.unitSystem
    const $journeyEditor = lgs.stores.journeyEditor

    // Snapshots
    const profile = useSnapshot($profile)
    const unitStore = useSnapshot($unitStore)
    const {journey, isProcessing} = useSnapshot($journeyEditor)

    // Refs
    const _selectRef = useRef(null)
    const _bootstrapDrawRef = useRef('')
    const _bootstrapComputeRef = useRef('')

    // State to manage the visibility of the progress bar during the rendering phase
    const [canShowProgress, setCanShowProgress] = useState(false)

    // Access the singleton correctly
    const renderer = WidgetDynamicRenderer.instance

    const WIDGET_KEY = 'profile-widget'
    const GROUP = SCENE_WIDGETS

    /**
     * Sync the profile.show proxy with the actual DOM state on mount
     */
    useEffect(() => {
        const syncVisibility = () => {
            const existingId = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

            if (!existingId) {
                $profile.show = false
                return
            }

            const widgetElement = __.ui.widgetManager.getElementById(existingId)
            if (widgetElement) {
                const isHidden = widgetElement.classList.contains('lgs-widget-hidden')
                $profile.show = !isHidden
            }
        }

        // Execution with a slight delay to ensure the renderer/DOM is populated
        const _timeout = setTimeout(syncVisibility, 100)
        return () => clearTimeout(_timeout)
    }, [])

    /**
     * Toggle the profile widget visibility and persist the state
     */
    const toggleProfileButton = async () => {
        const existing = renderer.findExistingInList(WIDGET_KEY, SCENE_WIDGETS_BOARD)

        if (!existing) {
            // Add and persist
            await addWidget(GROUP, WIDGET_KEY, {forceRefresh: true})
            $profile.show = true
        }
        else {
            const widgetElement = __.ui.widgetManager.getElementById(existing)
            const $restrictions = lgs.stores.ui.widget.restrictions

            if ($restrictions.has(existing)) {
                return
            }

            // To make it persist, we should remove it from the board or update its visibility in the store
            if (widgetElement && widgetElement.classList.contains('lgs-widget-hidden')) {
                widgetElement.classList.remove('lgs-widget-hidden')
                $profile.show = true
                __.ui.widgetManager.updateWidgetVisibility(existing, true)
            }
            else {
                if (widgetElement) {
                    widgetElement.classList.add('lgs-widget-hidden')
                }
                $profile.show = false
                __.ui.widgetManager.updateWidgetVisibility(existing, false)

                if (lgs.stores.ui.drawers.open === WIDGETS_EDITOR_DRAWER) {
                    lgs.stores.ui.drawers.open = null
                }
            }
        }
    }

    const addWidget = async (group, key, options = {}) => {
        await renderer.renderWidget(group, key, {
            ...options,
            widgetsBoard: SCENE_WIDGETS_BOARD,
        })
    }

    TrackUtils.setProfileVisibility(lgs.theJourney)

    /**
     * Resolve the currently selected server ID based on journey state or props
     */
    const selectedServer = useMemo(() => {
        const serverIds = props.servers.map(server => server.id)
        const candidate = journey?.elevationServer ?? props.default
        if (candidate && serverIds.includes(candidate)) {
            return candidate
        }
        if (journey?.hasElevation !== false && serverIds.includes(ElevationServer.FILE_CONTENT)) {
            return ElevationServer.FILE_CONTENT
        }
        return props.servers?.[0]?.id ?? ''
    }, [journey?.elevationServer, journey?.hasElevation, props.default, props.servers])

    /**
     * Unique key for the select component to force refresh on server list change
     */
    const selectKey = useMemo(() => `elevation-source-${selectedServer}-${props.servers.map(s => s.id).join('-')}`, [selectedServer, props.servers])

    /**
     * Handle the progress bar lifecycle using RequestAnimationFrame (RAF).
     */
    useEffect(() => {
        if (!isProcessing && canShowProgress) {
            const _rafHandle = requestAnimationFrame(() => {
                setCanShowProgress(false)
            })
            return () => cancelAnimationFrame(_rafHandle)
        }
    }, [isProcessing, canShowProgress])

    /**
     * Synchronize the select DOM element value with the internal state
     */
    useEffect(() => {
        const select = _selectRef.current
        if (!select || !selectedServer) {
            return
        }
        if (select.value !== selectedServer) {
            select.value = selectedServer
        }
    }, [selectedServer])

    /**
     * Sync the selected server back to the journey editor proxy
     */
    useEffect(() => {
        if (!journey || !selectedServer || isProcessing) {
            return
        }
        if (journey.elevationServer !== selectedServer) {
            $journeyEditor.journey.elevationServer = selectedServer
        }
    }, [journey, selectedServer, isProcessing, $journeyEditor])

    /**
     * Prepare data for the profile chart
     */
    const data = useMemo(() => {
        const preparedData = __.ui.profiler?.prepareData()
        return {
            dataset:      preparedData,
            hasElevation: preparedData?.dataset?.length > 0,
        }
    }, [
                             profile.key,
                             profile.elevationData,
                             unitStore.current,
                             journey?.elevationServer,
                             isProcessing,
                         ])

    /**
     * Initialize drawing logic for the profiler
     */
    useEffect(() => {
        if (!journey?.slug || isProcessing) {
            return
        }
        const drawKey = `${journey.slug}:${selectedServer}`
        if (_bootstrapDrawRef.current === drawKey) {
            return
        }
        _bootstrapDrawRef.current = drawKey
    }, [journey?.slug, selectedServer, isProcessing, journey])

    /**
     * Notify parent component of server changes and manage progress bar state
     */
    useEffect(() => {
        if (!journey?.slug || isProcessing || !props.onChange) {
            return
        }
        if (!selectedServer || [ElevationServer.NONE, ElevationServer.CLEAR].includes(selectedServer)) {
            return
        }

        const computeKey = `${journey.slug}:${selectedServer}`
        if (_bootstrapComputeRef.current === computeKey) {
            return
        }
        _bootstrapComputeRef.current = computeKey

        props.onChange({detail: {value: selectedServer, force: true}})
    }, [journey?.slug, selectedServer, isProcessing, props.onChange])

    /**
     * Handle manual server change from the UI
     * @param {CustomEvent} event
     */
    const handleServerChange = (event) => {
        const selected = event.target.value
        if (!selected || selected === selectedServer) {
            return
        }

        const server = props.servers.find(s => s.id === selected)
        setCanShowProgress(!!(server?.url ?? server?.origin))

        if (props.onChange) {
            props.onChange(event)
        }
    }

    const exportChartToPNG = () => {
        const fileName = `${journey.title}-profile`
        Export.toPNG('#journey-profile-chart-in-settings', fileName, 2).then(() => {
            UIToast.success({
                                caption: `Profile chart has been exported successfully!`,
                                text:    `File name: ${fileName}.png`,
                            })
        })
    }

    return (
        <>
            <WaSelect
                key={selectKey}
                ref={_selectRef}
                size="small"
                label={props.label}
                hint={props.hint ?? ''}
                value={selectedServer}
                onChange={handleServerChange}
            >
                {props.servers.map(server => {
                    const isSelected = selectedServer === server.id
                    const icon = isSelected ? (server.iconSelection ?? server.icon) : server.icon
                    const label = isSelected ? (server.labelSelection ?? server.label) : server.label

                    return (
                        <WaOption key={server.id} value={server.id}>
                            <WaIcon name={icon} slot="start" variant="regular"/>
                            {label}
                        </WaOption>
                    )
                })}
            </WaSelect>

            {canShowProgress
             ? (<WaProgressBar indeterminate/>)
             : (<div className="journey-profile-chart-menu">
                    <WaSwitch size="xsmall" label-at-start width-auto checked={profile.show}
                              onChange={toggleProfileButton}>
                        {'Add widget on scene'}
                    </WaSwitch>
                    {data.hasElevation &&
                        <>
                            <WaTooltip for="export-chart-button-in-settings">{'Export profile to image'}</WaTooltip>
                            <WaButton appearance="plain"
                                      variant="brand"
                                      id="export-chart-button-in-settings"
                                      onClick={exportChartToPNG}>
                                <WaIcon variant="regular" name="camera"/>
                            </WaButton>
                        </>
                    }
                </div>)
            }

            {!isProcessing && data.hasElevation && (
                <ProfileChart
                    id="journey-profile-chart-in-settings"
                    data={data.dataset}
                    height="180px"
                    width="100%"
                />
            )}
        </>
    )
}