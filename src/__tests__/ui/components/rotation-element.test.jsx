/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: rotation-element.test.jsx
 *
 ******************************************************************************/

import { cleanup, fireEvent, render } from '@testing-library/react'
import { RotationElement } from '@Components/MainUI/widgets/editor/elements/RotationElement'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon:   () => <span/>,
    WaNumberInput: ({value, onInput}) => (
        <input data-testid="rotation-number" value={value} onInput={onInput}/>
    ),
    WaSlider: ({value, onInput, min, max, step}) => (
        <input data-testid="rotation-slider" type="range" min={min} max={max} step={step} value={value} onInput={onInput}/>
    ),
}))

describe('RotationElement', () => {
    afterEach(() => {
        cleanup()
    })

    it('keeps the slider controlled by the current rotation', () => {
        const applyRotation = vi.fn()
        const {getByTestId, rerender} = render(
            <RotationElement localRotation={30} applyRotation={applyRotation}/>,
        )
        const slider = getByTestId('rotation-slider')

        expect(slider.value).toBe('-30')

        rerender(<RotationElement localRotation={45} applyRotation={applyRotation}/>)

        expect(slider.value).toBe('-45')
    })

    it('only applies a rotation after slider input', () => {
        const applyRotation = vi.fn()
        const {getByTestId} = render(
            <RotationElement localRotation={0} applyRotation={applyRotation}/>,
        )

        fireEvent.input(getByTestId('rotation-slider'), {target: {value: '-20'}})

        expect(applyRotation).toHaveBeenCalledWith(20)
    })
})
