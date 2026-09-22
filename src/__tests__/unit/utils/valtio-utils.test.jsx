/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: valtio-utils.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-22
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// @vitest-environment jsdom

import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {proxy}                              from 'valtio'
import {afterEach, describe, expect, it}    from 'vitest'
import {useProxyValue}                      from '@Utils/ValtioUtils'

const Probe = ({state}) => {
    const visible = useProxyValue(state, value => value.journey.visible, false)

    return <span data-testid="value">{visible ? 'visible' : 'hidden'}</span>
}

describe('useProxyValue', () => {
    afterEach(() => cleanup())

    it('updates from a scalar selection without requiring a deep snapshot', async () => {
        const state = proxy({
            journey: {
                visible: true,
                geometry: {
                    coordinates: Array.from({length: 2405}, (_, index) => [index, index]),
                },
            },
        })

        render(<Probe state={state}/>)
        expect(screen.getByTestId('value').textContent).toBe('visible')

        state.journey.geometry.coordinates.push([2405, 2405])
        expect(screen.getByTestId('value').textContent).toBe('visible')

        state.journey.visible = false
        await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('hidden'))
    })
})
