import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'

export const FAButton = (props) => {
    const {className, onClick, id, ref, ...rest} = props
    return (
        <div className={classNames('fa-icon-button', className)} ref={ref} id={id} onClick={onClick}>
            <FontAwesomeIcon {...rest} />
        </div>
    )
}