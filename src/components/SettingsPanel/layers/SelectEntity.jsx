import { Fragment } from 'react'

export const SelectEntity = (props) => {


    const Thumbnail = (props) => {
        return (
            <div className={'layers-entity lgs-card'}>{props.entity.name}</div>
        )
    }

    let tmp = ''
    const list = props.list
    list.map((entity, index) => {
        if (entity.provider !== tmp) {
            tmp = entity.provider
            entity.providerName = __.layerManager.providers.get(entity.provider).name
            list[index] = entity
        }
    })
    console.log(list)

    return (
        <div className={'layers-entities-wrapper lgs-card'}>
            {list.map((entity, index) => {
                // If there is a new provider, let's show it's name
                return (<Fragment key={index}>
                    {entity.providerName &&
                        <>
                            <div className="layers-provider-header">
                                <span className={'provider-name'}>{entity.providerName}</span>
                            </div>
                            <div className="layers-provider-body"></div>
                        </>
                    }
                    <Thumbnail entity={entity} key={entity.name}/>
                </Fragment>)
            })}
        </div>
    )

}