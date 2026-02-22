/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ColorElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-22
 * Last modified: 2026-02-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlColorPicker, SlRange } from '@shoelace-style/shoelace/dist/react'
import { colord }         from 'colord'
import React, { useMemo } from 'react'

/**
 * Standardized color and opacity control element.
 */
export const ColorElement = ({
                                 label,
                                 path,
                                 part,
                                 swatches,
                                 getColor,
                                 updateValue,
                             }) => {

    /**
     * Résolution de la couleur via le parent.
     * getColor renvoie déjà une chaîne RGBA (ex: "rgba(255, 0, 0, 0.5)")
     */
    const resolvedColor = useMemo(() => getColor(part, path), [part, path, getColor])

    /**
     * Instance colord pour extraire les données proprement.
     */
    const colorObj = useMemo(() => colord(resolvedColor), [resolvedColor])

    /**
     * Pour le picker, on force l'alpha à 1 (Hex) pour l'affichage de la pastille.
     */
    const colorForPicker = useMemo(() => {
        return colorObj.isValid() ? colorObj.alpha(1).toHex() : resolvedColor
    }, [colorObj, resolvedColor])

    /**
     * CORRECTION : L'opacité pour le slider.
     * Si le store (part.opacity) est défini, on l'utilise.
     * Sinon, on extrait l'alpha de la couleur résolue (la variable CSS).
     */
    const opacityValue = useMemo(() => {
        if (part.opacity !== undefined && part.opacity !== null) {
            return part.opacity
        }
        return colorObj.alpha()
    }, [part.opacity, colorObj])


    return (
        <React.Fragment>
            <div className="drawer-horizontal-line"><span>{label}</span></div>
            <div className="drawer-horizontal-line three-columns">
                <div className="drawer-horizontal-element">
                    <SlColorPicker
                        size="small"
                        swatches={swatches}
                        value={colorForPicker}
                        onSlInput={(e) => updateValue(`${path}.color`, e.target.value)}
                    />
                </div>
                <div className="drawer-horizontal-element xlarge-element"></div>
                <div className="drawer-horizontal-element xlarge-element">
                    <SlRange
                        label="Opacity"
                        min="0"
                        max="1"
                        step="0.05"
                        align-right
                        tooltip="top"
                        tooltipFormatter={v => `${Math.floor(v * 100)}%`}
                        value={opacityValue}
                        onSlInput={(e) => updateValue(`${path}.opacity`, parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </React.Fragment>
    )
}