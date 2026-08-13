/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: tiles3d-error-labels.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-13
 * Last modified: 2026-07-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    addTiles3DErrorLabel, aggregateSlippyTileForCamera, cameraHeightToSlippyLevel, parseSlippyTileContentUrl,
    removeTiles3DErrorLabels, slippyTileCenterToDegrees,
} from '@Utils/cesium/Tiles3DErrorLabels'
import { describe, expect, it, vi } from 'vitest'

const fakeViewer = ({cameraHeight} = {}) => {
    const values = []

    return {
        camera: {
            positionCartographic: {
                height: cameraHeight,
            },
        },
        entities: {
            values,
            add:     vi.fn(entity => {
                values.push(entity)
                return entity
            }),
            getById: vi.fn(id => values.find(entity => entity.id === id)),
            remove:  vi.fn(entity => {
                const index = values.indexOf(entity)
                if (index >= 0) {
                    values.splice(index, 1)
                }
            }),
        },
        scene: {
            requestRender: vi.fn(),
        },
    }
}

const mockCanvas = () => {
    const canvas = {
        width:     0,
        height:    0,
        toDataURL: vi.fn(() => 'data:image/png;base64,error-label'),
    }
    const context = {
        arcTo:       vi.fn(),
        beginPath:   vi.fn(),
        closePath:   vi.fn(),
        fill:        vi.fn(),
        fillText:    vi.fn(),
        measureText: vi.fn(() => ({width: 128})),
        moveTo:      vi.fn(),
        font:        '',
        fillStyle:   '',
        textAlign:   '',
        textBaseline: '',
    }
    canvas.getContext = vi.fn(() => context)

    const originalCreateElement = document.createElement.bind(document)
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
        if (tagName === 'canvas') {
            return canvas
        }
        return originalCreateElement(tagName, options)
    })

    return {canvas, context, createElement}
}

