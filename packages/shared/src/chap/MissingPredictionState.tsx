import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { PassiveState } from '../plugin/states'

/**
 * What a widget shows when {@link useResolvedPredictionId} resolved to
 * nothing. Which of the two situations it is depends on the selection: a
 * widget following the latest run is waiting for CHAP's first prediction,
 * while a pinned one is pointing at a prediction that has been deleted and
 * needs the user to pick again.
 */
export const MissingPredictionState = ({
    followsLatest,
}: {
    followsLatest: boolean
}) =>
    followsLatest ? (
        <PassiveState title={i18n.t('No predictions yet')}>
            {i18n.t('No predictions have been run on the CHAP backend yet.')}
        </PassiveState>
    ) : (
        <PassiveState title={i18n.t('Prediction not found')}>
            {i18n.t(
                'The configured prediction no longer exists. Reconfigure this widget while editing the dashboard.'
            )}
        </PassiveState>
    )
