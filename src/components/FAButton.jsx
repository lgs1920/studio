/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FAButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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