describe('Tiles3DErrorLabels', () => {
    it('parses Re:Earth content tile URLs', () => {
        expect(parseSlippyTileContentUrl('https://buildings.reearth.land/v5-add/13/4227/2941.glb')).toEqual({
            level: 13,
            x:     4227,
            y:     2941,
        })
    })

    it('converts slippy tile coordinates to the tile center', () => {
        const center = slippyTileCenterToDegrees({level: 13, x: 4227, y: 2941})

        expect(center.longitude).toBeCloseTo(5.7788, 3)
        expect(center.latitude).toBeCloseTo(45.1665, 3)
    })

    it('aggregates fine tile failures into coarser parents when the camera is far', () => {
        expect(cameraHeightToSlippyLevel(50000)).toBe(9)
        expect(aggregateSlippyTileForCamera({level: 13, x: 4227, y: 2941}, 50000)).toEqual({
            level: 9,
            x:     264,
            y:     183,
        })
    })

    it('keeps tile-level labels when the camera is very close', () => {
        const tile = {level: 14, x: 8452, y: 5880}

        expect(aggregateSlippyTileForCamera(tile, 100)).toEqual(tile)
    })

    it('forces tile-level labels below the configured camera height', () => {
        const tile = {level: 14, x: 8452, y: 5880}

        expect(aggregateSlippyTileForCamera(tile, 4000, {perTileMaxHeight: 5000})).toEqual(tile)
        expect(aggregateSlippyTileForCamera(tile, 6000, {perTileMaxHeight: 5000})).toEqual({
            level: 12,
            x:     2113,
            y:     1470,
        })
    })

    it('keeps multiple sibling tile labels below the configured camera height', () => {
        const {createElement} = mockCanvas()
        const viewer = fakeViewer({cameraHeight: 4000})
        const layer = {
            id:      'reearth-buildings',
            tiles3d: {
                errorLabel:                 'Re:Earth Buildings server error',
                errorLabelPerTileMaxHeight: 5000,
            },
        }

        try {
            const first = addTiles3DErrorLabel({
                                                   viewer,
                                                   layer,
                                                   error: {
                                                       url: 'https://buildings.reearth.land/v5-add/14/8452/5880.glb',
                                                   },
                                               })
            const second = addTiles3DErrorLabel({
                                                    viewer,
                                                    layer,
                                                    error: {
                                                        url: 'https://buildings.reearth.land/v5-add/14/8453/5880.glb',
                                                    },
                                                })

            expect(first.id).toBe('tiles3d-error-label-reearth-buildings-14-8452-5880')
            expect(second.id).toBe('tiles3d-error-label-reearth-buildings-14-8453-5880')
            expect(viewer.entities.values).toEqual([first, second])
            expect(viewer.entities.remove).not.toHaveBeenCalled()
        }
        finally {
            createElement.mockRestore()
        }
    })

    it('adds a deduplicated scene label for failed 3D tiles', () => {
        document.documentElement.style.setProperty('--wa-color-danger-fill-normal', 'rgb(180, 20, 30)')
        document.documentElement.style.setProperty('--wa-color-danger-on-normal', 'rgb(255, 245, 245)')
        document.documentElement.style.setProperty('--lgs-gutter-xs', '8px')
        const {canvas, context, createElement} = mockCanvas()
        const viewer = fakeViewer()
        const layer = {
            id:       'reearth-buildings',
            name:     'Buildings',
            provider: 'reearth',
            tiles3d:  {
                errorLabel: 'Re:Earth Buildings server error',
            },
        }
        const error = {
            url:     'https://buildings.reearth.land/v5-add/13/4227/2941.glb',
            message: 'Request has failed. Status Code: 500',
        }

        try {
            const first = addTiles3DErrorLabel({viewer, layer, error})
            const second = addTiles3DErrorLabel({viewer, layer, error})

            expect(first).toBe(second)
            expect(viewer.entities.add).toHaveBeenCalledTimes(1)
            expect(first.id).toBe('tiles3d-error-label-reearth-buildings-13-4227-2941')
            expect(first.label).toBeUndefined()
            expect(first.billboard.image).toBe('data:image/png;base64,error-label')
            expect(first.position).toBeTruthy()
            expect(canvas.width).toBe(144)
            expect(canvas.height).toBe(30)
            expect(context.arcTo).toHaveBeenCalledWith(144, 0, 144, 30, 8)
            expect(context.fillStyle).toBe('rgb(255,245,245)')
            expect(context.fillText).toHaveBeenCalledWith('Re:Earth Buildings server error', 72, 15)
            expect(viewer.scene.requestRender).toHaveBeenCalledTimes(1)
        }
        finally {
            createElement.mockRestore()
            document.documentElement.style.removeProperty('--wa-color-danger-fill-normal')
            document.documentElement.style.removeProperty('--wa-color-danger-on-normal')
            document.documentElement.style.removeProperty('--lgs-gutter-xs')
        }
    })

    it('deduplicates sibling tile failures into one far-camera label', () => {
        document.documentElement.style.setProperty('--lgs-gutter-xs', '8px')
        const {createElement} = mockCanvas()
        const viewer = fakeViewer()
        const layer = {
            id:      'reearth-buildings',
            tiles3d: {
                errorLabel: 'Re:Earth Buildings server error',
            },
        }

        try {
            const detailed = addTiles3DErrorLabel({
                                                      viewer,
                                                      layer,
                                                      error: {
                                                          url: 'https://buildings.reearth.land/v5-add/13/4227/2941.glb',
                                                      },
                                                  })
            expect(detailed.id).toBe('tiles3d-error-label-reearth-buildings-13-4227-2941')
            viewer.camera.positionCartographic.height = 50000
            const aggregate = addTiles3DErrorLabel({
                                                       viewer,
                                                       layer,
                                                       error: {
                                                           url: 'https://buildings.reearth.land/v5-add/13/4230/2942.glb',
                                                       },
                                                   })
            const duplicate = addTiles3DErrorLabel({
                                                       viewer,
                                                       layer,
                                                       error: {
                                                           url: 'https://buildings.reearth.land/v5-add/13/4231/2943.glb',
                                                       },
                                                   })

            expect(aggregate).toBe(duplicate)
            expect(aggregate.id).toBe('tiles3d-error-label-reearth-buildings-9-264-183')
            expect(viewer.entities.remove).toHaveBeenCalledWith(detailed)
            expect(viewer.entities.values).toEqual([aggregate])
            expect(viewer.entities.add).toHaveBeenCalledTimes(2)
        }
        finally {
            createElement.mockRestore()
            document.documentElement.style.removeProperty('--lgs-gutter-xs')
        }
    })

    it('removes labels belonging to the selected tileset layer', () => {
        const viewer = fakeViewer()
        const {createElement} = mockCanvas()
        const layer = {
            id:      'reearth-buildings',
            tiles3d: {errorLabel: 'Re:Earth Buildings server error'},
        }

        try {
            addTiles3DErrorLabel({
                                     viewer,
                                     layer,
                                     error: {
                                         url: 'https://buildings.reearth.land/v5-add/13/4227/2941.glb',
                                     },
                                 })

            expect(removeTiles3DErrorLabels(viewer, 'reearth-buildings')).toBe(1)
            expect(viewer.entities.values).toHaveLength(0)
        }
        finally {
            createElement.mockRestore()
        }
    })
})
