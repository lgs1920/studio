/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorHelp.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {LGSScrollbars} from '@Components/MainUI/LGSScrollbars'
import {LGSPopup} from '@Components/LGSPopup'

/** Display Fix Path help in a viewport-constrained popup. */
export const FixPathEditorHelp = ({active, onRequestClose, maxSegmentMeters}) => (
    <LGSPopup
        active={active}
        anchor="fix-path-help-trigger"
        className="lgs-widget-no-drag fix-path-help-popup wa-theme-lgs1920-on-map"
        id="fix-path-help-popup"
        onRequestClose={onRequestClose}
        placement="bottom-start"
        role="dialog"
        aria-label="Fix Path help"
        flip
        shift
    >
        <div className="fix-path-help-scroll-area">
            <LGSScrollbars
                autoHeight
                autoHeightMax="max(0px, calc(100vh - 2 * var(--lgs-gutter) - 2 * var(--lgs-gutter-s)))"
            >
                <div className="fix-path-help-content">
                    <section className="fix-path-help-section">
                        <h3>{'Point selection'}</h3>
                        <p>
                            {'With a correction section active, use '}
                            <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                            {' + click on a correction marker to add or remove it from the selection. Shift-drag from a correction marker to select controls in that section; Shift-drag elsewhere on the Journey to add visible GPX source points to the active section. If added points bridge other sections, they merge automatically and the point list updates to the resulting section.'}
                        </p>
                        <p>{'Clicking a point selects it without changing the camera view or zoom. Section navigation centers the selected section while preserving camera zoom, orientation, and widget position.'}</p>
                        <p>{'Use the eye control to show or hide the corrected route and its editing points for the current section. This changes only the map display; accepted corrections remain stored and continue to apply to statistics and Replay.'}</p>
                    </section>
                    <section className="fix-path-help-section">
                        <h3>{'Correcting the path'}</h3>
                        <p>{'Click a route point to start a section. Only points in the current section can be dragged; click a point in another section to activate and display that section before moving it.'}</p>
                        <p>{'Click the corrected route to add points, then click a later route point on the same track segment within ' + maxSegmentMeters + ' m.'}</p>
                        <p>{'When multiple points are selected, drag any highlighted point to move them together.'}</p>
                        <p>{'Choose Erase, then click a point in the current section to remove its membership. The remaining points split into contiguous sections when needed.'}</p>
                        <p>{'Undo and Redo cover edits to section membership, point positions, heights, removals, resets, and merges.'}</p>
                    </section>
                    <section className="fix-path-help-section">
                        <h3>{'Keyboard'}</h3>
                        <p>
                            {'With a correction row focused, use '}
                            <kbd className="lgs--shortcut-key" aria-label="Arrow Up">{'↑'}</kbd>
                            {' / '}
                            <kbd className="lgs--shortcut-key" aria-label="Arrow Down">{'↓'}</kbd>
                            {' to move focus between rows without changing the selected points.'}
                        </p>
                        <p>
                            {'Use '}
                            <kbd className="lgs--shortcut-key">{'Page Up'}</kbd>
                            {' for the first row and '}
                            <kbd className="lgs--shortcut-key">{'Page Down'}</kbd>
                            {' for the last row.'}
                        </p>
                        <p>
                            {'Press '}
                            <kbd className="lgs--shortcut-key">{'Ctrl'}</kbd>
                            {' + '}
                            <kbd className="lgs--shortcut-key">{'A'}</kbd>
                            {' to select every point in the active section.'}
                        </p>
                        <p>
                            {'With a correction point on the map or its row focused, press '}
                            <kbd className="lgs--shortcut-key">{'Backspace'}</kbd>
                            {' to reset it and '}
                            <kbd className="lgs--shortcut-key">{'Delete'}</kbd>
                            {' to mark it removed. From the point or any field in its row, '}
                            <kbd className="lgs--shortcut-key">{'Ctrl/Cmd + R'}</kbd>
                            {' also resets or restores it. Height uses the unit configured in application settings. The row stays available so Reset can restore a removed point.'}
                        </p>
                    </section>
                </div>
            </LGSScrollbars>
        </div>
    </LGSPopup>
)
