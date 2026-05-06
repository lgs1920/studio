/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShortcutsPanel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars }      from '@Components/MainUI/LGSScrollbars'
import { OS_ICONS }           from '@Core/constants'
import { SHORTCUTS_CATALOG } from '@Core/events/appShortcuts'
import { UIToast }            from '@Utils/UIToast'
import { WaButton, WaCard, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, useCallback, useState }     from 'react'

const MOUSE_TOKEN_ICONS = {
    'Double click':     'computer-mouse-button-left',
    'Double tap':       'hand-pointer',
    'Left click':       'computer-mouse-button-left',
    'Left drag':        'computer-mouse-button-left',
    'Long tap':         'hand-pointer',
    'Right click':      'computer-mouse-button-right',
    'Middle drag':      'computer-mouse-scrollwheel',
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

const byScope = SHORTCUTS_CATALOG.reduce((groups, shortcut) => {
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
            <WaTooltip for="lgs--shortcuts-export-pdf" placement="left">{'Export PDF'}</WaTooltip>
            <WaButton
                id="lgs--shortcuts-export-pdf"
                className="lgs--shortcuts-export-button"
                aria-label="Export shortcuts PDF"
                appearance="filled"
                variant="brand"
                size="small"
                disabled={exporting}
                onClick={exportPDF}
            >
                <WaIcon name="download" variant="regular"/>
            </WaButton>

            <LGSScrollbars>
                <div className="lgs--shortcuts-list">
                    {shortcutSections.map(({scope, shortcuts}, sectionIndex) => (
                        <WaCard {...cardAppearanceProps(sectionIndex)} className="lgs--shortcuts-section-card" key={scope}>
                            <section className="lgs--shortcuts-section">
                                <h3>{scope}</h3>
                                <div className="lgs--shortcuts-table">
                                    {shortcuts.map(shortcut => (
                                        <div className="lgs--shortcuts-row" key={shortcut.id}>
                                            <div className="lgs--shortcuts-keys">
                                                {shortcut.keys.map((key, index) => (
                                                    index > 0 ? (
                                                        <span className="lgs--shortcut-alternative" key={key}>
                                                            <ShortcutCombo combo={key}/>
                                                        </span>
                                                    ) : (
                                                        <ShortcutCombo combo={key} key={key}/>
                                                    )
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
                                    ))}
                                </div>
                            </section>
                        </WaCard>
                    ))}
                </div>
            </LGSScrollbars>
        </div>
    )
}
