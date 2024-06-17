import React                        from 'react'
import { Scrollbars }               from 'react-custom-scrollbars'
import { default as ReactMarkdown } from 'react-markdown'
import engine                       from '../../../public/assets/credits/credits-engine.md'
import providers                    from '../../../public/assets/credits/credits-map-providers.md'
import code                         from '../../../public/assets/credits/credits-open-source-code.md'

export const CreditsPanel = () => {

    return (<>
        <Scrollbars style={{height: '100vh'}}>
            <h1>{'Credits'}</h1>
            <ReactMarkdown children={engine}/>
            <ReactMarkdown children={providers}/>
            <ReactMarkdown children={code}/>
        </Scrollbars>
    </>)
}
