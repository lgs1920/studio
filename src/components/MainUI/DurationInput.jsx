/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DurationInput.jsx
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
 * File: DurationInput.jsx
 ******************************************************************************/

import { SlInput, SlIconButton }                                    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import { faArrowRotateLeft }                                        from '@fortawesome/pro-solid-svg-icons'
import { WaButton, WaIcon, WaInput } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useSnapshot }                                              from 'valtio'

export const DurationInput = ({label, path, minutes = false, dataSource}) => {
    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)
    const unitSystem = useSnapshot(lgs.settings.unitSystem).current

    const [tempValue, setTempValue] = useState('')
    const _isFocused = useRef(false)
    const isImperial = String(unitSystem) === 'imperial'

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
        return {value: globalVal, origin: 'global'}
    }, [metricsSnap, path, dataSource])

    const secondsToDisplay = useCallback((totalSeconds) => {
        if (!totalSeconds || isNaN(totalSeconds)) {
            return ''
        }
        if (minutes) {
            const m = Math.floor(totalSeconds / 60)
            const s = Math.floor(totalSeconds % 60)
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
        const hours = Math.floor(totalSeconds / 3600)
        const mins = Math.floor((totalSeconds % 3600) / 60)
        return isImperial
               ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
               : `${String(hours).padStart(2, '0')}h${String(mins).padStart(2, '0')}`
    }, [isImperial, minutes])

    const displayToSeconds = useCallback((str) => {
        const cleanStr = str.trim()
        if (!cleanStr) {
            return 0
        }
        const regex = /^(\d{1,3})[:hH.](\d{0,2})$/
        const match = cleanStr.match(regex)
        if (match) {
            const first = parseInt(match[1], 10)
            const second = match[2] ? parseInt(match[2], 10) : 0
            if (second < 60) {
                return minutes ? (first * 60) + second : (first * 3600) + (second * 60)
            }
        }
        return null
    }, [minutes])

    useEffect(() => {
        if (!_isFocused.current) {
            setTempValue(secondsToDisplay(value))
        }
    }, [value, secondsToDisplay])

    const handleUpdate = (e) => {
        const val = e.target.value
        setTempValue(val)
        const seconds = displayToSeconds(val)
        if (seconds !== null) {
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
            _curr[_keys[_keys.length - 1]] = seconds
        }
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
        $metrics.user = {...$metrics.user}
    }

    const handleBlur = () => {
        _isFocused.current = false
        setTempValue(secondsToDisplay(value))
        let globalVal = metricsSnap.global
        for (const key of path.split('.')) {
            globalVal = globalVal?.[key]
        }
        if (value === globalVal) {
            handleReset()
        }
    }

    const originClass = origin !== 'global' ? `lgs-journey-metrics-origine-${origin}` : ''

    return (
        <WaInput appearance="filled"
            label={label}
            size="s"
            className={originClass}
            value={tempValue}
            onInput={handleUpdate}
            onFocus={() => {
                _isFocused.current = true
            }}
            onBlur={handleBlur}
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