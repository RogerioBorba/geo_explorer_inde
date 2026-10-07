import type { OGCProcessRecord } from '../../ogc/commom/OGCRecord';

export const csvRecords = $state<{ogcProcessRecord: OGCProcessRecord[]} >({ ogcProcessRecord: [] });

export function upsertRecord(rec: OGCProcessRecord) {
	csvRecords.ogcProcessRecord = [...csvRecords.ogcProcessRecord.filter(r => r.id !== rec.id), rec];
}

export function clearRecords() {
	csvRecords.ogcProcessRecord = [];
}
