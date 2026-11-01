/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiEditorTabSessionStore.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { proxy } from 'valtio'

const STORAGE_KEY = 'lgs1920.studio.poi-editor.active-tab.v1'
const DEFAULT_TAB = 'details'
const VALID_TABS = new Set(['details', 'content', 'decoration'])

/** Read the last POI editor tab for this browser session, falling back safely when storage is unavailable. */
const readSessionTab = () => {
    try {
        const storedTab = globalThis.sessionStorage?.getItem(STORAGE_KEY)
        return VALID_TABS.has(storedTab) ? storedTab : DEFAULT_TAB
    }
    catch {
        return DEFAULT_TAB
    }
}

/** Shared state keeps every mounted POI editor on the same tab. */
export const poiEditorTabSessionStore = proxy({activeTab: readSessionTab()})

/** Persist a valid POI editor tab without making browser storage availability a rendering requirement. */
export const setPOIEditorActiveTab = tab => {
    if (!VALID_TABS.has(tab)) {
        return
    }

    poiEditorTabSessionStore.activeTab = tab
    try {
        globalThis.sessionStorage?.setItem(STORAGE_KEY, tab)
    }
    catch {
        // Keep the shared in-memory session state when browser storage is blocked.
    }
}

/** Resolve the POI-specific Web Awesome panel name from the shared logical tab. */
export const getPOIEditorPanelName = (poiId, tab) => {
    const panelPrefixes = {
        details: 'poi-edit',
        content: 'poi-content',
        decoration: 'poi-style',
    }
    const prefix = panelPrefixes[tab] ?? panelPrefixes[DEFAULT_TAB]
    return `${prefix}-${poiId}`
}

/** Convert a POI-specific panel name back to its shared logical tab. */
export const getPOIEditorTabFromPanelName = (poiId, panelName) => {
    const tabs = {
        details: getPOIEditorPanelName(poiId, 'details'),
        content: getPOIEditorPanelName(poiId, 'content'),
        decoration: getPOIEditorPanelName(poiId, 'decoration'),
    }

    return Object.entries(tabs).find(([, name]) => name === panelName)?.[0] ?? null
}
