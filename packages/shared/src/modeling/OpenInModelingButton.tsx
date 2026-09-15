import i18n from '@dhis2/d2-i18n'
import { IconLaunch16 } from '@dhis2/ui'
import React from 'react'
import { modelingAppUrl } from './modelingLinks'
import styles from './OpenInModelingButton.module.css'
import { useModelingAppUrl } from './useModelingAppUrl'

export type OpenInModelingButtonProps = {
    /** Hash link into the modeling app, from one of the `*Link` builders */
    link: string
    /** Label and accessible name; defaults to a generic "Open in Modeling" */
    label?: string
}

/**
 * Corner button that opens the modeling app on whatever the widget is already
 * showing. Renders nothing when the modeling app isn't installed.
 *
 * Positioned absolutely, so the view it sits in needs `position: relative`.
 * Opens in a new tab: a dashboard plugin renders inside an iframe, and a
 * same-tab navigation would swap the widget out for the whole modeling app.
 */
export const OpenInModelingButton = ({
    link,
    label,
}: OpenInModelingButtonProps) => {
    const launchUrl = useModelingAppUrl()
    if (!launchUrl) {
        return null
    }

    const text = label ?? i18n.t('Open in Modeling')
    return (
        <a
            className={styles.button}
            href={modelingAppUrl(launchUrl, link)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={text}
            title={text}
        >
            <IconLaunch16 />
            {/* Already announced via aria-label; hidden so it isn't read twice */}
            <span className={styles.label} aria-hidden="true">
                {text}
            </span>
        </a>
    )
}
