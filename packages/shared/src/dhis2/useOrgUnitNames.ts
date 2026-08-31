import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'

type OrgUnitResponse = {
    orgUnits: {
        organisationUnits: Array<{ id: string; displayName: string }>
    }
}

const CHUNK_SIZE = 100

/**
 * Resolves org unit ids (as used in CHAP entries) to display names via the
 * DHIS2 metadata API. Returns a Map<id, displayName>; ids that don't resolve
 * simply stay absent — callers fall back to the raw id.
 */
export const useOrgUnitNames = (orgUnitIds: string[]) => {
    const engine = useDataEngine()
    const ids = Array.from(new Set(orgUnitIds)).sort()

    return useQuery<Map<string, string>>({
        queryKey: ['dhis2', 'orgUnitNames', ids],
        enabled: ids.length > 0,
        staleTime: Infinity,
        queryFn: async () => {
            const names = new Map<string, string>()
            for (let start = 0; start < ids.length; start += CHUNK_SIZE) {
                const chunk = ids.slice(start, start + CHUNK_SIZE)
                const response = (await engine.query({
                    orgUnits: {
                        resource: 'organisationUnits',
                        params: {
                            filter: `id:in:[${chunk.join(',')}]`,
                            fields: 'id,displayName',
                            paging: 'false',
                        },
                    },
                })) as OrgUnitResponse
                for (const orgUnit of response.orgUnits.organisationUnits) {
                    names.set(orgUnit.id, orgUnit.displayName)
                }
            }
            return names
        },
    })
}
