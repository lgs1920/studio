/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: htmlReport.js
 *
 ******************************************************************************/

import { strToU8, zip } from 'fflate'
import { DateTime } from 'luxon'
import {
    CARDINAL_VIEWS,
    MAP_ICON_DEFS,
    PDF_ICON_DEFS,
    STUDIO_CONTACT,
    STUDIO_NAME,
    STUDIO_URL,
} from './constants'
import * as ReportCredits from './credits'
import {
    cssColor,
    escapeHtml,
    finiteNumber,
    formatDateTimeParts,
    formatDuration,
    formatMetric,
    getExportTheme,
    htmlText,
    plainText,
    reportSubtitle,
    slugPart,
} from './format'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    PACE_UNITS,
    SPEED_UNITS,
} from '@Utils/UnitUtils'
import {
    dataUrlToBytes,
    downloadBlob,
    fontAwesomePositionedSVG,
    fontAwesomeSVG,
    loadStudioLogo,
} from './assets'
import {
    directionPoint,
    progressMarkerPlacements,
    scaleTrackInfoToBox,
    svgNumber,
    svgRotationFromScreenAngle,
    validBounds,
} from './geometry'
import {
    formatPOIAltitude,
    formatPOIBadge,
    formatPOICoordinates,
    formatPOIName,
    getJourneyExportContent,
    getPOIBadgeColor,
    REPORT_RENDER_TRACK_POINT_LIMIT,
} from './journeyData'
import { build2DMapSVG } from './mapRender'
import {
    captureJourneyProfileImage,
    colorLuminance,
} from './profile'
import {
    captureJourney3DMapSnapshots,
    currentViewerSnapshot,
    yieldToUI,
} from './snapshots'

export const renderHTMLIcon = key => fontAwesomeSVG(PDF_ICON_DEFS[key], {className: 'table-icon'})

export const zipFiles = (files, options = {}) => new Promise((resolve, reject) => {
    zip(files, options, (error, data) => {
        if (error) {
            reject(error)
            return
        }

        resolve(data)
    })
})

export const zipFilesInWorker = (files, options = {}) => new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
        reject(new Error('Worker is not available.'))
        return
    }

    const worker = new Worker(new URL('./reportZipWorker.js', import.meta.url), {type: 'module'})
    const cleanup = () => worker.terminate()
    worker.onmessage = event => {
        cleanup()
        if (event.data?.error) {
            reject(new Error(event.data.error))
            return
        }

        resolve(event.data?.archive ?? new Uint8Array())
    }
    worker.onerror = error => {
        cleanup()
        reject(error instanceof Error ? error : new Error(error?.message ?? 'Report zip worker failed.'))
    }

    const transferableFiles = {}
    const transfer = []
    Object.entries(files).forEach(([path, content]) => {
        const bytes = content.byteOffset === 0 && content.byteLength === content.buffer.byteLength
                      ? content
                      : content.slice()
        transferableFiles[path] = bytes
        transfer.push(bytes.buffer)
    })
    worker.postMessage({files: transferableFiles, options}, transfer)
})

export const createReportZip = async (files, options = {}) => {
    try {
        return await zipFilesInWorker(files, options)
    }
    catch {
        return await zipFiles(files, options)
    }
}

export const renderHTMLRows = rows => rows
    .filter(row => row?.label && row.value !== undefined && row.value !== null && row.value !== '')
    .map(row => `<tr><th>${renderHTMLIcon(row.icon)}${escapeHtml(row.label)}</th><td>${htmlText(row.value)}</td></tr>`)
    .join('')

export const renderHTMLDataRows = rows => rows
    .filter(Boolean)
    .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')

export const renderPOIBadgeHTML = poi => {
    const badge = formatPOIBadge(poi)
    if (!badge) {
        return ''
    }

    return `<span class="poi-badge" style="--badge-color: ${cssColor(getPOIBadgeColor(poi))}">${escapeHtml(badge)}</span>`
}

export const renderCreditsRows = credits => credits
    .filter(credit => typeof ReportCredits.isReportCreditVisible === 'function' ? ReportCredits.isReportCreditVisible(credit) : true)
    .map(credit => `<tr><th>${escapeHtml(credit.label)}</th><td>${
        credit.url
        ? `<a href="${escapeHtml(credit.url)}" target="_blank" rel="noopener noreferrer">${htmlText(ReportCredits.creditTextSource?.(credit.text) ?? credit.text)}</a>`
        : htmlText(ReportCredits.creditTextSource?.(credit.text) ?? credit.text)
    }</td></tr>`)
    .join('')

