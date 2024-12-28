import { SlInput, SlRange }            from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef, useState } from 'react'

export const Range = (props) => {
    const range = useRef(null)
    const input = useRef(null)
    const [value, setValue] = useState(props.value)


    const changeRange = (event) => {
        setValue(Number(event.target.value))
        if (props.callback) {
            props.callback(event, value)
        }
    }

    const changeField = (event) => {
        if (props.callback) {
            setValue(Number(event.target.value))
            props.callback(event, value)
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
            >
                <div slot="label">
                    <SlInput type="number" align-right size="small"
                             min={props.min ?? 0} max={props.max ?? 100} step={props.step ?? 1}
                             value={value} ref={input}
                             onSlInput={changeField}
                             onSlChange={changeField}
                    >
                        <div slot="label">{props.label}</div>
                    </SlInput>
                </div>
            </SlRange>
        </div>
    )
}