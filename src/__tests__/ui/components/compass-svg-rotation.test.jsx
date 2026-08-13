/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: compass-svg-rotation.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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
import { CompassFlat } from '@Components/MainUI/compass/CompassFlat'
import { CompassLight } from '@Components/MainUI/compass/CompassLight'
import { CompassModern } from '@Components/MainUI/compass/CompassModern'

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

    it('rotates the modern compass indicators together', () => {
        const ref = createRef()

        render(<CompassModern ref={ref}/>)

        expect(ref.current?.closest('svg')?.getAttribute('viewBox')).toBe('4.5 0 122 122')
        expect(ref.current?.querySelector('.lgs-compass-poles-arcs')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-text')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle-north')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle-south')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle-north')?.closest('g')).toBe(ref.current)
        expect(ref.current?.querySelector('.lgs-compass-needle-south')?.closest('g')).toBe(ref.current)
        expect(ref.current?.querySelector('.lgs-compass-needle-north')?.getAttribute('fill')).toBe('var(--lgs-compass-needle-north)')
        expect(ref.current?.querySelector('.lgs-compass-needle-south')?.getAttribute('stroke')).toBe('var(--lgs-compass-needle-south)')
        expect(ref.current?.querySelectorAll('.lgs-compass-poles-arcs path')).toHaveLength(4)
        expect(ref.current?.querySelector('.lgs-compass-poles-arcs')?.getAttribute('stroke-width')).toBe('5')
        expect(ref.current?.querySelector('.lgs-compass-text')?.classList.contains('lgs-compass-poles')).toBe(false)

        expect(ref.current?.querySelector('.lgs-compass-needle-north')?.getAttribute('d')).toContain('M65.5,24')
        expect(ref.current?.querySelector('.lgs-compass-needle-south')?.getAttribute('d')).toBe('M59,77.5 C62.5,81.5 68.5,81.5 72,77.5')

        expect([...ref.current?.querySelectorAll('.lgs-compass-text text') ?? []].map(text => text.textContent)).toEqual([
            'N', 'E', 'S', 'W',
        ])
    })

    it('renders the flat compass artwork with the scaled north marker', () => {
        const ref = createRef()

        render(<CompassFlat ref={ref}/>)

        expect(ref.current?.querySelector('.lgs-compass-background')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-poles')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-text')).not.toBeNull()
        expect(ref.current?.querySelector('.lgs-compass-needle')).not.toBeNull()

        const north = ref.current?.querySelector('.lgs-compass-text text')
        const arrow = ref.current?.querySelector('.lgs-compass-needle-north')

        expect(ref.current?.querySelectorAll('.lgs-compass-text text')).toHaveLength(1)
        expect(north?.textContent).toBe('N')
        expect(north?.getAttribute('font-size')).toBe('66.6667px')
        expect(arrow?.getAttribute('points')).toBe('100,42 125,75.3333 75,75.3333')
    })
})
