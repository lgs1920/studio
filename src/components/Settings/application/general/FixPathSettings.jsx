/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DEFAULT_FIX_PATH_SEGMENT_METERS } from '@Utils/cesium/fixPathCorrections'
import { WaDivider, WaIcon, WaInput } from '@awesome.me/webawesome/dist/react'
import { useState } from 'react'
import { useSnapshot } from 'valtio'

const MIN_SEGMENT_METERS = 50
const MAX_SEGMENT_METERS = 5000

const FixPathSegmentLengthInput = ({maxSegmentMeters}) => {
    const [inputValue, setInputValue] = useState(String(maxSegmentMeters))

    const updateInput = event => setInputValue(event.target.value)

    const saveInput = () => {
        const nextValue = Number(inputValue)
        if (!Number.isFinite(nextValue) || nextValue < MIN_SEGMENT_METERS || nextValue > MAX_SEGMENT_METERS) {
            setInputValue(String(maxSegmentMeters))
            return
        }
        lgs.settings.journey.fixPathMaxSegmentMeters = Math.round(nextValue / 10) * 10
    }

    return (
        <WaInput
            appearance="filled"
            label="Maximum correction section length"
            hint="Longer edits must be split into separate, nearby sections. This setting is saved with application preferences."
            size="s"
            type="number"
            min={MIN_SEGMENT_METERS}
            max={MAX_SEGMENT_METERS}
            step="10"
            value={inputValue}
            onInput={updateInput}
            onBlur={saveInput}
            withoutSpinButtons
        >
            <span slot="end">{'m'}</span>
        </WaInput>
    )
}

/** Configure and persist the maximum length of one manual path correction. */
export const FixPathSettings = () => {
    const journey = useSnapshot(lgs.settings.journey)
    const value = Number(journey.fixPathMaxSegmentMeters)
    const maxSegmentMeters = Number.isFinite(value) && value > 0 ? value : DEFAULT_FIX_PATH_SEGMENT_METERS
    return (
        <>
            <span slot="summary"><WaIcon name="route" variant="regular"/>{' Fix Path'}</span>
            <WaDivider/>
            <FixPathSegmentLengthInput key={maxSegmentMeters} maxSegmentMeters={maxSegmentMeters}/>
        </>
    )
}
