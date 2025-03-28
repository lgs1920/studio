import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'

export const FAButton = (props) => {

    return (
        <div className={classNames('fa-icon-button', props.className)} {...props.ref} >
            <FontAwesomeIcon {...props} />
        </div>
    )
}