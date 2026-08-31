/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: layerCredits.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-18
 * Last modified: 2026-08-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const LAYER_CREDIT_FIELDS = ['credits', 'logo', 'url']

/**
 * Determines whether a layer defines an attribution that should override its provider attribution.
 *
 * @param {Object|null|undefined} layer - Layer configuration to inspect.
 * @returns {boolean} True when the layer contains at least one credit field.
 */
export const hasLayerSpecificCredit = layer => LAYER_CREDIT_FIELDS.some(field => {
    const value = layer?.[field]
    return typeof value === 'string' ? value.trim() !== '' : Boolean(value)
})

/**
 * Resolves the effective attribution for a layer and its provider.
 *
 * Layer fields override provider fields while preserving provider fields that are not overridden. This keeps the
 * existing provider configuration compatible with partial layer-specific attributions.
 *
 * @param {Object|null|undefined} layer - Layer configuration.
 * @param {Object|null|undefined} provider - Provider configuration.
 * @returns {Object|null} Resolved attribution data or null when neither input exists.
 */
export const resolveLayerCredit = (layer, provider) => {
    if (!layer && !provider) {
        return null
    }

    const layerSpecific = hasLayerSpecificCredit(layer)
    const source = layerSpecific ? Object.assign({}, provider ?? {}, layer) : provider
    if (!source) {
        return null
    }

    return Object.assign({}, source, {
        providerId:      provider?.id ?? null,
        layerId:         layer?.id ?? null,
        isLayerSpecific: layerSpecific,
    })
}

/**
 * Returns the human-readable text for a resolved attribution.
 *
 * @param {Object|null|undefined} credit - Resolved attribution data.
 * @returns {string} Attribution text.
 */
export const layerCreditText = credit => credit?.credits
                                           || credit?.name
                                           || credit?.fullname
                                           || credit?.id
                                           || ''

/**
 * Builds a stable identity for duplicate attribution detection.
 *
 * @param {Object|null|undefined} credit - Resolved attribution data.
 * @returns {string} Normalized attribution identity.
 */
export const layerCreditKey = credit => [
    layerCreditText(credit),
    credit?.logo ?? '',
    credit?.url ?? '',
].map(value => `${value}`.trim().toLowerCase()).join('|')
