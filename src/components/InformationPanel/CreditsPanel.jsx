import React                        from 'react'
import { default as ReactMarkdown } from 'react-markdown'
import engine                       from '../../../src/assets/credits/credits-engine.md'
import geocoding                    from '../../../src/assets/credits/credits-geocoding.md'
import providers                    from '../../../src/assets/credits/credits-map-providers.md'
import code                         from '../../../src/assets/credits/credits-open-source-code.md'

export const CreditsPanel = () => {

    return (
        <>
            <h1>{'Credits'}</h1>
            <ReactMarkdown children={engine}/>
            <ReactMarkdown children={providers}/>
            <ReactMarkdown children={geocoding}/>
            <ReactMarkdown children={code}/>
        </>
    )

}
