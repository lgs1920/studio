/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Range.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlInput, SlRange }            from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef, useState } from 'react'

export const Range = (props) => {
    const range = useRef(null)
    const input = useRef(null)
    const [value, setValue] = useState(props.value)


    const changeRange = (event) => {
        setValue(Number(event.target.value))
        if (props.onChange) {
            props.onChange(event.target.name, event.target.value, value)
        }
    }

    const changeField = (event) => {
        setValue(Number(event.target.valueAsNumber))
        if (props.onChange) {
            props.onChange(event.target.name.split('-')[0], event.target.value, value)
        }
    }

    useEffect(() => {
        setValue(Number(props.value))
    }, [props.value])

    return (
        <div className="lgs-range">
            <SlRange align-right tooltip="none"
                     min={props.min ?? 0} max={props.max ?? 100} step={props.step ?? 1}
                     helpText={props.helpText ?? ''}
                     value={value} ref={range}
                     onSlInput={changeRange}
                     onSlChange={changeRange}
                     name={props.name ?? ''}
            >
                <div slot="label">
                    <SlInput type="number" align-right size="small"
                             min={props.min ?? 0} max={props.max ?? 100} step={props.step ?? 1}
                             value={value} ref={input}
                             onSlInput={changeField}
                             onSlChange={changeField}
                             name={`${props.name}-i` ?? ''}
                    >
                        <div slot="label">{props.label}</div>
                    </SlInput>
                </div>
            </SlRange>
        </div>
    )
}