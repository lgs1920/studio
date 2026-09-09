/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShortcutsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-09-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }      from '@Components/MainUI/LGSScrollbars'
import { LGSPopup }           from '@Components/LGSPopup'
import { OS_ICONS }           from '@Core/constants'
import { SHORTCUTS } from '@Core/events/appShortcuts'
import { UIToast }            from '@Utils/UIToast'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, useCallback, useRef, useState } from 'react'

const MOUSE_TOKEN_ICONS = {
    'Double click':     'computer-mouse-button-left',
    'Double tap':       'hand-pointer',
    'Left click':       'computer-mouse-button-left',
    'Left drag':        'computer-mouse-button-left',
    'Long tap':         'hand-pointer',
    'Right click':      'computer-mouse-button-right',
    'Middle drag':      'computer-mouse-scrollwheel',
    Pinch:              'hand-pointer',
    'Right drag':       'computer-mouse-button-right',
    Tap:                'hand-pointer',
    'Trackpad scroll':  'computer-mouse-scrollwheel',
    Wheel:              'computer-mouse-scrollwheel',
}
const PLATFORM_ICONS = [
    {key: 'macos', pattern: /mac/i, label: 'macOS'},
    {key: 'windows', pattern: /windows/i, label: 'Windows'},
    {key: 'linux', pattern: /linux/i, label: 'Linux'},
]
const KEY_TOKEN_LABELS = {
    ArrowDown:  '↓',
    ArrowLeft:  '←',
    ArrowRight: '→',
    ArrowUp:    '↑',
    Minus:      '-',
    Plus:       '+',
}

/**
 * Check whether an entry contains a composed key binding.
 *
 * @param {string[]} keys - Alternative shortcut bindings.
 * @returns {boolean} Whether at least one binding combines multiple keys.
 */
const hasComposedShortcut = keys => keys.some(key => key.includes('+'))

const byScope = SHORTCUTS.reduce((groups, shortcut) => {
    const group = groups.get(shortcut.scope) ?? []
    group.push(shortcut)
    groups.set(shortcut.scope, group)
    return groups
}, new Map())
const shortcutSections = Array.from(byScope.entries()).map(([scope, shortcuts]) => ({scope, shortcuts}))

const cardAppearanceProps = index => index % 2 === 0 ? {appearance: 'filled-outlined'} : {}

const ShortcutKey = ({token}) => {
    const icon = MOUSE_TOKEN_ICONS[token]

    return (
        <kbd className={`lgs--shortcut-key${icon ? ' is-gesture' : ''}`}>
            {icon && <WaIcon aria-hidden="true" name={icon} variant="regular"/>}
            <span>{KEY_TOKEN_LABELS[token] ?? token}</span>
        </kbd>
    )
}

const platformIconsOf = (platform = '') => PLATFORM_ICONS
    .filter(({pattern}) => pattern.test(platform))
    .map(({key, label}) => {
        const [name, family] = OS_ICONS[key] ?? OS_ICONS.unknown
        return {family, key, label, name}
    })

const PlatformIcons = ({platform}) => {
    const icons = platformIconsOf(platform)

    if (icons.length === 0) {
        return null
    }

    return (
        <span className="lgs--shortcuts-platform" aria-label={platform} title={platform}>
            {icons.map(({family, key, label, name}) => (
                <WaIcon
                    aria-label={label}
                    family={family === 'brands' ? family : undefined}
                    key={key}
                    name={name}
                    variant={family !== 'brands' ? family : undefined}
                />
            ))}
        </span>
    )
}

const ShortcutCombo = ({combo}) => {
    const tokens = combo.split('+').map(token => token.trim()).filter(Boolean)

    return (
        <span className="lgs--shortcut-combo">
            {tokens.map((token, index) => (
                <Fragment key={`${combo}-${token}-${index}`}>
                    {index > 0 && <span className="lgs--shortcut-plus">{'+'}</span>}
                    <ShortcutKey token={token}/>
                </Fragment>
            ))}
        </span>
    )
}

