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

    useEffect(() => {
        ;(async () => {
            await readNews()
            state.loading = false
        })()
    }, []);
    const snap = useSnapshot(state)

    return (<Scrollbars style={{height: '100%'}}>
            <div className={'whats-new-list'}>
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
        </Scrollbars>
    )
}
