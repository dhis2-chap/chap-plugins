import {
    BacktestsService,
    useOrgUnitNames,
    LoadingState,
    ErrorState,
    formatPeriodLabel,
    type ConfigFormProps,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import {
    Button,
    InputField,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { type Config } from './config'
import styles from './ConfigForm.module.css'

const LATEST_SPLIT = 'latest'

export const ConfigForm = ({
    config,
    onSave,
    isSaving,
}: ConfigFormProps<Config>) => {
    const [title, setTitle] = useState(config?.title ?? '')
    const [backtestId, setBacktestId] = useState<number | undefined>(
        config?.backtestId
    )
    const [orgUnitId, setOrgUnitId] = useState<string | undefined>(
        config?.orgUnitId
    )
    const [splitPeriod, setSplitPeriod] = useState<string>(
        config?.splitPeriod ?? LATEST_SPLIT
    )

    const backtestsQuery = useQuery({
        queryKey: ['chap', 'backtests'],
        queryFn: () => BacktestsService.getBacktestsV1CrudBacktestsGet(),
    })
    const backtests = backtestsQuery.data ?? []
    const selectedBacktest = backtests.find(
        (backtest) => backtest.id === backtestId
    )
    const orgUnitIds =
        selectedBacktest?.orgUnits ?? selectedBacktest?.dataset.orgUnits ?? []
    const splitPeriods = selectedBacktest?.splitPeriods ?? []
    const orgUnitNamesQuery = useOrgUnitNames(orgUnitIds)

    if (backtestsQuery.isLoading) {
        return <LoadingState />
    }
    if (backtestsQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load evaluations')}>
                {i18n.t(
                    'Fetching the backtest list from the CHAP backend failed.'
                )}
            </ErrorState>
        )
    }

    const orgUnitName = (id: string) => orgUnitNamesQuery.data?.get(id) ?? id
    const canSave = backtestId !== undefined && !!orgUnitId

    return (
        <div className={styles.form}>
            <SingleSelectField
                label={i18n.t('Evaluation (backtest)')}
                selected={
                    selectedBacktest ? String(selectedBacktest.id) : undefined
                }
                onChange={({ selected }) => {
                    setBacktestId(Number(selected))
                    setOrgUnitId(undefined)
                    setSplitPeriod(LATEST_SPLIT)
                }}
            >
                {backtests.map((backtest) => (
                    <SingleSelectOption
                        key={backtest.id}
                        value={String(backtest.id)}
                        label={`${backtest.name ?? `Backtest ${backtest.id}`} (${backtest.modelId})`}
                    />
                ))}
            </SingleSelectField>
            <SingleSelectField
                label={i18n.t('Organisation unit')}
                disabled={!selectedBacktest}
                selected={
                    orgUnitId && orgUnitIds.includes(orgUnitId)
                        ? orgUnitId
                        : undefined
                }
                onChange={({ selected }) => setOrgUnitId(selected)}
            >
                {orgUnitIds.map((id) => (
                    <SingleSelectOption
                        key={id}
                        value={id}
                        label={orgUnitName(id)}
                    />
                ))}
            </SingleSelectField>
            <SingleSelectField
                label={i18n.t('Split period')}
                disabled={!selectedBacktest}
                selected={
                    splitPeriod !== LATEST_SPLIT &&
                    !splitPeriods.includes(splitPeriod)
                        ? undefined
                        : splitPeriod
                }
                onChange={({ selected }) => setSplitPeriod(selected)}
            >
                <SingleSelectOption
                    value={LATEST_SPLIT}
                    label={i18n.t('Latest split')}
                />
                {splitPeriods.map((period) => (
                    <SingleSelectOption
                        key={period}
                        value={period}
                        label={formatPeriodLabel(period)}
                    />
                ))}
            </SingleSelectField>
            <InputField
                label={i18n.t('Widget title (optional)')}
                value={title}
                onChange={({ value }) => setTitle(value ?? '')}
            />
            <Button
                primary
                loading={isSaving}
                disabled={!canSave}
                onClick={() => {
                    if (backtestId === undefined || !orgUnitId) {
                        return
                    }
                    onSave({
                        version: 1,
                        widget: 'chap-widget-evaluation-compare',
                        title: title.trim() || undefined,
                        backtestId,
                        orgUnitId,
                        orgUnitName: orgUnitNamesQuery.data?.get(orgUnitId),
                        splitPeriod:
                            splitPeriod === LATEST_SPLIT
                                ? undefined
                                : splitPeriod,
                    })
                }}
            >
                {i18n.t('Save')}
            </Button>
        </div>
    )
}
