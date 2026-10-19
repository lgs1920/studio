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
 * Last modified: 2026-10-19
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
                            {'Drag with '}
                            <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                            {' to select a screen area. Cesium navigation remains available until you choose a point.'}
                        </p>
                        <p>
                            {'Plain click selects one point; '}
                            <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                            {'-click selects a range; '}
                            <kbd className="lgs--shortcut-key">{'Ctrl'}</kbd>
                            {' or '}
                            <kbd className="lgs--shortcut-key">{'Cmd'}</kbd>
                            {'-click adds or removes any individual point.'}
                        </p>
                    </section>
                    <section className="fix-path-help-section">
                        <h3>{'Correcting the path'}</h3>
                        <p>{'Click a square to start a section, then drag it to move that route point.'}</p>
                        <p>
                            {'Use '}
                            <kbd className="lgs--shortcut-key">{'Alt'}</kbd>
                            {' + '}
                            <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                            {'-click on a section point to extend it. Finish on a later section to merge both sections and the route points between them.'}
                        </p>
                        <p>{'Click the corrected route to add points, then click a later square on the same track segment within ' + maxSegmentMeters + ' m.'}</p>
                        <p>{'When multiple points are selected, drag any highlighted point to move them together.'}</p>
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
                    </section>
                </div>
            </LGSScrollbars>
        </div>
    </LGSPopup>
)
