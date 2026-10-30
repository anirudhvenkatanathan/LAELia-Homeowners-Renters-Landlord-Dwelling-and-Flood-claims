import { ServiceRequestRoleModel } from '../graphQL/serviceRequestRoleEntity';
import { mapClaimTypeToLOB, LINE_OF_BUSINESS_OPTIONS } from '../utils/lineOfBusiness';

/**
 * Idempotent: only touches records that predate the lineOfBusiness field, or
 * that still hold it in the pre-array (single string) shape. Safe to call on
 * every server startup in any environment — matches the
 * seedActiveVendorMenus() pattern in server.ts — so a fresh deploy's database
 * gets backfilled/migrated automatically instead of relying on someone
 * remembering to run scripts/backfillServiceRequestRoleLOB.ts by hand.
 */
export async function ensureServiceRequestRoleLOB(): Promise<void> {
  const backfilled = await ServiceRequestRoleModel.updateMany(
    { $or: [{ lineOfBusiness: { $exists: false } }, { lineOfBusiness: '' }] },
    { $set: { lineOfBusiness: ['WCM'] } }
  );
  if (backfilled.modifiedCount > 0) {
    console.log(`Backfilled ${backfilled.modifiedCount} service_request_role record(s) to lineOfBusiness: [WCM]`);
  }

  // Migrate any record still holding lineOfBusiness as a single string
  // (pre-array shape) into a one-element array — e.g. "Auto" -> ["Auto"].
  // Uses $expr + the aggregation $type operator (which reports the field's
  // own BSON type) rather than the query-language $type operator — the
  // latter also matches an array field that merely *contains* a string
  // element (i.e. every already-migrated ["WCM"] record), which would
  // re-wrap it into [["WCM"]].
  const migrated = await ServiceRequestRoleModel.updateMany(
    { $expr: { $eq: [{ $type: '$lineOfBusiness' }, 'string'] } },
    [{ $set: { lineOfBusiness: [{ $ifNull: ['$lineOfBusiness', 'WCM'] }] } }]
  );
  if (migrated.modifiedCount > 0) {
    console.log(`Migrated ${migrated.modifiedCount} service_request_role record(s) from single-value lineOfBusiness to an array.`);
  }

  // One-time self-healing repair for any record double-wrapped by the query-
  // operator bug above (e.g. ["WCM"] -> [["WCM"]]) before this fix — flattens
  // one level of array nesting. No-op once the DB is clean.
  const repaired = await ServiceRequestRoleModel.updateMany(
    { lineOfBusiness: { $elemMatch: { $type: 'array' } } },
    [{ $set: { lineOfBusiness: { $reduce: {
      input: '$lineOfBusiness',
      initialValue: [],
      in: { $concatArrays: ['$$value', { $cond: [{ $isArray: '$$this' }, '$$this', ['$$this']] }] },
    } } } }]
  );
  if (repaired.modifiedCount > 0) {
    console.log(`Repaired ${repaired.modifiedCount} service_request_role record(s) with a double-nested lineOfBusiness array.`);
  }

  // Normalize any element that isn't one of the exact canonical LOB values —
  // e.g. hand-edited/imported records holding "AUTO", "GL", "PROPERTY", or
  // lowercase "wcm" — to its canonical enum form, and de-duplicate.
  // mapClaimTypeToLOB already does exactly this normalization (case-
  // insensitive exact match, then "gl"/"propert*"/"auto" synonyms), which is
  // also why it's safe to reuse here even though its primary purpose is
  // mapping a claim's claimType to a LOB.
  const canonicalSet = new Set<string>(LINE_OF_BUSINESS_OPTIONS);
  const arrayDocs = await ServiceRequestRoleModel
    .find({ lineOfBusiness: { $type: 'array' } }, { roleId: 1, lineOfBusiness: 1 })
    .lean()
    .exec();

  const normalizeOps = arrayDocs
    .filter((doc) => (doc.lineOfBusiness ?? []).some((v) => typeof v !== 'string' || !canonicalSet.has(v)))
    .map((doc) => ({
      updateOne: {
        filter: { roleId: doc.roleId },
        update: {
          $set: {
            lineOfBusiness: Array.from(new Set(
              (doc.lineOfBusiness ?? []).map((v) => mapClaimTypeToLOB(typeof v === 'string' ? v : ''))
            )),
          },
        },
      },
    }));

  if (normalizeOps.length > 0) {
    await ServiceRequestRoleModel.bulkWrite(normalizeOps);
    console.log(`Normalized non-canonical lineOfBusiness values (e.g. "AUTO"/"GL"/"PROPERTY") on ${normalizeOps.length} service_request_role record(s).`);
  }
}
