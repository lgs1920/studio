/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyMetricsInput.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyMetricsInput.jsx
 ******************************************************************************/

import { SlInput, SlIconButton } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                 from '@Utils/FA2SL'
import { faArrowRotateLeft }     from '@fortawesome/pro-solid-svg-icons'
import { UnitUtils }                 from '@Utils/UnitUtils'
import { WaButton, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useMemo }            from 'react'
import { useSnapshot }           from 'valtio'

export const JourneyMetricsInput = ({label, path, unit, precision = 2, dataSource}) => {
    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)

    // Resolve value and origin based on the selected dataSource filter
    const {value, origin} = useMemo(() => {
        const _keys = path.split('.')

        const getVal = (root) => {
            let v = root
            for (const key of _keys) {
                v = v?.[key]
            }
            return (typeof v === 'object' && v !== null) ? undefined : v
        }

        const globalVal = getVal(metricsSnap.global)
        const externalVal = getVal(metricsSnap.external)
        const userVal = getVal(metricsSnap.user)

        // Strict display logic based on the "From" selector
        if (dataSource === 'user') {
            return {
                value:  userVal !== undefined ? userVal : globalVal,
                origin: userVal !== undefined ? 'user' : 'global',
            }
        }

        if (dataSource === 'external') {
            return {
                value:  externalVal !== undefined ? externalVal : globalVal,
                origin: externalVal !== undefined ? 'external' : 'global',
            }
        }

        // Default: Data (Global) mode
        return {value: globalVal, origin: 'global'}
    }, [metricsSnap, path, dataSource])

    const displayValue = String(UnitUtils.formatMetric(value, {units: unit, precision}).value || '')
    const originClass = origin !== 'global' ? `lgs-journey-metrics-origine-${origin}` : ''

    const handleUpdate = (e) => {
        const rawValue = e.target.value
        if (!$metrics.user) {
            $metrics.user = {}
        }

        let _curr = $metrics.user
        const _keys = path.split('.')
        for (let i = 0; i < _keys.length - 1; i++) {
            if (!_curr[_keys[i]]) {
                _curr[_keys[i]] = {}
            }
            _curr = _curr[_keys[i]]
        }

        _curr[_keys[_keys.length - 1]] = unit ? UnitUtils.revert(rawValue, unit) : Number(rawValue)
    }

    const handleReset = () => {
        const _keys = path.split('.')
        let _curr = $metrics.user
        for (let i = 0; i < _keys.length - 1; i++) {
            _curr = _curr?.[_keys[i]]
        }
        if (_curr) {
            delete _curr[_keys[_keys.length - 1]]
        }

        if (_keys.length > 1 && $metrics.user[_keys[0]] && Object.keys($metrics.user[_keys[0]]).length === 0) {
            delete $metrics.user[_keys[0]]
        }
        $metrics.user = {...$metrics.user}
    }

    const handleBlur = (e) => {
        const userRawValue = e.target.value
        let globalVal = metricsSnap.global
        for (const key of path.split('.')) {
            globalVal = globalVal?.[key]
        }

        const formattedGlobal = String(UnitUtils.formatMetric(globalVal, {units: unit, precision}).value || '')
        if (userRawValue === formattedGlobal) {
            handleReset()
        }
    }

    return (
        <WaInput appearance="filled"
            label={label}
            size="s"
            type="number"
            className={originClass}
            value={displayValue}
            onInput={handleUpdate}
            onBlur={handleBlur}
            withoutSpinButtons
        >
            {origin === 'user' && (
                <WaButton
                    appearance="plain"
                    variant="brand"
                    onClick={(e) => {
                        e.stopPropagation()
                        handleReset()
                    }}
                    slot="end"
                    style={{fontSize: '80%'}}
                >
                    <WaIcon name="arrow-rotate-left" variant="regular"/>
                </WaButton>
            )}
        </WaInput>
    )
}