export const journeyStatsRows = journey => {
    const {metrics} = journey.getMetrics()

    return [
        {label: 'Distance', value: formatMetric(metrics.distance, {units: DISTANCE_UNITS})},
        {label: 'Duration', value: formatDuration(metrics.duration)},
        {label: 'Moving time', value: formatDuration(metrics.duration - metrics.idleTime)},
        {label: 'Idle time', value: formatDuration(metrics.idleTime)},
        {label: 'Elevation +', value: formatMetric(metrics.positive?.elevation, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Elevation -', value: formatMetric(metrics.negative?.elevation, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Min altitude', value: formatMetric(metrics.minHeight, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Max altitude', value: formatMetric(metrics.maxHeight, {units: ELEVATION_UNITS, format: '%d'})},
        {label: 'Average speed', value: formatMetric(metrics.averageSpeed, {units: SPEED_UNITS})},
        {label: 'Max speed', value: formatMetric(metrics.maxSpeed, {units: SPEED_UNITS})},
        {label: 'Average pace', value: formatMetric(metrics.averagePace, {units: PACE_UNITS})},
        {label: 'Best pace', value: formatMetric(metrics.minPace, {units: PACE_UNITS})},
    ]
}

export const buildHTMLNorthArrow = ({rotation = 0, theme, color = theme.text}) => {
    const center = {
        x: 80,
        y: 80,
    }
    const textColor = escapeHtml(color)
    const iconWidth = 44
    const iconHeight = 17
    const tip = directionPoint(center, rotation, iconWidth / 2)
    const label = directionPoint(tip, rotation, 18)
    const icon = fontAwesomePositionedSVG({
                                              iconDefinition: MAP_ICON_DEFS.north,
                                              className:      'map-north-arrow-icon',
                                              x:              center.x - iconWidth / 2,
                                              y:              center.y - iconHeight / 2,
                                              width:          iconWidth,
                                              height:         iconHeight,
                                              color:          textColor,
                                              rotation:       svgRotationFromScreenAngle(rotation, 90),
                                          })

    return `<svg class="map-north-arrow" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
        ${icon}
        <text x="${svgNumber(label.x)}" y="${svgNumber(label.y)}" fill="${textColor}" text-anchor="middle" dominant-baseline="central">N</text>
    </svg>`
}

export const renderHTMLProgressMarkers = (asset, theme) => {
    const width = finiteNumber(asset.width)
    const height = finiteNumber(asset.height)
    if (!asset.trackInfo || !validBounds(asset.trackInfo.bounds) || width === null || height === null || width <= 0 || height <= 0) {
        return ''
    }

    const size = 4.6
    const container = {
        x:      0,
        y:      0,
        width:  100,
        height: 100,
    }
    const trackInfo = scaleTrackInfoToBox(asset.trackInfo, {width, height}, container)
    const positions = progressMarkerPlacements({
                                                 trackInfo,
                                                 container,
                                                 size,
                                                 gap: 1.5,
                                             })
    return positions.map(position => {
        const color = escapeHtml(cssColor(position.color ?? asset.progressColor ?? theme.text))
        return `
                            <span class="map-progress-marker" style="left: ${svgNumber(position.x + size / 2)}%; top: ${svgNumber(position.y + size / 2)}%; --progress-rotation: ${svgNumber(svgRotationFromScreenAngle(position.angle))}deg; color: ${color};">
                                ${fontAwesomeSVG(MAP_ICON_DEFS.progress, {className: 'map-progress-icon'})}
                            </span>`
    }).join('')
}

export const renderMapCards = (assets, theme) => assets.map(asset => {
    const northRotation = finiteNumber(asset.northRotation)
    const northArrow = northRotation === null
                       ? ''
                       : buildHTMLNorthArrow({rotation: northRotation, theme, color: asset.arrowColor ?? theme.text})
    const progressMarkers = renderHTMLProgressMarkers(asset, theme)
    const credits = asset.creditsOverlayHTML
                    ? `<div class="map-credit-overlay">${asset.creditsOverlayHTML}</div>`
                    : ''

    return `
                <article class="map-card">
                    <h3>${escapeHtml(asset.title)}</h3>
                    <div class="map-image-frame">
                        <img src="${escapeHtml(asset.path)}" alt="${escapeHtml(asset.title)}">
                        ${northArrow}
                        ${progressMarkers}
                        ${credits}
                    </div>
                </article>`
}).join('')

export const buildJourneyHTML = ({journey, pois, twoDMapAssets, threeDMapAssets, logoPath, profileImagePath, theme, credits = []}) => {
    const title = plainText(journey?.title || 'Journey')
    const subtitle = reportSubtitle(journey)
    const dateTime = formatDateTimeParts(journey.getDate())
    const tracks = Array.from(journey.tracks?.values?.() ?? [])
    const introRows = renderHTMLRows([
        {label: 'Location', value: journey.location, icon: 'location'},
        {label: 'Date', value: dateTime.date, icon: 'date'},
        {label: 'Time', value: dateTime.time, icon: 'time'},
        {label: 'Activity', value: journey.activitySettings?.label ?? journey.activity, icon: 'activity'},
        {label: 'Tracks', value: journey.tracks?.size ?? 0, icon: 'route'},
        {label: 'POIs', value: pois.length, icon: 'location'},
    ])
    const trackRows = renderHTMLDataRows(tracks.map((track, index) => [
        escapeHtml(`${index + 1}`),
        htmlText(track.title || 'Track'),
        htmlText(formatMetric(track.metrics?.global?.distance, {units: DISTANCE_UNITS})),
        htmlText(track.description),
    ]))
    const poiRows = renderHTMLDataRows(pois.map(poi => [
        renderPOIBadgeHTML(poi),
        htmlText(formatPOIName(poi)),
        htmlText(formatPOICoordinates(poi)),
        htmlText(formatPOIAltitude(poi)),
        htmlText(poi.description),
    ]))
    const twoDMapCards = renderMapCards(twoDMapAssets, theme)
    const threeDMapCards = renderMapCards(threeDMapAssets, theme)
    const creditsRows = renderCreditsRows(credits)
    const logo = logoPath
                 ? `<a class="logo-link" href="${STUDIO_URL}"><img src="${escapeHtml(logoPath)}" alt="${STUDIO_NAME}"></a>`
                 : ''
    const profile = profileImagePath
                    ? `<figure class="profile-card"><img src="${escapeHtml(profileImagePath)}" alt="Elevation profile"></figure>`
                    : ''
    const logoFilter = colorLuminance(theme.background) < 0.5 ? 'brightness(0) invert(1)' : 'none'

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} - ${STUDIO_NAME}</title>
    <style>
        :root {
            color-scheme: light dark;
            --background: ${theme.background};
            --surface: ${theme.surface};
            --header-surface: ${theme.headerSurface};
            --text: ${theme.text};
            --muted: ${theme.muted};
            --line: ${theme.line};
            --brand: ${theme.brand};
            --brand-on: ${theme.brandOn};
            --link: ${theme.link};
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: var(--background);
            color: var(--text);
            font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        main {
            width: min(1120px, calc(100% - 48px));
            margin: 0 auto;
            padding: 32px 0 48px;
        }
        header, footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
        }
        header {
            padding-bottom: 22px;
            border-bottom: 1px solid var(--line);
        }
        h1, h2, h3 { margin: 0; line-height: 1.2; }
        h1 { font-size: 42px; font-weight: 780; }
        .report-subtitle {
            margin: 10px 0 0;
            color: var(--text);
            font-size: 21px;
            line-height: 1.25;
        }
        h2 { font-size: 19px; font-weight: 750; }
        h3 { font-size: 14px; font-weight: 750; }
        section {
            padding: 28px 0;
            border-bottom: 1px solid var(--line);
        }
        .logo-link img {
            display: block;
            width: 150px;
            height: auto;
            filter: ${logoFilter};
        }
        .signature {
            margin: 8px 0 0;
            color: var(--muted);
        }
        .journey-summary {
            display: grid;
            grid-template-columns: ${profile ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr'};
            align-items: stretch;
            gap: 16px;
            margin-top: 14px;
        }
        .journey-summary table {
            margin-top: 0;
        }
        .profile-card {
            display: flex;
            align-items: stretch;
            overflow: hidden;
            margin: 0;
            border: 1px solid var(--line);
            border-radius: 6px;
            background: var(--surface);
        }
        .profile-card img {
            display: block;
            width: 100%;
            object-fit: cover;
        }
        .map-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 16px;
        }
        .map-card {
            border: 1px solid var(--line);
            border-radius: 6px;
            overflow: hidden;
            background: var(--surface);
        }
        .map-card h3 {
            padding: 10px 12px;
            border-bottom: 1px solid var(--line);
            background: var(--header-surface);
            color: var(--brand);
        }
        .map-card img {
            display: block;
            width: 100%;
            height: auto;
        }
        .map-image-frame {
            position: relative;
            line-height: 0;
        }
        .map-north-arrow {
            position: absolute;
            top: 33.333%;
            right: 12px;
            width: 58px;
            height: 58px;
            transform: translateY(-50%);
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .18));
        }
        .map-north-arrow text {
            font: 800 31px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .map-progress-marker {
            position: absolute;
            display: inline-grid;
            place-items: center;
            width: 20px;
            height: 20px;
            transform: translate(-50%, -50%) rotate(var(--progress-rotation, 0deg));
            transform-origin: center;
            filter: drop-shadow(0 1px 2px rgba(255, 255, 255, .45)) drop-shadow(0 1px 2px rgba(0, 0, 0, .2));
            line-height: 1;
        }
        .map-progress-icon {
            display: block;
            width: 100%;
            height: 100%;
            fill: currentColor;
        }
        .map-credit-overlay {
            position: absolute;
            right: 10px;
            bottom: 8px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 4px;
            max-width: min(72%, 560px);
            padding: 4px 7px;
            border-radius: 4px;
            background: rgba(255, 255, 255, .82);
            color: #111111;
            font-size: 10px;
            line-height: 1.25;
            white-space: normal;
        }
        .map-credit-overlay img {
            display: block;
            max-width: 120px;
            max-height: 24px;
            width: auto;
            height: auto;
        }
        .map-credit-overlay a {
            color: #111111;
            text-decoration: none;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
        }
        th, td {
            border: 1px solid var(--line);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
        }
        th {
            width: 28%;
            background: var(--header-surface);
            color: var(--brand);
            font-weight: 750;
        }
        thead th {
            width: auto;
        }
        .table-icon {
            width: 1.05em;
            height: 1.05em;
            margin-right: 0.38em;
            fill: currentColor;
            vertical-align: -0.18em;
        }
        .poi-badge {
            display: inline-grid;
            place-items: center;
            min-width: 24px;
            height: 24px;
            padding: 0 7px;
            border-radius: 999px;
            background: var(--badge-color, var(--brand));
            color: #ffffff;
            font-weight: 750;
            line-height: 1;
        }
        .description {
            max-width: 820px;
            white-space: normal;
        }
        footer {
            padding-top: 20px;
            color: var(--muted);
        }
        footer nav {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-left: auto;
        }
        .footer-icon-link {
            display: inline-grid;
            place-items: center;
            width: 28px;
            height: 28px;
            color: var(--link);
        }
        .footer-icon-link svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
        }
        a { color: var(--link); text-decoration: none; }
        a:hover { text-decoration: underline; }
        @media (max-width: 760px) {
            main { width: min(100% - 28px, 1120px); padding-top: 20px; }
            header, footer { align-items: flex-start; flex-direction: column; }
            .journey-summary { grid-template-columns: 1fr; }
            .map-grid { grid-template-columns: 1fr; }
            footer nav { margin-left: 0; flex-wrap: wrap; }
        }
    </style>
</head>
<body>
    <main>
        <header>
            <div>
                <h1>${escapeHtml(title)}</h1>
                ${subtitle ? `<p class="report-subtitle">${escapeHtml(subtitle)}</p>` : ''}
                <p class="signature">Proudly made with <a href="${STUDIO_URL}" target="_blank" rel="noopener noreferrer">${STUDIO_NAME}</a></p>
            </div>
            ${logo}
        </header>

        <section>
            <h2>Journey</h2>
            <div class="journey-summary">
                <table><tbody>${introRows}</tbody></table>
                ${profile}
            </div>
        </section>

        <section>
            <h2>Stats</h2>
            <table><tbody>${renderHTMLRows(journeyStatsRows(journey))}</tbody></table>
        </section>

        ${plainText(journey.description) ? `<section><h2>Description</h2><p class="description">${htmlText(journey.description)}</p></section>` : ''}

        ${tracks.length > 0 ? `<section>
            <h2>Tracks</h2>
            <table>
                <thead><tr><th>#</th><th>Name</th><th>Distance</th><th>Description</th></tr></thead>
                <tbody>${trackRows}</tbody>
            </table>
        </section>` : ''}

        ${pois.length > 0 ? `<section>
            <h2>POIs</h2>
            <table>
                <thead><tr><th>POI</th><th>Name</th><th>Coordinates (lat,long)</th><th>${renderHTMLIcon('mountains')}Altitude</th><th>Description</th></tr></thead>
                <tbody>${poiRows}</tbody>
            </table>
        </section>` : ''}

        <section>
            <h2>2D</h2>
            <div class="map-grid">${twoDMapCards || '<p>No 2D snapshot available.</p>'}</div>
        </section>

        <section>
            <h2>3D</h2>
            <div class="map-grid">${threeDMapCards || '<p>No 3D snapshot available.</p>'}</div>
        </section>

        <section>
            <h2>Credits</h2>
            <table><tbody>${creditsRows}</tbody></table>
        </section>

        <footer>
            <span>Created on ${DateTime.now().toLocaleString(DateTime.DATETIME_MED)}</span>
            <nav>
                <a class="footer-icon-link" href="${STUDIO_URL}" aria-label="${escapeHtml(STUDIO_URL)}" title="${escapeHtml(STUDIO_URL)}">${fontAwesomeSVG(PDF_ICON_DEFS.site)}</a>
                <a class="footer-icon-link" href="mailto:${STUDIO_CONTACT}" aria-label="${escapeHtml(STUDIO_CONTACT)}" title="${escapeHtml(STUDIO_CONTACT)}">${fontAwesomeSVG(PDF_ICON_DEFS.mail)}</a>
            </nav>
        </footer>
    </main>
</body>
</html>`
}

export const exportJourneyToHTMLZip = async (journey, {
    pois = undefined,
    fileName = 'journey.zip',
    onReportStage = null,
} = {}) => {
    const setReportStage = stage => {
        try {
            onReportStage?.(stage)
        }
        catch (error) {
            console.error(error)
        }
    }
    const {
              trackDrawings,
              endpointMarkers,
              exportablePois,
              listedPois,
          } = getJourneyExportContent(journey, pois, {
        trackDrawingOptions: {maxTotalPoints: REPORT_RENDER_TRACK_POINT_LIMIT},
    })

    if (trackDrawings.length === 0) {
        throw new Error('No track geometry to export.')
    }

    const theme = getExportTheme()
    const viewerSnapshot = await currentViewerSnapshot()
    await yieldToUI()
    const studioLogoPromise = loadStudioLogo()
    const profileImagePromise = captureJourneyProfileImage({
                                                                                                        journey,
                                                                                                        trackDrawings,
                                                                                                        backgroundSnapshot: viewerSnapshot,
                                                                                                        theme,
                                                                                                    })
    const mapSnapshotsPromise = captureJourney3DMapSnapshots(journey, {
        trackDrawings,
        onSnapshotFlash: ({index}) => setReportStage({
            stage: 'snapshots',
            id:    `snapshot-${index}-${Date.now()}`,
        }),
    })
        .finally(() => setReportStage('writing'))
    const [studioLogo, profileImage, mapSnapshots] = await Promise.all([
                                                                          studioLogoPromise,
                                                                          profileImagePromise,
                                                                          mapSnapshotsPromise,
                                                                      ])
    const reportCredits = ReportCredits.getReportCredits()
    await yieldToUI()
    const files = {}
    const twoDMapAssets = CARDINAL_VIEWS.map(view => {
        const path = `images/map-2d-${slugPart(view.label)}.svg`
        files[path] = strToU8(build2DMapSVG({
                                                view,
                                                trackDrawings,
                                                pois: exportablePois,
                                                endpointMarkers,
                                                theme,
                                            }))
        return {
            path,
            title: view.label,
        }
    })
    const threeDMapAssets = mapSnapshots.map(snapshot => {
        const path = `images/map-3d-${slugPart(snapshot.view?.label)}.png`
        files[path] = dataUrlToBytes(snapshot.dataUrl)
        return {
            path,
            title: snapshot.view?.label ?? '3D',
            northRotation: snapshot.view?.heading ?? 0,
            width: snapshot.width,
            height: snapshot.height,
            trackInfo: snapshot.trackInfo,
            arrowColor: theme.brand,
            progressColor: theme.text,
        }
    })
    const logoPath = studioLogo?.dataUrl ? 'images/logo-lgs1920-studio.png' : ''
    if (logoPath) {
        files[logoPath] = dataUrlToBytes(studioLogo.dataUrl)
    }
    const profileImagePath = profileImage?.dataUrl ? 'images/elevation-profile.png' : ''
    if (profileImagePath) {
        files[profileImagePath] = dataUrlToBytes(profileImage.dataUrl)
    }

    await yieldToUI()
    files['index.html'] = strToU8(buildJourneyHTML({
                                                       journey,
                                                       pois: listedPois,
                                                       twoDMapAssets,
                                                       threeDMapAssets,
                                                       logoPath,
                                                       profileImagePath,
                                                       theme,
                                                       credits: reportCredits,
                                                   }))

    await yieldToUI()
    const archive = await createReportZip(files, {level: 6})
    downloadBlob(archive, fileName, 'application/zip')

    return {
        fileName,
        poiCount:         listedPois.length,
        imageCount:       twoDMapAssets.length + threeDMapAssets.length + (logoPath ? 1 : 0) + (profileImagePath ? 1 : 0),
        mapSnapshotCount: threeDMapAssets.length,
    }
}
