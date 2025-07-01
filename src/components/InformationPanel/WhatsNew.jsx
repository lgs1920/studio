/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WhatsNew.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-01
 * Last modified: 2025-07-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { ChangelogManager }         from '@Core/ui/ChangelogManager'
import { SlDetails, SlDivider }     from '@shoelace-style/shoelace/dist/react'
import { DateTime }                 from 'luxon'
import React, { useEffect, useRef } from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import { proxy, useSnapshot }       from 'valtio'

// Créer un état proxy avec Valtio
const state = proxy({
                        data: [],
                    })

const readNews =  async () => {
    const changelog = new ChangelogManager()
    const fileContent = []
    try {
        lgs.changelog.files.list.forEach(news => {
            fileContent.push(changelog.read(encodeURIComponent(news.file)))
        })
        Promise.all(fileContent).then((fileContent) => {
            const tmp = []
            lgs.changelog.files.list.forEach((news, index) => {
                                                 tmp.push({
                                                              open:    (news.file === lgs.changelog.files.last.file),
                                                              name:    news.file.slice(0, -3).replace(/_/gi, ' '), // suppress
                                                                                                                   // .md
                                                                                                                   // and
                                                                                                                   // change
                                                                                                                   // _
                                                              date:    DateTime.fromMillis(news.time).toLocaleString(DateTime.DATE_MED),
                                                              time:    news.time,
                                                              version: news.version,
                                                              content: fileContent[index],
                                                          })
                                             },
            )
            Promise.all(tmp).then(tmp => state.data = tmp)
        })




    } catch (error) {
        console.error(error)
    }
}


export const WhatsNew = () => {
    const newsList = useRef(null)
    useEffect(() => {
        ;(async () => {
            await readNews()
            state.loading = false
        })()

        __.ui.ui.initDetailsGroup(newsList.current)
    }, []);
    const snap = useSnapshot(state)

    return (
                <LGSScrollbars>
                    <div className={'whats-new-list'} ref={newsList}>

                        {snap.data.map(file => (
                    <SlDetails small open={file.open}
                               key={file.name}
                               className={'lgs-theme'}
                    >
                        <span slot="summary">[{file.version}] {file.date}</span>
                        <SlDivider/>
                        <div><ReactMarkdown children={file.content}/></div>

                    </SlDetails>

                ))}
                    </div>
                </LGSScrollbars>


    )
}
