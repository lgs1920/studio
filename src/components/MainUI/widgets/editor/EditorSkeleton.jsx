/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditorSkeleton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-12
 * Last modified: 2026-04-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlSkeleton }         from '@shoelace-style/shoelace/dist/react'
import { WaCard, WaSkeleton } from '@web.awesome.me/webawesome-pro/dist/react'

/**
 * A placeholder component that mimics the layout of a widget editor.
 * Used as a fallback during Suspense.
 */
export const EditorSkeleton = () => {
    return (
        <WaCard className="lgs--skeleton-container" appearance="plain">
            {/* Simulation of a text input or toolbar area */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sl-spacing-x-small)'}}>
                <WaSkeleton effect="pulse" style={{width: '30%', height: '1rem'}}/>
                <WaSkeleton effect="pulse" style={{width: '100%', height: '2.5rem'}}/>
            </div>

            {/* Simulation of control rows (Switches or Ranges) */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sl-spacing-medium)'}}>
                {[1, 2, 3].map((i) => (
                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <WaSkeleton effect="pulse" style={{width: '40%', height: '1.2rem'}}/>
                        <WaSkeleton effect="pulse" style={{width: '15%', height: '1.2rem'}}/>
                    </div>
                ))}
            </div>

            {/* Simulation of a larger specialized area (e.g., Color Picker or Preview) */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sl-spacing-x-small)'}}>
                <WaSkeleton effect="pulse" style={{width: '25%', height: '1rem'}}/>
                <WaSkeleton effect="pulse"
                            style={{width: '100%', height: '6rem', borderRadius: 'var(--wa-border-radius-m)'}}/>
            </div>
        </WaCard>
    )
}