export const ShortcutsPanel = () => {
    const [exporting, setExporting] = useState(false)
    const [sectionsOpen, setSectionsOpen] = useState(false)
    const _sectionElements = useRef(new Map())

    /**
     * Register a shortcut section element for table-of-contents navigation.
     *
     * @param {string} scope - Shortcut section scope.
     * @param {HTMLElement|null} element - Section element.
     */
    const registerSection = useCallback((scope, element) => {
        if (element) {
            _sectionElements.current.set(scope, element)
            return
        }
        _sectionElements.current.delete(scope)
    }, [])

    /**
     * Scroll to a shortcut section and close the table of contents.
     *
     * @param {string} scope - Shortcut section scope.
     */
    const navigateToSection = useCallback(scope => {
        _sectionElements.current.get(scope)?.scrollIntoView?.({behavior: 'smooth', block: 'start'})
        setSectionsOpen(false)
    }, [])

    const exportPDF = useCallback(async () => {
        if (exporting) {
            return
        }

        setExporting(true)
        try {
            const {exportShortcutsToPDF} = await import('@Utils/ExportAsReport/shortcutsPdfReport')
            const result = exportShortcutsToPDF(shortcutSections)
            UIToast.success({
                                caption: 'Export success',
                                text:    result.fileName,
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Export failed',
                              text:    'The shortcuts PDF could not be generated.',
                              errors:  error,
                          })
        }
        finally {
            setExporting(false)
        }
    }, [exporting])

    return (
        <div className="lgs--shortcuts-panel">
            <div className="lgs--shortcuts-toolbar">
                <WaTooltip for="lgs--shortcuts-export-pdf" placement="left">{'Export PDF'}</WaTooltip>
                <WaButton
                    id="lgs--shortcuts-export-pdf"
                    className="lgs--shortcuts-export-button"
                    aria-label="Export shortcuts PDF"
                    appearance="filled"
                    variant="brand"
                    size="s"
                    disabled={exporting}
                    onClick={exportPDF}
                >
                    <WaIcon name="download" variant="regular"/>
                </WaButton>
                <WaTooltip for="lgs--shortcuts-sections" placement="left">{'Shortcut sections'}</WaTooltip>
                <WaButton
                    id="lgs--shortcuts-sections"
                    className="lgs--shortcuts-sections-button"
                    aria-controls="lgs--shortcuts-sections-popup"
                    aria-expanded={sectionsOpen}
                    aria-haspopup="dialog"
                    aria-label="Shortcut sections"
                    appearance="filled"
                    variant="brand"
                    size="s"
                    onClick={() => setSectionsOpen(open => !open)}
                >
                    <WaIcon name="chart-tree-map" variant="regular"/>
                </WaButton>
                <LGSPopup
                    active={sectionsOpen}
                    anchor="lgs--shortcuts-sections"
                    className="lgs--shortcuts-sections-popup"
                    id="lgs--shortcuts-sections-popup"
                    onRequestClose={() => setSectionsOpen(false)}
                    placement="bottom-end"
                    role="dialog"
                    aria-label="Shortcut sections"
                >
                    <div className="lgs--shortcuts-sections-scroll">
                        <LGSScrollbars autoHide={false}>
                            <nav className="lgs--shortcuts-sections-list" aria-label="Shortcut sections">
                                {shortcutSections.map(({scope}) => (
                                    <WaButton
                                        appearance="plain"
                                        className="lgs--shortcuts-section-link"
                                        key={scope}
                                        onClick={() => navigateToSection(scope)}
                                        size="s"
                                    >
                                        {scope}
                                    </WaButton>
                                ))}
                            </nav>
                        </LGSScrollbars>
                    </div>
                </LGSPopup>
            </div>

            <LGSScrollbars>
                <div className="lgs--shortcuts-list">
                    {shortcutSections.map(({scope, shortcuts}, sectionIndex) => (
                        <WaCard {...cardAppearanceProps(sectionIndex)} className="lgs--shortcuts-section-card" key={scope}>
                            <section
                                className="lgs--shortcuts-section"
                                ref={element => registerSection(scope, element)}
                            >
                                <h3>{scope}</h3>
                                <div className="lgs--shortcuts-table">
                                    {shortcuts.map(shortcut => {
                                        const separateAlternatives = hasComposedShortcut(shortcut.keys)

                                        return (
                                            <div className="lgs--shortcuts-row" key={shortcut.id}>
                                                <div className="lgs--shortcuts-keys">
                                                    {shortcut.keys.map((key, index) => (
                                                        <span
                                                            className={`lgs--shortcut-alternative${separateAlternatives ? ' is-separate-line' : ''}`}
                                                            key={`${shortcut.id}-${key}`}
                                                        >
                                                            {!separateAlternatives && index > 0 && (
                                                                <span aria-hidden="true" className="lgs--shortcut-alternative-separator">|</span>
                                                            )}
                                                            <ShortcutCombo combo={key}/>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="lgs--shortcuts-action">
                                                    <div className="lgs--shortcuts-action-heading">
                                                        <strong>{shortcut.action}</strong>
                                                        {shortcut.platform && <PlatformIcons platform={shortcut.platform}/>}
                                                    </div>
                                                    <span>{shortcut.description}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        </WaCard>
                    ))}
                </div>
            </LGSScrollbars>
        </div>
    )
}
