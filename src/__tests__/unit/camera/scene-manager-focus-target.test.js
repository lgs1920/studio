/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: scene-manager-focus-target.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-06
 * Last modified: 2026-09-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CURRENT_JOURNEY } from '@Core/constants'
import { SceneManager }    from '@Core/ui/SceneManager'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SceneManager focus target persistence identity', () => {
    afterEach(() => {
        SceneManager.instance = undefined
        vi.unstubAllGlobals()
    })

    it('keeps the journey identity when focusing its centroid', () => {
        const journey = {
            element: CURRENT_JOURNEY,
            slug:    'journey-a',
        }
        const rotate = {target: null}
        vi.stubGlobal('lgs', {
                              stores: {
                                  ui: {
                                      mainUI: {
                                          rotate,
                                      },
                                  },
                              },
                          })
        vi.stubGlobal('__', {
                             ui: {
                                 cameraManager: {},
                             },
                         })

        const manager = new SceneManager()
        manager.focusPreProcessing(
            {longitude: 5, latitude: 45, height: 1200},
            {target: journey, rotate: true},
        )

        expect(rotate.target).toMatchObject({
                                                element:   CURRENT_JOURNEY,
                                                slug:      'journey-a',
                                                longitude: 5,
                                                latitude:  45,
                                                height:    1200,
                                            })
    })
})
