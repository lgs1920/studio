/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyFilesList.jsx
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

import { LGSScrollbars }                               from '@Components/MainUI/LGSScrollbars'
import { JOURNEY_EXISTS, JOURNEY_OK, JOURNEY_WAITING } from '@Utils/cesium/TrackUtils'
import { WaCard, WaFormatBytes, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                                         from 'valtio'

/**
 * JourneyFilesList Component
 * Displays a list of files with their respective upload/processing status.
 * Optimized for Valtio reactivity.
 *
 * @returns {JSX.Element | null}
 */
export const JourneyFilesList = () => {
    const $fileLoader = lgs.stores.main.components.fileLoader
    const {fileList} = useSnapshot($fileLoader)

    /**
     * Resolves visual configuration and labels based on the current journey status.
     * @param {number} status - The status constant from TrackUtils
     * @returns {Object}
     */
    const getStatusTheme = (status) => {
        if (status === JOURNEY_WAITING) {
            return {
                icon:      'display-arrow-down',
                className: 'fa-beat-fade status-waiting',
            }
        }

        if (status === JOURNEY_OK) {
            return {
                icon:      'circle-check',
                className: 'status-success',
            }
        }

        if (status === JOURNEY_EXISTS) {
            return {
                icon:      'circle-exclamation',
                className: 'status-warning',
            }
        }

        return {
            icon:      'bomb',
            className: 'fa-beat status-error',
        }
    }

    // Convert map values to array directly from the snapshot
    const files = Array.from(fileList.values()).toReversed()

    if (files.length === 0) {
        return null
    }

    return (
        <LGSScrollbars style={{minHeight: 200, maxHeight: 400}}>
            <div className="journey-files-list">
                {files.map((item) => {
                    const theme = getStatusTheme(item.journeyStatus)

                    return (
                        <WaCard key={item.uuid} appearance="outlined" className="lgs--card-hoverable"
                                variant="success">
                            <WaIcon name="route" variant="regular"/>

                            <div className="journey-file-details">
                                <span className="journey-file-name">{item.file.fullName}</span>
                                {item.file.size > 0 && <WaFormatBytes value={item.file.size}/>}
                            </div>

                            <div className="file-status-tag">
                                <WaIcon
                                    className={theme.className}
                                    variant="regular"
                                    name={theme.icon}
                                />
                            </div>
                        </WaCard>
                    )
                })}
            </div>
        </LGSScrollbars>
    )
}
