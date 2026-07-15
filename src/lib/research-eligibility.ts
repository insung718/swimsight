export function hasResearchGradeResultProvenance(result: {
  importRowId: string | null;
  originalRowHash: string | null;
  externalMeetId: string | null;
  externalResultId: string | null;
}) {
  return Boolean(
    result.importRowId
    && result.originalRowHash
    && result.externalMeetId
    && result.externalResultId
  );
}
