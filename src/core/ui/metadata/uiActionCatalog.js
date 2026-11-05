/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: uiActionCatalog.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-03
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const iconProps = (name, variant = 'regular', extraProps = {}) => Object.freeze({name, variant, ...extraProps})
const JOURNEY_ICON = iconProps('route')
const POINT_OF_INTEREST_ICON = iconProps('location-dot')
const POINT_OF_INTEREST_MARKER_ICON = iconProps('location-pin')

/** Reused entity icons that appear across navigation, lists, and detail panels. */
export const UI_ICONS = Object.freeze({
    journey: JOURNEY_ICON,
    pointOfInterest: POINT_OF_INTEREST_ICON,
    pointOfInterestMarker: POINT_OF_INTEREST_MARKER_ICON,
    location: POINT_OF_INTEREST_ICON,
    journeyGroup: iconProps('folder'),
    mapLocation: iconProps('map-location-dot'),
    close: iconProps('xmark'),
    success: iconProps('check'),
    error: iconProps('xmark'),
    warning: iconProps('triangle-exclamation'),
    info: iconProps('circle-info'),
    refresh: iconProps('arrows-rotate'),
    remove: iconProps('trash-can'),
    reset: iconProps('arrow-rotate-left'),
    edit: iconProps('pen-to-square'),
    copyCoordinates: iconProps('copy'),
    paste: iconProps('paste'),
    compass: iconProps('compass'),
    elevationProfile: iconProps('chart-fft'),
    add: iconProps('plus'),
    orbit: iconProps('arrows-rotate'),
    panoramic: iconProps('panorama'),
    show: iconProps('eye'),
    hide: iconProps('eye-slash'),
    hidePOIs: iconProps('mask', 'solid'),
    expand: iconProps('arrows-from-line'),
    reduce: iconProps('arrows-to-line'),
    resetFilter: iconProps('filter-circle-xmark'),
    clearCache: iconProps('trash'),
    alreadyImported: iconProps('xmark'),
    removed: iconProps('trash-can'),
})

/** Shared entity labels for navigation and panel headings. */
export const UI_LABELS = Object.freeze({
    pointsOfInterest: 'Points of Interest',
    pois: 'POIs',
    widgets: 'Widgets',
    clips: 'Clips',
})

