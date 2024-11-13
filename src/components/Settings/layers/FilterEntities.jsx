import { ALL, LOCKED, UNLOCKED }                                          from '@Core/constants'
import { faFilterCircleXmark }                                            from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlInput, SlRadioButton, SlRadioGroup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                         from '@Utils/FA2SL'
import { useSnapshot }                                                    from 'valtio/index'

export const FilterEntities = (props) => {

    const editor = lgs.editorSettingsProxy
    const snap = useSnapshot(editor)

    const layers = lgs.settings.layers
    const layersSnap = useSnapshot(layers)


    const handleUsage = (event) => {
        layers.filter.byUsage = event.target.value
        if (layers.filter.byUsage === ALL && layers.filter.byName === '') {
            disableFilter(false)
        }
        else {
            layers.filter.active = true
        }
        editor.layer.refreshList = true
    }

    const handleName = (event) => {
        layers.filter.byName = event.target.value

        if (layers.filter.byUsage === ALL && layers.filter.byName === '') {
            disableFilter(false)
        }
        else {
            layers.filter.active = true
        }
        editor.layer.refreshList = true
    }

    const disableFilter = (closeFilter = true) => {
        layers.filter.byUsage = ALL
        layers.filter.byName = ''
        layers.filter.active = false
        editor.openFilter = !closeFilter
        editor.layer.refreshList = true
    }

    return (
        <>
            {
                snap.openFilter &&
                <div id={'filter-entities'} key={'filter-entities'}>
                    <SlTooltip content={'By Layer Usage'}>
                        <SlRadioGroup name="a"
                                      onSlChange={handleUsage}
                                      value={layersSnap.filter.byUsage}>
                            <SlRadioButton value={ALL}>{'Both'}</SlRadioButton>
                            <SlRadioButton value={UNLOCKED}>{'Unlocked'}</SlRadioButton>
                            <SlRadioButton value={LOCKED}>{'Locked'}</SlRadioButton>
                        </SlRadioGroup>
                    </SlTooltip>

                    <SlTooltip content={'By Layer Name'}>
                        <SlInput placeholder={'By name'} id={'filter-by-name'}
                                 onSlInput={handleName}
                                 value={layersSnap.filter.byName}
                                 key={'filter-by-name'}
                        />
                    </SlTooltip>

                    <SlTooltip content={'Clear Filters'}>
                        <SlIconButton library="fa" onClick={disableFilter}
                                      name={FA2SL.set(faFilterCircleXmark)}
                                      disabled={layersSnap.filter.byUsage === ALL && layersSnap.filter.byName === ''}/>
                    </SlTooltip>
                </div>
            }
        </>
    )
}
