import mongoose from 'mongoose';
import { logError } from './errorLogService';
import { recordVendorHistory } from '../graphQL/vendorEntity';

const ACTIVE_STATUS    = 'Active';
const REQUAL_STATUS    = 'RequalificationDue';
const SUSPENDED_STATUS = 'Suspended';

// Vendors enter the requalification window this many days before their
// RequalificationEndDate.
const REQUAL_WINDOW_DAYS = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole-day difference between two dates, ignoring time-of-day (e.g. a due
// date of "today" returns 0; "tomorrow" returns 1; "yesterday" returns -1).
function daysUntil(date: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(date) - start(now)) / MS_PER_DAY);
}

// Reason recorded on vendor_details.suspendedReason when a vendor is
// automatically suspended by this service for missing its requalification
// deadline.
const AUTO_SUSPEND_REASON = 'Vendor Suspended as Requalification not done';

// Look up the vendor_status record for a status name and apply it (plus the
// vendorStatus label) to the given vendors.
async function applyStatus(
  db: mongoose.mongo.Db,
  vendorIds: string[],
  statusName: string,
  extraFields: Record<string, unknown> = {},
): Promise<void> {
  const statusRecord = await db.collection('vendor_status').findOne({
    $or: [{ VendorStatusCode: statusName }, { VendorStatusName: statusName }],
  });

  const update: Record<string, unknown> = { vendorStatus: statusName, ...extraFields };
  if (statusRecord) {
    update['vendorStatusId'] = String(statusRecord['statusId'] ?? '');
    update['Status']         = statusRecord['_id'];
  }

  await db.collection('vendor_details').updateMany(
    { vendorId: { $in: vendorIds } },
    { $set: update },
  );
}

/**
 * Keeps vendorStatus in sync with RequalificationEndDate:
 * - Active vendors enter RequalificationDue as soon as RequalificationEndDate
 *   falls within the next 60 days.
 * - RequalificationDue vendors are automatically Suspended on the day
 *   immediately following RequalificationEndDate if no requalification
 *   action has moved them out of RequalificationDue first.
 * - RequalificationDue vendors whose date is pushed back out beyond the
 *   60-day window (e.g. after a requalification action) revert to Active.
 *
 * If vendorIds is omitted, all vendors are checked.
 */
export async function syncVendorRequalificationStatus(vendorIds?: string[]): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const query: Record<string, unknown> = {
      RequalificationEndDate: { $nin: [null, ''] },
    };
    if (vendorIds?.length) query['vendorId'] = { $in: vendorIds };

    const vendors = await db.collection('vendor_details')
      .find(query, { projection: { vendorId: 1, vendorStatus: 1, Status: 1, RequalificationEndDate: 1 } })
      .toArray();
    if (!vendors.length) return;

    // Some vendors only carry their status as a `Status` ObjectId reference
    // and have never had the `vendorStatus` string field populated. Build a
    // lookup so those vendors' effective status can still be resolved.
    const statusDocs = await db.collection('vendor_status')
      .find({}, { projection: { VendorStatusCode: 1 } })
      .toArray();
    const statusCodeById = new Map(
      statusDocs.map((s) => [String(s['_id']), String(s['VendorStatusCode'] ?? '')]),
    );

    const now = new Date();
    const dueVendorIds:       string[] = [];
    const suspendedVendorIds: string[] = [];
    const activeVendorIds:    string[] = [];

    for (const vendor of vendors) {
      const dueDate = new Date(String(vendor['RequalificationEndDate']));
      if (Number.isNaN(dueDate.getTime())) continue;

      const remainingDays = daysUntil(dueDate, now);
      const vendorId      = String(vendor['vendorId'] ?? '');

      let currentStatus = String(vendor['vendorStatus'] ?? '');
      if (!currentStatus) {
        currentStatus = statusCodeById.get(String(vendor['Status'] ?? '')) ?? '';
      }

      if (currentStatus === ACTIVE_STATUS) {
        if (remainingDays < 0) suspendedVendorIds.push(vendorId);
        else if (remainingDays <= REQUAL_WINDOW_DAYS) dueVendorIds.push(vendorId);
      } else if (currentStatus === REQUAL_STATUS) {
        if (remainingDays < 0) suspendedVendorIds.push(vendorId);
        else if (remainingDays > REQUAL_WINDOW_DAYS) activeVendorIds.push(vendorId);
      }
    }

    if (dueVendorIds.length)       await applyStatus(db, dueVendorIds, REQUAL_STATUS);
    if (suspendedVendorIds.length) {
      await applyStatus(db, suspendedVendorIds, SUSPENDED_STATUS, { suspendedReason: AUTO_SUSPEND_REASON });
      await Promise.all(suspendedVendorIds.map((id) => recordVendorHistory(id, 'Suspended', AUTO_SUSPEND_REASON, '', 'System')));
    }
    if (activeVendorIds.length) {
      await applyStatus(db, activeVendorIds, ACTIVE_STATUS);
      // These vendors were in RequalificationDue, so landing back on Active is
      // always a reactivation, never a first-time activation.
      await Promise.all(activeVendorIds.map((id) => recordVendorHistory(id, 'Reactivated', '', '', 'System')));
    }
  } catch (err) {
    await logError(err, 'vendorRequalificationService.syncVendorRequalificationStatus');
  }
}
