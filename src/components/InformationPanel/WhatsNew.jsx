import { faFileWaveform }       from '@fortawesome/pro-regular-svg-icons'
import { SlDetails, SlDivider } from '@shoelace-style/shoelace/dist/react'
import { DateTime }             from 'luxon'
import React, { useEffect }     from 'react'
import { Scrollbars }           from 'react-custom-scrollbars'
import Markdown                 from 'react-markdown'
import { proxy, useSnapshot }   from 'valtio'
import { ChangelogManager }     from '../../core/ui/ChangelogManager'

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
        await Promise.all(fileContent)

        lgs.changelog.files.list.forEach((news, index) => {
                                             state.data.push({
                                                                 open:    (news.file === lgs.changelog.files.last.file),
                                                                 name:    news.file.slice(0, -3).replace(/_/gi, ' '), // suppress .md and change _
                                                                 date:    DateTime.fromMillis(news.time).toLocaleString(DateTime.DATE_MED),
                                                                 time:    news.time,
                                                                 version: news.version,
                                                                 content: fileContent[index]
                                                             })
                                         }
        )
    } catch (error) {
        console.log(error)
    }
}


export const WhatsNew = () => {
    const snap = useSnapshot(state)

    useEffect(() => {
        readNews()
        state.loading = false
    }, []);

    return (<Scrollbars style={{height: '100%'}}>
            <h1>{'What\'s new?'}</h1>
            <div className={'whats-new-list'}>
                {snap.data.map(file => (
                    <SlDetails small open={file.open}
                               key={file.name}
                               className={'lgs-theme'}
                    >
                        <h3 slot="summary">[{file.version}] {file.date}</h3>
                        <SlDivider></SlDivider>
                        <Markdown>
                            {file.content}
                        </Markdown>
                    </SlDetails>

                ))}
            </div>
        </Scrollbars>
    )
}
