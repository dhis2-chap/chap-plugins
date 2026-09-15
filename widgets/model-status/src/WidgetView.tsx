import {
    JobsService,
    useChapSystemInfo,
    LoadingState,
    ErrorState,
    OpenInModelingButton,
    jobsLink,
} from '@chap-widgets/shared'
import i18n from '@dhis2/d2-i18n'
import {
    DataTable,
    DataTableBody,
    DataTableCell,
    DataTableColumnHeader,
    DataTableHead,
    DataTableRow,
    Tag,
} from '@dhis2/ui'
import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { type Config } from './config'
import styles from './WidgetView.module.css'

const JOBS_REFRESH_MS = 30 * 1000

const JobStatusTag = ({ status }: { status: string }) => {
    if (status === 'SUCCESS') {
        return <Tag positive>{status}</Tag>
    }
    if (status === 'FAILURE' || status === 'REVOKED') {
        return <Tag negative>{status}</Tag>
    }
    return <Tag>{status}</Tag>
}

const formatTime = (isoTimestamp: string | null) => {
    if (!isoTimestamp) {
        return '—'
    }
    const date = new Date(isoTimestamp)
    return Number.isNaN(date.getTime()) ? isoTimestamp : date.toLocaleString()
}

/**
 * Operational overview of the CHAP backend: recent jobs with status and the
 * chap-core version.
 */
export const WidgetView = ({ config }: { config: Config }) => {
    const jobsQuery = useQuery({
        queryKey: ['chap', 'jobs'],
        queryFn: () => JobsService.listJobsV1JobsGet(),
        refetchInterval: JOBS_REFRESH_MS,
    })
    const systemInfoQuery = useChapSystemInfo()

    if (jobsQuery.isLoading) {
        return <LoadingState />
    }
    if (jobsQuery.isError) {
        return (
            <ErrorState title={i18n.t('Could not load jobs')}>
                {i18n.t('Fetching the job list from the CHAP backend failed.')}
            </ErrorState>
        )
    }

    const jobs = [...(jobsQuery.data ?? [])]
        .sort((a, b) => (b.start_time ?? '').localeCompare(a.start_time ?? ''))
        .slice(0, config.jobLimit)

    return (
        <div className={styles.view}>
            <OpenInModelingButton
                label={i18n.t('Open jobs in Modeling')}
                link={jobsLink()}
            />
            {jobs.length === 0 ? (
                <p className={styles.empty}>
                    {i18n.t('No jobs have run yet.')}
                </p>
            ) : (
                <DataTable>
                    <DataTableHead>
                        <DataTableRow>
                            <DataTableColumnHeader>
                                {i18n.t('Job')}
                            </DataTableColumnHeader>
                            <DataTableColumnHeader>
                                {i18n.t('Type')}
                            </DataTableColumnHeader>
                            <DataTableColumnHeader>
                                {i18n.t('Started')}
                            </DataTableColumnHeader>
                            <DataTableColumnHeader>
                                {i18n.t('Status')}
                            </DataTableColumnHeader>
                        </DataTableRow>
                    </DataTableHead>
                    <DataTableBody>
                        {jobs.map((job) => (
                            <DataTableRow key={job.id}>
                                <DataTableCell>{job.name}</DataTableCell>
                                <DataTableCell>{job.type}</DataTableCell>
                                <DataTableCell>
                                    {formatTime(job.start_time)}
                                </DataTableCell>
                                <DataTableCell>
                                    <JobStatusTag status={job.status} />
                                </DataTableCell>
                            </DataTableRow>
                        ))}
                    </DataTableBody>
                </DataTable>
            )}
            <div className={styles.footer}>
                {i18n.t('chap-core {{version}}', {
                    version: systemInfoQuery.data?.chap_core_version ?? '…',
                })}
            </div>
        </div>
    )
}
