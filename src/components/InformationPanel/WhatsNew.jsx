import { SlDetails, SlDivider }     from '@shoelace-style/shoelace/dist/react'
import { DateTime }                 from 'luxon'
import React, { useEffect }         from 'react'
import { Scrollbars }               from 'react-custom-scrollbars'
import { default as ReactMarkdown } from 'react-markdown'
import { proxy, useSnapshot }       from 'valtio'
import { ChangelogManager }         from '../../core/ui/ChangelogManager'

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

        const tmp = []
        lgs.changelog.files.list.forEach((news, index) => {
            tmp.push({
                                                                 open:    (news.file === lgs.changelog.files.last.file),
                                                                 name:    news.file.slice(0, -3).replace(/_/gi, ' '), // suppress .md and change _
                                                                 date:    DateTime.fromMillis(news.time).toLocaleString(DateTime.DATE_MED),
                                                                 time:    news.time,
                                                                 version: news.version,
                                                                 content: fileContent[index]
                                                             })
                                         }
        )
        await Promise.all(state)
        state.data = tmp

    } catch (error) {
        console.log(error)
    }
}


export const WhatsNew = () => {

    useEffect(() => {
        ;(async () => {
            await readNews()
            state.loading = false
        })()
    }, []);
    const snap = useSnapshot(state)

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
                        <ReactMarkdown children={file.content}/>
                    </SlDetails>

                ))}
            </div>
        </Scrollbars>
    )
}
