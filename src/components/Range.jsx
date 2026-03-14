/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Range.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-14
 * Last modified: 2026-03-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaNumberInput, WaSlider } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useRef, useState } from 'react'

/**
 * Range component combining a numeric input and a slider on a single line.
 * @param {Object} props - Component properties.
 */
export const Range = (props) => {
    const _range = useRef(null)
    const _input = useRef(null)
    const [value, setValue] = useState(props.value)

    /**
     * Handles changes from the slider.
     */
    const changeRange = (event) => {
        const newValue = Number(event.target.value)
        setValue(newValue)
        if (props.onChange) {
            props.onChange(event.target.name, newValue)
        }
    }

    /**
     * Handles changes from the numeric input field.
     */
    const changeField = (event) => {
        const newValue = Number(event.target.value)
        setValue(newValue)
        if (props.onChange) {
            props.onChange(props.name, newValue)
        }
    }

    useEffect(() => {
        setValue(Number(props.value))
    }, [props.value])

    return (
        <div className={'lgs--range-container'}>
            {props.label && (
                <label className={'lgs--range-label'}>
                    {props.label}
                </label>
            )}

            <div className={'lgs--range-controls'}>
                <WaNumberInput
                    size={'small'}
                    className={'lgs--range-number lgs--short-input'}
                    min={props.min ?? 0}
                    max={props.max ?? 100}
                    step={props.step ?? 1}
                    value={value}
                    ref={_input}
                    onInput={changeField}
                    name={`${props.name}-input`}
                    no-start no-end no-margin
                    appearance="filled"
                />

                <WaSlider
                    with-tooltip
                    size="small"
                    className={'lgs--range-slider'}
                    min={props.min ?? 0}
                    max={props.max ?? 100}
                    step={props.step ?? 1}
                    value={value}
                    ref={_range}
                    onInput={changeRange}
                    name={props.name ?? ''}
                    hint={props.hint ?? ''}
                />
            </div>
        </div>
    )
}