/** Shared semantic labels and Web Awesome icon props for user actions and controls. */
export const UI_ACTIONS = Object.freeze({
    close: {
        label: 'Close',
        icon: UI_ICONS.close,
    },
    acknowledgeClose: {
        label: 'Close',
        icon: UI_ICONS.success,
    },
    cancel: {
        label: 'Cancel',
        icon: UI_ICONS.close,
    },
    continue: {
        label: 'Continue',
        icon: {name: 'play', variant: 'regular'},
    },
    add: {
        label: 'Add',
        icon: UI_ICONS.add,
    },
    recenter: {
        label: 'Recenter',
        icon: UI_ICONS.add,
    },
    addJourney: {
        label: 'Add journey',
        icon: UI_ICONS.journey,
    },
    addJourneyGroup: {
        label: 'Add group',
        icon: UI_ICONS.journeyGroup,
    },
    addJourneys: {
        label: 'Add journeys',
        icon: UI_ICONS.journey,
    },
    editJourney: {
        label: 'Edit Journey',
        icon: UI_ICONS.journey,
    },
    exportRoute: {
        label: 'Export as Route',
        icon: UI_ICONS.journey,
    },
    exit: {
        label: 'Exit',
        icon: UI_ICONS.close,
    },
    stop: {
        label: 'Stop',
        icon: UI_ICONS.close,
    },
    stopMotion: {
        label: 'Stop',
        icon: iconProps(UI_ICONS.orbit.name, UI_ICONS.orbit.variant, {animation: 'spin'}),
    },
    selectAction: {
        label: 'Select an action',
        icon: UI_ICONS.pointOfInterest,
    },
    show: {
        label: 'Show',
        icon: UI_ICONS.show,
    },
    hide: {
        label: 'Hide',
        icon: UI_ICONS.hide,
    },
    hidePOIs: {
        label: 'Hide',
        icon: UI_ICONS.hidePOIs,
    },
    showCompassWidget: {
        label: 'Show Compass',
        icon: UI_ICONS.compass,
    },
    showProfileWidget: {
        label: 'Show Profile',
        icon: UI_ICONS.elevationProfile,
    },
    expand: {
        label: 'Expand',
        icon: UI_ICONS.expand,
    },
    reduce: {
        label: 'Reduce',
        icon: UI_ICONS.reduce,
    },
    edit: {
        label: 'Edit',
        icon: UI_ICONS.edit,
    },
    editPOI: {
        label: 'Edit',
        icon: {name: 'location-pen', variant: 'regular'},
    },
    editNearbyPOI: {
        label: 'Edit nearby POI',
        icon: UI_ICONS.edit,
    },
    poiDetails: {
        label: 'Details',
        icon: UI_ICONS.edit,
    },
    movePOI: {
        label: 'Move',
        icon: {name: 'location-dot', variant: 'solid'},
    },
    createPOI: {
        label: 'Create POI',
        icon: UI_ICONS.pointOfInterest,
    },
    managePOIs: {
        label: 'Edit POIs',
        icon: UI_ICONS.pointOfInterest,
    },
    searchLocation: {
        label: 'Search location',
        icon: UI_ICONS.mapLocation,
    },
    setAsStarter: {
        label: 'Set as Starter',
        icon: {name: 'flag', variant: 'regular'},
    },
    remove: {
        label: 'Remove',
        icon: UI_ICONS.remove,
    },
    delete: {
        label: 'Delete',
        icon: UI_ICONS.remove,
    },
    reset: {
        label: 'Reset',
        icon: UI_ICONS.reset,
    },
    linkPOITextAndBorderColors: {
        label: 'Link Text and Border colors',
        icon: iconProps('link-simple'),
    },
    unlinkPOITextAndBorderColors: {
        label: 'Unlink Text and Border colors',
        icon: iconProps('link-simple-slash'),
    },
    reversePOIColors: {
        label: 'Reverse color',
        icon: iconProps('arrow-right-arrow-left'),
    },
    resetReplayAppearance: {
        label: 'Reset Replay appearance to defaults',
        icon: UI_ICONS.reset,
    },
    resetFilter: {
        label: 'Reset',
        icon: UI_ICONS.resetFilter,
    },
    restore: {
        label: 'Restore',
        icon: UI_ICONS.reset,
    },
    undo: {
        label: 'Undo',
        icon: UI_ICONS.reset,
    },
    redo: {
        label: 'Redo',
        icon: {name: 'arrow-rotate-right', variant: 'regular'},
    },
    clearCartographicCache: {
        label: 'Clear cartographic cache',
        icon: UI_ICONS.clearCache,
    },
    resetProfile: {
        label: 'Reset Profile',
        icon: UI_ICONS.refresh,
    },
    restoreDefaults: {
        label: 'Reset to default',
        icon: UI_ICONS.refresh,
    },
    update: {
        label: 'Update',
        icon: UI_ICONS.refresh,
    },
    later: {
        label: 'Later',
        icon: {name: 'hourglass-half', variant: 'regular'},
    },
    install: {
        label: 'Install',
        icon: {name: 'desktop-arrow-down', variant: 'regular'},
    },
    relaunchStudio: {
        label: 'Relaunch Studio',
        icon: UI_ICONS.refresh,
    },
    retry: {
        label: 'Retry',
        icon: UI_ICONS.refresh,
    },
    contactSupport: {
        label: 'Contact Support',
        icon: {name: 'envelope', variant: 'regular'},
    },
    save: {
        label: 'Save',
        icon: UI_ICONS.success,
    },
    validate: {
        label: 'Validate',
        icon: UI_ICONS.success,
    },
    confirm: {
        label: 'Confirm',
        icon: UI_ICONS.success,
    },
    startOrbit: {
        label: 'Start orbit',
        icon: iconProps(UI_ICONS.orbit.name, UI_ICONS.orbit.variant, {animation: 'none'}),
    },
    stopOrbit: {
        label: 'Stop orbit',
        icon: iconProps(UI_ICONS.orbit.name, UI_ICONS.orbit.variant, {animation: 'spin'}),
    },
    orbit: {
        label: 'Orbit',
        icon: UI_ICONS.orbit,
    },
    panoramic: {
        label: 'Panoramic',
        icon: UI_ICONS.panoramic,
    },
    copyCoordinates: {
        label: 'Copy Coords',
        icon: UI_ICONS.copyCoordinates,
    },
    copyPOIStyle: {
        label: 'Copy POI style',
        icon: UI_ICONS.copyCoordinates,
    },
    pastePOIStyle: {
        label: 'Paste POI style',
        icon: UI_ICONS.paste,
    },
})

/** Icons and labels for the direction currently used by rotating scene widgets. */
export const UI_ROTATION_DIRECTIONS = Object.freeze({
    actionLabel: 'Change direction',
    clockwise: {
        label: 'Clockwise',
        icon: iconProps('arrow-rotate-left', 'regular', {animation: 'spin-reverse'}),
    },
    antiClockwise: {
        label: 'Anti-clockwise',
        icon: iconProps('arrow-rotate-right', 'regular', {animation: 'spin'}),
    },
})
