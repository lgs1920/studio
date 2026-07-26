/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: compass-svg-rotation.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-17
 * Last modified: 2026-06-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { CompassFull } from '@Components/MainUI/compass/CompassFull'
import { CompassLight } from '@Components/MainUI/compass/CompassLight'
import { CompassWindRose } from '@Components/MainUI/compass/CompassWindRose'

describe('compass SVG rotation target', () => {
    afterEach(() => {
        cleanup()
    })

    it('rotates the complete full compass artwork', () => {
        const ref = createRef()

        render(<CompassFull ref={ref}/>)

        expect(ref.current?.querySelector('.lgs-compass-background')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-poles')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle')).not.toBeNull()
    })

    it('rotates the complete light compass artwork', () => {
        const ref = createRef()

        render(<CompassLight ref={ref}/>)

        expect(ref.current?.querySelector('.lgs-compass-needle')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle-center')).not.toBeNull()
    })

    it('rotates the complete wind rose compass artwork', () => {
        const ref = createRef()

        render(<CompassWindRose ref={ref}/>)

        expect(ref.current?.querySelector('.lgs-compass-poles')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-text')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle')).not.toBeNull()
    })
})
