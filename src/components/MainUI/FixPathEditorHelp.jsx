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
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {LGSScrollbars} from '@Components/MainUI/LGSScrollbars'
import {LGSPopup} from '@Components/LGSPopup'

/** Display Fix Path help in a viewport-constrained popup. */
export const FixPathEditorHelp = ({active, onRequestClose}) => (
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
                            {'Shift-click toggles a correction point. Shift/Alt-drag draws a lasso; Ctrl+Shift/Ctrl+Alt-drag draws a rectangle. Shift selects route points or adds correction points. Alt replaces the selection in the current section. Empty areas keep the selection. Click vertices, then double-click to finish; Escape cancels.'}
                        </p>
                        <p>{'Click a point to select it. Section navigation centers it. The eye toggles the current section display; corrections remain applied.'}</p>
                    </section>
                    <section className="fix-path-help-section">
                        <h3>{'Correcting the path'}</h3>
                        <p>{'Select route points with Shift to create or extend a section. New points appear as orange diamonds. Drag selected points to move them.'}</p>
                        <p>{'Choose Erase and click a point to remove it. Undo and Redo restore edits.'}</p>
                    </section>
                    <section className="fix-path-help-section">
                        <h3>{'Keyboard'}</h3>
                        <p>{'↑/↓ moves through the list; Page Up/Down jumps to either end. Ctrl/Cmd+A selects the section. Backspace resets a point; Delete removes it; Ctrl/Cmd+R resets or restores it.'}</p>
                    </section>
                </div>
            </LGSScrollbars>
        </div>
    </LGSPopup>
)
