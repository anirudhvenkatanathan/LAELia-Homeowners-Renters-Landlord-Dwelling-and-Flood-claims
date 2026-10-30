import { Request, Response } from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { logError } from '../services/errorLogService';
import { syncVendorRequalificationStatus } from '../services/vendorRequalificationService';
import { VendorServiceRequestModel } from './vendorServiceRequestController';
import { ServiceRequestRoleModel } from '../graphQL/serviceRequestRoleEntity';
import {
  ProcessingStageModel,
  ConfirmationStageModel,
  ConfirmationDocModel,
  WaiveReasonModel,
  VendorPriorityBoostModel,
  buildStageMap,
} from '../graphQL/vendorOnboardingEntity';
import { recordVendorHistory, REACTIVATION_SOURCE_STATUSES, VendorStatusHistoryModel } from '../graphQL/vendorEntity';

// ─── Qualification document storage ───────────────────────────────────────────

const VENDOR_DOC_UPLOAD_PATH = process.env['VENDOR_DOC_UPLOAD_PATH'] ?? 'C:\\Claims_Triage\\Vendor_Doc_Uploads';

/** Decodes a base64 (optionally data-URL prefixed) file and writes it under VENDOR_DOC_UPLOAD_PATH/<vendorId>. */
async function saveUploadedFile(vendorId: string, fileName: string, fileBase64: string): Promise<string> {
  const vendorFolder = path.join(VENDOR_DOC_UPLOAD_PATH, vendorId);
  await fs.promises.mkdir(vendorFolder, { recursive: true });

  const safeName = path.basename(fileName || 'document');
  const uniqueName = `${Date.now()}_${safeName}`;
  const destPath = path.join(vendorFolder, uniqueName);

  const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  await fs.promises.writeFile(destPath, Buffer.from(base64Data, 'base64'));

  return destPath;
}

async function resolveServiceRoleNames(roleIds: string[]): Promise<{ roleId: string; name: string }[]> {
  if (!roleIds.length) return [];
  const roles = await ServiceRequestRoleModel.find({ roleId: { $in: roleIds } }).lean();
  const map = new Map(roles.map((r) => [r.roleId, r.roleName]));
  return roleIds.map((id) => ({ roleId: id, name: map.get(id) ?? id }));
}

/** Placeholder filename for synthetic pre-approved qualification documents
 *  (Suspended / Requalification Due testing stub) — no real file exists.
 *  Named after the layer it belongs to, e.g. "L1 Service-Category Specific" → "Doc_L1.pdf". */
function layerPlaceholderFileName(vendorStageName: string): string {
  const match = /^L\d+/.exec(vendorStageName.trim());
  return `Doc_${match ? match[0] : 'L0'}.pdf`;
}

// ─── Stage status computation ─────────────────────────────────────────────────

interface ConfirmationReq {
  vendorConfirmationId: string;
  isMandatory:          boolean;
  serviceRequestRoleId: string;
}

interface UploadedDoc {
  vendorConfirmationId: string;
  approvalStatus:       string;
}

function computeStageStatus(requirements: ConfirmationReq[], docs: UploadedDoc[]): string {
  const waivedSet = new Set<string>();
  const statusMap = new Map<string, string>();
  for (const d of docs) {
    if (d.approvalStatus === 'Waived') {
      waivedSet.add(d.vendorConfirmationId);
    } else {
      statusMap.set(d.vendorConfirmationId, d.approvalStatus);
    }
  }

  const mandatory = requirements.filter((r) => r.isMandatory);

  if (mandatory.length === 0) {
    if (requirements.length === 0) return 'In Progress';
    const allResponded = requirements.every(
      (r) => waivedSet.has(r.vendorConfirmationId) || statusMap.has(r.vendorConfirmationId),
    );
    return allResponded ? 'Completed' : 'In Progress';
  }

  const anyRejected = mandatory.some(
    (r) => !waivedSet.has(r.vendorConfirmationId) && statusMap.get(r.vendorConfirmationId) === 'Rejected',
  );
  if (anyRejected) return 'Rejected';

  const allSatisfied = mandatory.every((r) => {
    if (waivedSet.has(r.vendorConfirmationId)) return true;
    const s = statusMap.get(r.vendorConfirmationId);
    return s === 'Approved' || s === 'Available';
  });
  if (allSatisfied) return 'Completed';

  return 'In Progress';
}

// ─── Vendor status sync ───────────────────────────────────────────────────────

// 'Ready For Approval' has been folded into 'In Progress': once a vendor moves
// out of 'Open' (the first action taken on its onboarding details), it remains
// 'In Progress' through all onboarding stages, regardless of completion, until
// Final Approve (see finalApprove) sets the status to 'Active'. No automatic
// status transition based on stage completion is needed beyond this.
async function syncVendorStatus(vendorId: string): Promise<void> {
  const db = mongoose.connection.db!;

  const statusRecord = await db.collection('vendor_status').findOne({
    $or: [{ VendorStatusCode: 'InProgress' }, { VendorStatusName: 'InProgress' }, { VendorStatusName: 'In Progress' }],
  });

  // Use the actual VendorStatusName from the DB so we stay consistent with
  // whatever casing the tenant's vendor_status collection uses.
  const statusName = statusRecord ? String(statusRecord['VendorStatusName'] ?? 'InProgress') : 'InProgress';
  const update: Record<string, unknown> = { vendorStatus: statusName };
  if (statusRecord) {
    update['vendorStatusId'] = String(statusRecord['statusId'] ?? '');
    update['Status']         = statusRecord['_id'];
  }

  await db.collection('vendor_details').updateOne(
    { vendorId, vendorStatus: { $in: ['Open', 'Pending Approval', 'PendingApproval'] } },
    { $set: update },
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function getOnboardingList(req: Request, res: Response): Promise<void> {
  try {
    await syncVendorRequalificationStatus();

    const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10));
    const limit = Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10));
    const skip  = (page - 1) * limit;

    // 'pending'        -> newly submitted vendor requests awaiting Approve/Reject
    // 'inProgress'     -> vendors actively moving through the qualification layers
    // 'requalification'-> active vendors whose requalification is due
    const tab = String(req.query['tab'] ?? 'inProgress');
    // Accept both 'InProgress' and 'In Progress' so the list works regardless
    // of whether the tenant's vendor_status collection uses a space or not.
    const filter = tab === 'pending'
      ? { vendorStatus: { $in: ['Pending Approval', 'PendingApproval'] } }
      : tab === 'requalification'
      ? { vendorStatus: 'RequalificationDue' }
      : { vendorStatus: { $in: ['In Progress', 'InProgress', 'SendBack'] } };

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const collection = mongoose.connection.db!.collection('vendor_details');
    const [totalRecords, vendors, openCount, inProgressCount, requalDueCount] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({ vendorStatus: { $in: ['Pending Approval', 'PendingApproval'] } }),
      collection.countDocuments({ vendorStatus: { $in: ['In Progress', 'InProgress', 'SendBack'] } }),
      collection.countDocuments({ vendorStatus: 'RequalificationDue' }),
    ]);

    // Load stages + requirements once (shared across all vendors on this page)
    const stages = await ProcessingStageModel.find().sort({ _id: 1 }).lean();
    const stageIds = stages.map((s) => String(s.vendorStageId));
    const allRequirements = await ConfirmationStageModel.find({ vendorStageId: { $in: stageIds } }).lean();

    const reqsByStage = new Map<string, ConfirmationReq[]>();
    for (const r of allRequirements) {
      if (!reqsByStage.has(r.vendorStageId)) reqsByStage.set(r.vendorStageId, []);
      reqsByStage.get(r.vendorStageId)!.push({
        vendorConfirmationId: r.vendorConfirmationId,
        isMandatory:          r.isMandatory,
        serviceRequestRoleId: r.serviceRequestRoleId ?? '',
      });
    }

    const ROLE_STAGE_CODES = new Set(['Service-Category_Specific']);

    // Batch-load all docs for the current page of vendors in one query
    const vendorIds = vendors.map((v) => String(v['vendorId'] ?? ''));
    const pageDocs  = await ConfirmationDocModel.find({ vendorId: { $in: vendorIds } })
      .select('vendorId vendorConfirmationId approvalStatus')
      .lean();

    const docsByVendor = new Map<string, UploadedDoc[]>();
    for (const d of pageDocs) {
      if (!docsByVendor.has(d.vendorId)) docsByVendor.set(d.vendorId, []);
      docsByVendor.get(d.vendorId)!.push({ vendorConfirmationId: d.vendorConfirmationId, approvalStatus: d.approvalStatus });
    }

    const data = vendors.map((v) => {
      const vendorId = String(v['vendorId'] ?? '');
      const createdAt = v['createdAt'] ? new Date(v['createdAt'] as string | Date) : null;

      // Vendor-specific service role IDs (needed for role-based stage requirements)
      const vendorRoleIds: string[] = Array.isArray(v['serviceRequestRoleId'])
        ? (v['serviceRequestRoleId'] as string[])
        : v['serviceRequestRoleId'] ? [String(v['serviceRequestRoleId'])] : [];

      const vendorDocs = docsByVendor.get(vendorId) ?? [];
      const vendorRoleIdSet = new Set(vendorRoleIds);

      // Find the first stage that is not yet Completed
      let firstIncompleteStageName = '';
      for (const stage of stages) {
        const stageIdStr = String(stage.vendorStageId);
        const baseReqs   = reqsByStage.get(stageIdStr) ?? [];
        // L1 (Service-Category_Specific) only counts questions scoped to the
        // vendor's own selected service categories; other stages use all requirements.
        const allReqs = ROLE_STAGE_CODES.has(stage.vendorStageCode)
          ? baseReqs.filter((r) => r.serviceRequestRoleId && vendorRoleIdSet.has(r.serviceRequestRoleId))
          : baseReqs;

        const vcIdSet    = new Set(allReqs.map((r) => r.vendorConfirmationId));
        const stageDocs  = vendorDocs.filter((d) => vcIdSet.has(d.vendorConfirmationId));
        const stageStatus = computeStageStatus(allReqs, stageDocs);

        if (stageStatus !== 'Completed') {
          firstIncompleteStageName = stage.vendorStageName;
          break;
        }
      }

      return {
        vendorId,
        companyName:      String(v['companyName']           ?? ''),
        coverage:         String(v['Coverage'] ?? v['coverage'] ?? ''),
        daysInAge:        0,
        currentStageName: firstIncompleteStageName,
        nextStageName:    firstIncompleteStageName ? `Review - ${firstIncompleteStageName}` : '',
        // "RequalificationDue" → "Active/Requalification Due" and
        // "Open" → "Pending Approval" for display.
        vendorStatus:     String(v['vendorStatus'] ?? '') === 'RequalificationDue'
          ? 'Active/Requalification Due'
          : String(v['vendorStatus'] ?? '').replace(/([a-z])([A-Z])/g, '$1 $2'),
        createdAt:        createdAt ? createdAt.toISOString() : '',
        boostApplied:     v['boostApplied'] === true,
      };
    });

    res.status(200).json({
      success: true,
      totalRecords,
      data,
      counts: {
        open:               openCount,
        inProgress:         inProgressCount,
        requalificationDue: requalDueCount,
      },
    });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getOnboardingList');
    res.status(500).json({ success: false, message: 'Internal server error while fetching onboarding list.' });
  }
}

export async function getOnboardingDetails(req: Request, res: Response): Promise<void> {
  try {
    const vendorId = req.params['vendorId'] as string;

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId path parameter is required.' });
      return;
    }

    syncVendorRequalificationStatus([vendorId]).catch(() => {});

    const collection = mongoose.connection.db!.collection('vendor_details');
    const vendor = await collection.findOne({ vendorId });

    if (!vendor) {
      res.status(404).json({ success: false, message: `No vendor found with vendorId: ${vendorId}` });
      return;
    }

    const stages = await ProcessingStageModel.find().sort({ _id: 1 }).lean();

    const stageIds = stages.map((s) => String(s.vendorStageId));
    const [allRequirements, allDocs, allServiceRolesDocs, allVendorStatuses, existingBoost] = await Promise.all([
      ConfirmationStageModel.find({ vendorStageId: { $in: stageIds } }).lean(),
      ConfirmationDocModel.find({ vendorId }).lean(),
      mongoose.connection.db!.collection('service_request_roles').find({ status: { $ne: 'Inactive' } }).sort({ _id: 1 }).toArray(),
      mongoose.connection.db!.collection('vendor_status').find({}).toArray(),
      VendorPriorityBoostModel.findOne({ vendorId }).lean(),
    ]);

    // Resolve vendor status from vendor_details.Status (reference into vendor_status).
    // Status may be stored as a stringified ObjectId or a custom statusId — match both.
    const rawVendorStatus = String(vendor['vendorStatus'] ?? '');
    const statusRef = vendor['Status'] ? String(vendor['Status']) : '';
    const matchedStatus = allVendorStatuses.find(
      (s) => String(s['_id']) === statusRef || String(s['statusId'] ?? '') === statusRef,
    );
    // 'SendBack' is a transient override written directly to vendorStatus by sendBackDocument.
    // It must take priority over the status-collection reference which still points to InProgress.
    const resolvedVendorStatus = rawVendorStatus === 'SendBack'
      ? 'SendBack'
      : matchedStatus
        ? String(matchedStatus['VendorStatusName'] || matchedStatus['VendorStatusCode'] || '').replace(/([a-z])([A-Z])/g, '$1 $2')
        : rawVendorStatus;

    // TEMPORARY (testing only): Suspended / Requalification Due / In Progress
    // vendors have every Qualification Layer question shown as pre-approved,
    // so testers can exercise the Priority Boost → Activate flow without
    // first uploading/approving real documents. This is purely a
    // response-shaping override — no ConfirmationDocModel record is read,
    // written, or deleted, and no other vendor status is affected.
    const preApproveQualification = resolvedVendorStatus === 'Suspended'
      || resolvedVendorStatus === 'Requalification Due'
      || resolvedVendorStatus === 'In Progress';

    const reqsByStage = new Map<string, typeof allRequirements>();
    for (const r of allRequirements) {
      if (!reqsByStage.has(r.vendorStageId)) reqsByStage.set(r.vendorStageId, []);
      reqsByStage.get(r.vendorStageId)!.push(r);
    }

    // ── Fetch service roles: ALL (for roleSummary) + vendor subset (for stage items) ──
    const serviceRequestRoleIds: string[] = Array.isArray(vendor['serviceRequestRoleId'])
      ? (vendor['serviceRequestRoleId'] as string[])
      : vendor['serviceRequestRoleId']
        ? [String(vendor['serviceRequestRoleId'])]
        : [];

    const vendorRoleIdSet = new Set(serviceRequestRoleIds);
    type RoleItem = { roleId: string; roleName: string };
    const serviceRoleItems: RoleItem[] = [];

    const roleNameById = new Map<string, string>();
    for (const r of allServiceRolesDocs) {
      const rId = String(r['roleId'] ?? '');
      roleNameById.set(rId, String(r['roleName'] ?? ''));
      if (vendorRoleIdSet.has(rId)) {
        serviceRoleItems.push({ roleId: rId, roleName: String(r['roleName'] ?? '') });
      }
    }

    // Stages whose confirmation items are scoped per service category (L1)
    const ROLE_STAGE_CODES = new Set(['Service-Category_Specific']);

    const regularDocsByConfirmation = new Map<string, typeof allDocs>();
    const waiveDocByConfirmation    = new Map<string, (typeof allDocs)[0]>();
    for (const d of allDocs) {
      if (d.approvalStatus === 'Waived') {
        waiveDocByConfirmation.set(d.vendorConfirmationId, d);
      } else {
        if (!regularDocsByConfirmation.has(d.vendorConfirmationId)) regularDocsByConfirmation.set(d.vendorConfirmationId, []);
        regularDocsByConfirmation.get(d.vendorConfirmationId)!.push(d);
      }
    }

    const mapDoc = (d: (typeof allDocs)[0]) => ({
      _id:            String((d as Record<string, unknown>)['_id'] ?? ''),
      fileName:       d.fileName,
      filePath:       d.filePath,
      approvalStatus: d.approvalStatus,
      comments:       d.comments,
      uploadedBy:     d.uploadedBy,
      uploadedAt:     d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : String(d.uploadedAt ?? ''),
    });
    const mapWaive = (w: (typeof allDocs)[0]) => ({
      docId:           String((w as Record<string, unknown>)['_id'] ?? ''),
      waiveReasonId:   w.waiveReasonId   ?? '',
      waiveReasonName: w.waiveReasonName ?? '',
      waivedBy:        w.uploadedBy      ?? '',
      waivedAt:        w.uploadedAt instanceof Date ? w.uploadedAt.toISOString() : String(w.uploadedAt ?? ''),
    });

    // Technology Readiness (L3) items use 'Available'/'Not Available' rather than
    // 'Approved'/'Rejected' — the pre-approval synthesis below must match that.
    const TECH_READINESS_STAGE_CODE = 'Technology_Readiness';

    const stagesWithStatus = stages.map((stage) => {
      const stageIdStr  = String(stage.vendorStageId);
      const allStageReqs = reqsByStage.get(stageIdStr) ?? [];
      // L1 (Service-Category_Specific): only the vendor's selected service categories'
      // questions apply. Other stages (L2-L4) use every configured requirement, unchanged.
      const requirements = ROLE_STAGE_CODES.has(stage.vendorStageCode)
        ? allStageReqs.filter((r) => r.serviceRequestRoleId && vendorRoleIdSet.has(r.serviceRequestRoleId))
        : allStageReqs;

      const isTechReadinessStage = stage.vendorStageCode === TECH_READINESS_STAGE_CODE;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const confirmations: any[] = requirements.map((req) => {
        const roleId = req.serviceRequestRoleId ?? '';
        if (preApproveQualification) {
          return {
            confirmationId:         String((req as Record<string, unknown>)['_id'] ?? ''),
            vendorConfirmationId:   req.vendorConfirmationId,
            vendorConfirmationName: req.vendorConfirmationName,
            isMandatory:            req.isMandatory,
            documents: [{
              _id:            `preapproved-${req.vendorConfirmationId}`,
              fileName:       layerPlaceholderFileName(stage.vendorStageName),
              filePath:       '',
              approvalStatus: isTechReadinessStage ? 'Available' : 'Approved',
              comments:       '',
              uploadedBy:     'system',
              uploadedAt:     new Date().toISOString(),
            }],
            waiveInfo:            null,
            serviceRequestRoleId: roleId,
            serviceRoleName:      roleId ? (roleNameById.get(roleId) ?? '') : '',
          };
        }
        const docs     = regularDocsByConfirmation.get(req.vendorConfirmationId) ?? [];
        const waiveDoc = waiveDocByConfirmation.get(req.vendorConfirmationId) ?? null;
        return {
          confirmationId:         String((req as Record<string, unknown>)['_id'] ?? ''),
          vendorConfirmationId:   req.vendorConfirmationId,
          vendorConfirmationName: req.vendorConfirmationName,
          isMandatory:            req.isMandatory,
          documents:              docs.map(mapDoc),
          waiveInfo:              waiveDoc ? mapWaive(waiveDoc) : null,
          serviceRequestRoleId:   roleId,
          serviceRoleName:        roleId ? (roleNameById.get(roleId) ?? '') : '',
        };
      });

      let stageStatus: string;
      if (preApproveQualification) {
        stageStatus = 'Completed';
      } else {
        const allReqs: ConfirmationReq[] = requirements.map((r) => ({
          vendorConfirmationId: r.vendorConfirmationId,
          isMandatory:          r.isMandatory,
          serviceRequestRoleId: r.serviceRequestRoleId ?? '',
        }));

        const flatDocs: UploadedDoc[] = allDocs
          .filter((d) => allReqs.some((r) => r.vendorConfirmationId === d.vendorConfirmationId))
          .map((d) => ({ vendorConfirmationId: d.vendorConfirmationId, approvalStatus: d.approvalStatus }));

        stageStatus = computeStageStatus(allReqs, flatDocs);
      }

      return {
        stageId:         String(stage._id),
        vendorStageId:   stageIdStr,
        vendorStageCode: stage.vendorStageCode,
        vendorStageName: stage.vendorStageName,
        stageStatus,
        confirmations,
      };
    });

    const serviceRoles = serviceRoleItems;

    // ── roleSummary: approval status of every service role for this vendor ──────
    const approvedRoleIds = new Set<string>();
    for (const [vcId, docs] of regularDocsByConfirmation) {
      if (vcId.startsWith('role_') && docs.some((d) => d.approvalStatus === 'Approved')) {
        approvedRoleIds.add(vcId.slice(5));
      }
    }

    const roleSummary = allServiceRolesDocs.map((r, idx) => {
      const roleId = String(r['roleId'] ?? '');
      return {
        roleId,
        roleName:      String(r['roleName'] ?? ''),
        roleCode:      `S-${String(idx + 1).padStart(2, '0')}`,
        isVendorRole:  vendorRoleIdSet.has(roleId),
        approvalStatus: approvedRoleIds.has(roleId) ? 'Approved' : 'Pending',
      };
    });

    const createdAt = vendor['createdAt'] ? new Date(vendor['createdAt'] as string | Date).toISOString() : '';

    // "Member Since" = 1 year prior to the Requalification Start Date, falling
    // back to the vendor's createdAt if no requalification cycle has started yet.
    let memberSince = createdAt;
    if (vendor['RequalificationStartDate']) {
      const requalStart = new Date(vendor['RequalificationStartDate'] as string | Date);
      memberSince = new Date(requalStart.getFullYear() - 1, requalStart.getMonth(), requalStart.getDate()).toISOString();
    }

    res.status(200).json({
      success: true,
      data: {
        vendorId:     String(vendor['vendorId']     ?? ''),
        companyName:  String(vendor['companyName']  ?? ''),
        emailId:      String(vendor['emailId']      ?? ''),
        phoneNumber:  String(vendor['phoneNumber']  ?? ''),
        address:      String(vendor['address']      ?? ''),
        website:      String(vendor['website']      ?? ''),
        contactPersonName:  String(vendor['contactPersonName']  ?? ''),
        contactPersonPhone: String(vendor['contactPersonPhone'] ?? ''),
        contactPersonEmail: String(vendor['contactPersonEmail'] ?? ''),
        coverage:     String(vendor['Coverage'] ?? vendor['coverage'] ?? ''),
        city:         String(vendor['city']         ?? ''),
        state:        String(vendor['state']        ?? ''),
        country:      String(vendor['country']      ?? ''),
        vendorStatus: resolvedVendorStatus,
        vendorSource: String(vendor['vendorSource'] ?? ''),
        boostApplied: vendor['boostApplied'] === true,
        priorityBoost: existingBoost ? {
          states:             existingBoost.states ?? [],
          serviceDisciplines: existingBoost.serviceDisciplines ?? [],
          assignmentLimit:    existingBoost.assignmentLimit ?? null,
          reasonForBoost:     existingBoost.reasonForBoost ?? '',
        } : null,
        suspendedReason: String(vendor['suspendedReason'] ?? ''),
        disqualifiedReason: String(vendor['disqualifiedReason'] ?? ''),
        rating:       vendor['rating'] != null ? Number(vendor['rating']) : null,
        requalDue:    vendor['RequalificationEndDate']
          ? String(vendor['RequalificationEndDate'])
          : vendor['requalDue'] ? String(vendor['requalDue']) : '',
        createdAt,
        memberSince,
        stages: stagesWithStatus,
        serviceRoles,
        roleSummary,
        lockedServiceRoleIds: await resolveLockedRoleIds(vendorId, vendor as Record<string, unknown>),
      },
    });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getOnboardingDetails');
    res.status(500).json({ success: false, message: 'Internal server error while fetching onboarding details.' });
  }
}

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorStageId, vendorConfirmationId, fileName, fileBase64, uploadedBy, approvalStatus } = req.body as {
      vendorId?:             string;
      vendorStageId?:        string;
      vendorConfirmationId?: string;
      fileName?:             string;
      fileBase64?:           string;
      uploadedBy?:           string;
      approvalStatus?:       'Pending' | 'Approved' | 'Rejected' | 'Draft';
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    const status = approvalStatus ?? 'Pending';

    // For draft saves: remove any existing draft for this confirmation before inserting the new one
    if (status === 'Draft') {
      await ConfirmationDocModel.deleteOne({ vendorId, vendorConfirmationId, approvalStatus: 'Draft' });
    }

    // When vendor submits a replacement for a sent-back doc, remove the old 'Sent Back' record
    if (status === 'Pending') {
      await ConfirmationDocModel.deleteOne({ vendorId, vendorConfirmationId, approvalStatus: 'Sent Back' });
    }

    // Documents are stored in MongoDB (serverless hosting has no persistent disk).
    const storedBase64 = fileBase64 ? (fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64) : '';
    const filePath = '';

    await new ConfirmationDocModel({
      vendorId,
      vendorStageId:        vendorStageId        ?? '',
      vendorConfirmationId: vendorConfirmationId,
      fileName:             fileName             ?? '',
      filePath,
      fileBase64:           storedBase64,
      approvalStatus:       status,
      comments:             '',
      uploadedBy:           uploadedBy           ?? 'admin',
      uploadedAt:           new Date(),
    }).save();

    // Draft saves do not change vendor qualification status. Awaited (not fire-and-forget)
    // because a serverless function may be frozen as soon as the response is sent.
    if (status !== 'Draft') {
      await syncVendorStatus(vendorId).catch(() => {});
    }
    res.status(201).json({ success: true, message: 'Document uploaded successfully.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.uploadDocument');
    res.status(500).json({ success: false, message: 'Internal server error while uploading document.' });
  }
}

/** Serves a stored qualification document by its Mongo _id. */
export async function getDocument(req: Request, res: Response): Promise<void> {
  try {
    const { docId } = req.params as { docId?: string };
    if (!docId) { res.status(400).json({ success: false, message: 'docId is required.' }); return; }

    const doc = await ConfirmationDocModel.findById(docId);
    if (!doc || (!doc.filePath && !doc.fileBase64)) {
      res.status(404).json({ success: false, message: 'Document not found.' });
      return;
    }

    const ext = path.extname(doc.fileName).toLowerCase();
    const CONTENT_TYPES: Record<string, string> = {
      '.pdf':  'application/pdf',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif':  'image/gif',
      '.webp': 'image/webp',
      '.doc':  'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls':  'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(doc.fileName)}"`);
    if (doc.fileBase64) {
      res.send(Buffer.from(doc.fileBase64, 'base64'));
    } else if (doc.filePath && fs.existsSync(doc.filePath)) {
      fs.createReadStream(doc.filePath).pipe(res);
    } else {
      res.status(404).json({ success: false, message: 'No file content stored for this document (demo placeholder).' });
    }
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getDocument');
    res.status(500).json({ success: false, message: 'Internal server error while retrieving document.' });
  }
}

/** Removes a draft document so the vendor can upload a replacement. */
export async function removeDraftDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
    };
    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }
    await ConfirmationDocModel.deleteOne({ vendorId, vendorConfirmationId, approvalStatus: 'Draft' });
    res.status(200).json({ success: true, message: 'Draft removed.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.removeDraftDocument');
    res.status(500).json({ success: false, message: 'Internal server error while removing draft.' });
  }
}

/** Promotes a saved draft to Pending Review without re-uploading the file. */
export async function submitDraftDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
    };
    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }
    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId, approvalStatus: 'Draft' },
      { $set: { approvalStatus: 'Pending', uploadedAt: new Date() } },
    );
    res.status(200).json({ success: true, message: 'Document submitted for review.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.submitDraftDocument');
    res.status(500).json({ success: false, message: 'Internal server error while submitting draft.' });
  }
}

export async function approveDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId, comments } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
      comments?:             string;
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId },
      { $set: { approvalStatus: 'Approved', comments: comments ?? '' } }
    );

    res.status(200).json({ success: true, message: 'Document approved.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.approveDocument');
    res.status(500).json({ success: false, message: 'Internal server error while approving document.' });
  }
}

// Vendor recalls (withdraws) a Pending document they uploaded
export async function recallDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    await ConfirmationDocModel.deleteOne({ vendorId, vendorConfirmationId, approvalStatus: 'Pending' });

    res.status(200).json({ success: true, message: 'Document recalled successfully.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.recallDocument');
    res.status(500).json({ success: false, message: 'Internal server error while recalling document.' });
  }
}

export async function rejectDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId, comments } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
      comments?:             string;
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId },
      { $set: { approvalStatus: 'Rejected', comments: comments ?? '' } }
    );

    res.status(200).json({ success: true, message: 'Document rejected.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.rejectDocument');
    res.status(500).json({ success: false, message: 'Internal server error while rejecting document.' });
  }
}

export async function sendBackDocument(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId, comments } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
      comments?:             string;
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId, approvalStatus: 'Pending' },
      { $set: { approvalStatus: 'Sent Back', comments: comments ?? '' } },
    );

    const db = mongoose.connection.db!;
    await db.collection('vendor_details').updateOne(
      { vendorId },
      { $set: { vendorStatus: 'SendBack' } },
    );

    res.status(200).json({ success: true, message: 'Document sent back for revision.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.sendBackDocument');
    res.status(500).json({ success: false, message: 'Internal server error while sending back document.' });
  }
}

export async function resubmitApplication(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId } = req.body as { vendorId?: string };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const db = mongoose.connection.db!;
    const inProgressRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'InProgress' }, { VendorStatusName: 'InProgress' }, { VendorStatusName: 'In Progress' }],
    });
    const inProgressName = inProgressRecord
      ? String(inProgressRecord['VendorStatusName'] ?? 'InProgress')
      : 'InProgress';
    const statusSet: Record<string, unknown> = { vendorStatus: inProgressName };
    if (inProgressRecord) {
      statusSet['vendorStatusId'] = String(inProgressRecord['statusId'] ?? '');
      statusSet['Status']         = inProgressRecord['_id'];
    }

    await db.collection('vendor_details').updateOne(
      { vendorId, vendorStatus: 'SendBack' },
      { $set: statusSet },
    );

    res.status(200).json({ success: true, message: 'Application resubmitted for review.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.resubmitApplication');
    res.status(500).json({ success: false, message: 'Internal server error while resubmitting application.' });
  }
}

export async function finalApprove(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, performedBy, resetBoost } = req.body as { vendorId?: string; performedBy?: string; resetBoost?: boolean };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const stages = await ProcessingStageModel.find().sort({ _id: 1 }).lean();
    const stageIds = stages.map((s) => String(s.vendorStageId));

    const [allRequirements, allDocs] = await Promise.all([
      ConfirmationStageModel.find({ vendorStageId: { $in: stageIds } }).lean(),
      ConfirmationDocModel.find({ vendorId }).lean(),
    ]);

    const reqsByStage = new Map<string, typeof allRequirements>();
    for (const r of allRequirements) {
      if (!reqsByStage.has(r.vendorStageId)) reqsByStage.set(r.vendorStageId, []);
      reqsByStage.get(r.vendorStageId)!.push(r);
    }

    // Fetch the vendor's service role IDs (and current status, for the
    // Activated-vs-Reactivated history entry below) in one go.
    const vendorRecord = await mongoose.connection.db!
      .collection('vendor_details').findOne({ vendorId }, { projection: { serviceRequestRoleId: 1, vendorStatus: 1, boostApplied: 1 } });
    const priorVendorStatus = String(vendorRecord?.['vendorStatus'] ?? '');
    const vendorRoleIds: string[] = Array.isArray(vendorRecord?.['serviceRequestRoleId'])
      ? (vendorRecord!['serviceRequestRoleId'] as string[])
      : vendorRecord?.['serviceRequestRoleId']
        ? [String(vendorRecord['serviceRequestRoleId'])]
        : [];
    const vendorRoleIdSet = new Set(vendorRoleIds);
    const roleStageCodes = new Set(['Service-Category_Specific']);

    // Priority Boost workflow (2026-07-24: Activation Confirmation Dialog):
    // Suspended / Requalification Due / In Progress vendors are no longer
    // hard-blocked from activating without a Priority Boost — the frontend's
    // Activate confirmation dialog now lets the caller explicitly choose
    // "Activate without Priority Boost", which must succeed here rather than
    // 422. These same three statuses mirror the "TEMPORARY (testing only)"
    // synthetic pre-approval already applied in getOnboardingDetails (every
    // Qualification Layer question shown as pre-approved without real
    // uploads) — the per-stage document-completion check below reads REAL
    // ConfirmationDocModel records, not that synthetic view, so without this
    // same carve-out here, "Activate without Priority Boost" would 422 on
    // "stage not completed" for exactly the vendors this flow targets, even
    // though the details screen already showed every stage as Completed.
    // "In Progress" is checked in both spaced/unspaced forms since
    // vendorStatus is stored as whatever VendorStatusName the tenant's
    // vendor_status collection uses (see syncVendorStatus), unlike
    // Suspended/Requalification Due which are always written pre-spaced by
    // their own status-change paths.
    const preApproveQualification = priorVendorStatus === 'Suspended'
      || priorVendorStatus === 'Requalification Due'
      || priorVendorStatus === 'In Progress'
      || priorVendorStatus === 'InProgress';
    const boostApplied = vendorRecord?.['boostApplied'] === true;

    if (!boostApplied && !preApproveQualification) {
      for (const stage of stages) {
        const stageIdStr   = String(stage.vendorStageId);
        const allStageReqs = reqsByStage.get(stageIdStr) ?? [];
        const requirements = roleStageCodes.has(stage.vendorStageCode)
          ? allStageReqs.filter((r) => r.serviceRequestRoleId && vendorRoleIdSet.has(r.serviceRequestRoleId))
          : allStageReqs;

        const allReqs: ConfirmationReq[] = requirements.map((r) => ({
          vendorConfirmationId: r.vendorConfirmationId,
          isMandatory:          r.isMandatory,
          serviceRequestRoleId: r.serviceRequestRoleId ?? '',
        }));

        const flatDocs: UploadedDoc[] = allDocs
          .filter((d) => allReqs.some((r) => r.vendorConfirmationId === d.vendorConfirmationId))
          .map((d) => ({ vendorConfirmationId: d.vendorConfirmationId, approvalStatus: d.approvalStatus }));

        const status = computeStageStatus(allReqs, flatDocs);
        if (status !== 'Completed') {
          res.status(422).json({
            success: false,
            message: `Stage "${stage.vendorStageName}" is not completed. All stages must be completed before final approval.`,
          });
          return;
        }
      }
    }

    const db = mongoose.connection.db!;

    const approvedRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'Active' }, { VendorStatusName: 'Active' }],
    });
    const approvedStatusId = approvedRecord ? String(approvedRecord['statusId']) : null;

    // Reset the requalification cycle so the vendor doesn't immediately fall
    // back into "RequalificationDue" on the next sync.
    const now = new Date();
    const nextRequalEndDate = new Date(now);
    nextRequalEndDate.setFullYear(nextRequalEndDate.getFullYear() + 1);

    const approveUpdate: Record<string, unknown> = {
      vendorStatus: 'Active',
      manualStatusOverride: true,
      suspendedReason: '',
      disqualifiedReason: '',
      RequalificationStartDate: now.toISOString(),
      RequalificationEndDate: nextRequalEndDate.toISOString(),
    };
    if (approvedStatusId) approveUpdate['vendorStatusId'] = approvedStatusId;
    if (approvedRecord) approveUpdate['Status'] = approvedRecord['_id'];
    // "Activate without Boost": the vendor's Boost value must read No even if
    // a PRIOR Priority Boost had left it Yes (e.g. re-suspended, then
    // reactivated this time without boosting again) — the Priority Boost
    // record itself (vendor_priority_boost) is left untouched, only this
    // denormalized flag is reset.
    if (resetBoost) approveUpdate['boostApplied'] = false;

    await db.collection('vendor_details').updateOne({ vendorId }, { $set: approveUpdate });

    const historyAction = REACTIVATION_SOURCE_STATUSES.has(priorVendorStatus) ? 'Reactivated' : 'Activated';
    // Record which of the two Activate paths was used so the History log
    // distinguishes them — otherwise every entry reads identically
    // regardless of whether Priority Boost was part of this activation.
    // `resetBoost` is the explicit "Activate without Boost" signal (sent
    // even if a prior boost had left `boostApplied` true); `boostApplied`
    // here already reflects "Activate with Boost" having just run
    // (applyPriorityBoost's own request completes before this one).
    const boostRemark = resetBoost
      ? 'Activated without Priority Boost'
      : boostApplied
        ? 'Activated with Priority Boost'
        : '';
    await recordVendorHistory(vendorId, historyAction, '', boostRemark, performedBy);

    res.status(200).json({ success: true, message: 'Service Provider activated successfully.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.finalApprove');
    res.status(500).json({ success: false, message: 'Internal server error during final approval.' });
  }
}

export async function applyPriorityBoost(req: Request, res: Response): Promise<void> {
  try {
    const {
      vendorId, states, serviceDisciplines, assignmentLimit, reasonForBoost, performedBy,
    } = req.body as {
      vendorId?: string; states?: string[]; serviceDisciplines?: string[];
      assignmentLimit?: number | null; reasonForBoost?: string; performedBy?: string;
    };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }
    if (!Array.isArray(states) || states.length === 0) {
      res.status(422).json({ success: false, message: 'At least one state is required.' });
      return;
    }
    if (!Array.isArray(serviceDisciplines) || serviceDisciplines.length === 0) {
      res.status(422).json({ success: false, message: 'At least one service discipline is required.' });
      return;
    }
    if (!reasonForBoost || !reasonForBoost.trim()) {
      res.status(422).json({ success: false, message: 'Reason for Boost is required.' });
      return;
    }

    const limit = assignmentLimit === undefined || assignmentLimit === null || (assignmentLimit as unknown as string) === ''
      ? null
      : Number(assignmentLimit);

    await VendorPriorityBoostModel.findOneAndUpdate(
      { vendorId },
      {
        $set: {
          states, serviceDisciplines, assignmentLimit: limit,
          reasonForBoost: reasonForBoost.trim(), boostApplied: true, updatedAt: new Date(),
        },
        $setOnInsert: { createdBy: performedBy || 'admin', createdAt: new Date() },
      },
      { upsert: true, new: true },
    );

    await mongoose.connection.db!
      .collection('vendor_details').updateOne({ vendorId }, { $set: { boostApplied: true } });

    res.status(200).json({ success: true, message: 'Priority Boost applied successfully.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.applyPriorityBoost');
    res.status(500).json({ success: false, message: 'Internal server error while applying Priority Boost.' });
  }
}

export async function getVendorStatusHistory(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId } = req.params as { vendorId?: string };
    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const entries = await VendorStatusHistoryModel
      .find({ vendorId })
      .sort({ performedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: entries.map((e) => ({
        historyId:   e.historyId,
        vendorId:    e.vendorId,
        action:      e.action,
        reason:      e.reason ?? '',
        remarks:     e.remarks ?? '',
        performedBy: e.performedBy ?? '',
        performedAt: e.performedAt,
      })),
    });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getVendorStatusHistory');
    res.status(500).json({ success: false, message: 'Internal server error while fetching vendor status history.' });
  }
}

export async function suspendVendor(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, reason, performedBy } = req.body as { vendorId?: string; reason?: string; performedBy?: string };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const db = mongoose.connection.db!;

    // Look up the Suspended status record from vendor_status
    const statusRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'Suspended' }, { VendorStatusName: 'Suspended' }],
    });

    const statusId = statusRecord ? String(statusRecord['statusId']) : null;
    const trimmedReason = (reason ?? '').trim();

    const update: Record<string, unknown> = {
      vendorStatus: 'Suspended',
      manualStatusOverride: true,
      suspendedReason: trimmedReason,
    };
    if (statusId) update['vendorStatusId'] = statusId;
    if (statusRecord) update['Status'] = statusRecord['_id'];

    await db.collection('vendor_details').updateOne({ vendorId }, { $set: update });
    await recordVendorHistory(vendorId, 'Suspended', trimmedReason, '', performedBy);

    res.status(200).json({ success: true, message: 'Vendor suspended.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.suspendVendor');
    res.status(500).json({ success: false, message: 'Internal server error while suspending vendor.' });
  }
}

export async function disqualifyVendor(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, reason, performedBy } = req.body as { vendorId?: string; reason?: string; performedBy?: string };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const db = mongoose.connection.db!;

    // Look up the Disqualified status record from vendor_status
    const statusRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'Disqualified' }, { VendorStatusName: 'Disqualified' }],
    });

    const statusId = statusRecord ? String(statusRecord['statusId']) : null;
    const trimmedReason = (reason ?? '').trim();

    const update: Record<string, unknown> = {
      vendorStatus: 'Disqualified',
      manualStatusOverride: true,
      disqualifiedReason: trimmedReason,
    };
    if (statusId) update['vendorStatusId'] = statusId;
    if (statusRecord) update['Status'] = statusRecord['_id'];

    await db.collection('vendor_details').updateOne({ vendorId }, { $set: update });
    await recordVendorHistory(vendorId, 'Disqualified', trimmedReason, '', performedBy);

    res.status(200).json({ success: true, message: 'Vendor disqualified.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.disqualifyVendor');
    res.status(500).json({ success: false, message: 'Internal server error while disqualifying vendor.' });
  }
}

export async function setAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorStageId, vendorConfirmationId, status } = req.body as {
      vendorId?:             string;
      vendorStageId?:        string;
      vendorConfirmationId?: string;
      status?:               'Available' | 'Not Available';
    };

    if (!vendorId || !vendorConfirmationId || !status) {
      res.status(400).json({ success: false, message: 'vendorId, vendorConfirmationId, and status are required.' });
      return;
    }

    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId },
      {
        $set: {
          approvalStatus: status,
          vendorStageId:  vendorStageId ?? '',
          fileName:       '',
          filePath:       '',
          fileBase64:     '',
          comments:       '',
          uploadedBy:     'system',
          uploadedAt:     new Date(),
        },
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, message: `Availability set to "${status}".` });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.setAvailability');
    res.status(500).json({ success: false, message: 'Internal server error while setting availability.' });
  }
}

export async function getWaiveReasons(req: Request, res: Response): Promise<void> {
  try {
    const reasons = await WaiveReasonModel.find({ isActive: true }).lean();
    res.status(200).json({
      success: true,
      data: reasons.map((r) => ({
        waiveReasonId:   r.waiveReasonId,
        waiveReasonCode: r.waiveReasonCode,
        waiveReasonName: r.waiveReasonName,
        isActive:        r.isActive,
      })),
    });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getWaiveReasons');
    res.status(500).json({ success: false, message: 'Internal server error fetching waive reasons.' });
  }
}

export async function waiveConfirmation(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorStageId, vendorConfirmationId, waiveReasonId, waiveReasonName, waivedBy } = req.body as {
      vendorId?:             string;
      vendorStageId?:        string;
      vendorConfirmationId?: string;
      waiveReasonId?:        string;
      waiveReasonName?:      string;
      waivedBy?:             string;
    };

    if (!vendorId || !vendorConfirmationId || !waiveReasonId) {
      res.status(400).json({ success: false, message: 'vendorId, vendorConfirmationId, and waiveReasonId are required.' });
      return;
    }

    await ConfirmationDocModel.findOneAndUpdate(
      { vendorId, vendorConfirmationId, approvalStatus: 'Waived' },
      {
        $set: {
          approvalStatus:  'Waived',
          vendorStageId:   vendorStageId   ?? '',
          fileName:        'waive_record',
          filePath:        '',
          fileBase64:      '',
          waiveReasonId:   waiveReasonId   ?? '',
          waiveReasonName: waiveReasonName ?? '',
          comments:        waiveReasonName ?? '',
          uploadedBy:      waivedBy        ?? 'admin',
          uploadedAt:      new Date(),
        },
      },
      { upsert: true, new: true },
    );

    res.status(200).json({ success: true, message: 'Waive applied.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.waiveConfirmation');
    res.status(500).json({ success: false, message: 'Internal server error while applying waive.' });
  }
}

export async function clearWaive(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, vendorConfirmationId } = req.body as {
      vendorId?:             string;
      vendorConfirmationId?: string;
    };

    if (!vendorId || !vendorConfirmationId) {
      res.status(400).json({ success: false, message: 'vendorId and vendorConfirmationId are required.' });
      return;
    }

    await ConfirmationDocModel.deleteOne({ vendorId, vendorConfirmationId, approvalStatus: 'Waived' });

    res.status(200).json({ success: true, message: 'Waive cleared.' });
    syncVendorStatus(vendorId).catch(() => {});
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.clearWaive');
    res.status(500).json({ success: false, message: 'Internal server error while clearing waive.' });
  }
}

// ─── Locked-role resolution ───────────────────────────────────────────────────
// Returns the role IDs that were selected during the original vendor onboarding.
// Priority: (1) lockedServiceRoleIds already in DB, (2) services from the oldest
// VendorServiceRequest, (3) the original single serviceRequestRoleId string.
async function resolveLockedRoleIds(
  vendorId: string,
  vendorDoc: Record<string, unknown> | null,
): Promise<string[]> {
  if (Array.isArray(vendorDoc?.['lockedServiceRoleIds'])) {
    return vendorDoc!['lockedServiceRoleIds'] as string[];
  }
  // Use the original vendor service request as the authoritative source
  const origRequest = await VendorServiceRequestModel.findOne({ vendorDetailId: vendorId })
    .sort({ createdAt: 1 })
    .lean();
  if (Array.isArray(origRequest?.['services']) && (origRequest!['services'] as string[]).length > 0) {
    return origRequest!['services'] as string[];
  }
  // Final fallback: original single serviceRequestRoleId (string form, not yet modified)
  const rawId = vendorDoc?.['serviceRequestRoleId'];
  if (rawId && !Array.isArray(rawId)) return [String(rawId)];
  return [];
}

// ─── Update service roles ─────────────────────────────────────────────────────

export async function updateServiceRoles(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, roleIds } = req.body as { vendorId?: string; roleIds?: string[] };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }
    if (!Array.isArray(roleIds)) {
      res.status(400).json({ success: false, message: 'roleIds must be an array.' });
      return;
    }

    const db = mongoose.connection.db!;

    const vendorDoc = await db.collection('vendor_details').findOne(
      { vendorId },
      { projection: { lockedServiceRoleIds: 1, serviceRequestRoleId: 1 } },
    ) as Record<string, unknown> | null;

    // Resolve locked roles from the authoritative source (original vendor service request)
    const lockedIds = await resolveLockedRoleIds(vendorId, vendorDoc);
    const mergedRoleIds = [...new Set([...lockedIds, ...roleIds])];

    // Persist lockedServiceRoleIds on first edit so the locked set never changes
    const updateFields: Record<string, unknown> = { serviceRequestRoleId: mergedRoleIds };
    if (!Array.isArray(vendorDoc?.['lockedServiceRoleIds'])) {
      updateFields['lockedServiceRoleIds'] = lockedIds;
    }

    const result = await db.collection('vendor_details').updateOne(
      { vendorId },
      { $set: updateFields },
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ success: false, message: `No vendor found with vendorId: ${vendorId}` });
      return;
    }

    res.status(200).json({ success: true, message: 'Service roles updated successfully.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.updateServiceRoles');
    res.status(500).json({ success: false, message: 'Internal server error while updating service roles.' });
  }
}

// ─── Pending Approval (newly submitted vendor requests) ───────────────────────

export async function getPendingApprovalDetails(req: Request, res: Response): Promise<void> {
  try {
    const vendorId = req.params['vendorId'] as string;

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId path parameter is required.' });
      return;
    }

    const vendor = await mongoose.connection.db!.collection('vendor_details').findOne({ vendorId });
    if (!vendor) {
      res.status(404).json({ success: false, message: `No vendor found with vendorId: ${vendorId}` });
      return;
    }

    let request = await VendorServiceRequestModel.findOne({
      vendorDetailId: vendorId,
      status: { $in: ['submitted', 'in_review'] },
    }).sort({ createdAt: -1 }).lean();

    // Fallback for legacy records where vendorDetailId was not set during signup
    if (!request) {
      const vendorEmail = String(vendor['emailId'] ?? vendor['email'] ?? '').toLowerCase().trim();
      if (vendorEmail) {
        const fallback = await VendorServiceRequestModel.findOne({
          email: vendorEmail,
          status: { $in: ['submitted', 'in_review'] },
        }).sort({ createdAt: -1 }).lean();
        if (fallback) {
          await VendorServiceRequestModel.updateOne(
            { requestId: fallback.requestId },
            { $set: { vendorDetailId: vendorId } },
          );
          request = fallback;
        }
      }
    }

    const services = await resolveServiceRoleNames(request?.services ?? []);

    const coverage = request
      ? request.coverage
      : String(vendor['Coverage'] ?? vendor['coverage'] ?? '').split(',').map((c) => c.trim()).filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        vendorId,
        requestId:    request ? request.requestId : '',
        companyName:  request ? request.companyName : String(vendor['companyName'] ?? ''),
        address:      request ? request.address     : String(vendor['address']     ?? ''),
        email:        request ? request.email       : String(vendor['emailId']     ?? ''),
        phone:        request ? request.phone       : String(vendor['phoneNumber'] ?? ''),
        website:       request ? request.website       : String(vendor['website']       ?? ''),
        contactPerson: request ? request.contactPerson : String(vendor['contactPerson'] ?? ''),
        contactPersonName:  request ? request.contactPersonName  : '',
        contactPersonPhone: request ? request.contactPersonPhone : '',
        contactPersonEmail: request ? request.contactPersonEmail : '',
        services,
        coverage,
        submittedBy:  request?.submittedBy ?? '',
        submittedAt:  request?.submittedAt ? new Date(request.submittedAt).toISOString() : '',
        vendorStatus: String(vendor['vendorStatus'] ?? ''),
      },
    });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.getPendingApprovalDetails');
    res.status(500).json({ success: false, message: 'Internal server error while fetching pending approval details.' });
  }
}

export async function approveVendorRequest(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, approvedServiceRoleIds } = req.body as {
      vendorId?: string;
      approvedServiceRoleIds?: string[];
    };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const db = mongoose.connection.db!;

    const request = await VendorServiceRequestModel.findOne({
      vendorDetailId: vendorId,
      status: { $in: ['submitted', 'in_review'] },
    }).sort({ createdAt: -1 });

    if (request) {
      request.status     = 'approved';
      request.reviewedBy = 'Admin';
      request.reviewedAt = new Date();
      await request.save();

      // Use the Client Manager's approved subset; fall back to all requested services.
      const finalRoleIds: string[] =
        Array.isArray(approvedServiceRoleIds) && approvedServiceRoleIds.length > 0
          ? approvedServiceRoleIds
          : (Array.isArray(request.services) ? (request.services as string[]) : []);

      if (finalRoleIds.length > 0) {
        await db.collection('vendor_details').updateOne(
          { vendorId },
          { $set: { serviceRequestRoleId: finalRoleIds, lockedServiceRoleIds: finalRoleIds } },
        );
      }
    }

    // Always advance to In Progress on approval, regardless of whatever status string
    // is currently stored (syncVendorStatus is conditional and would silently skip
    // records whose vendorStatus doesn't exactly match 'Open'/'Pending Approval').
    const inProgressRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'InProgress' }, { VendorStatusName: 'InProgress' }, { VendorStatusName: 'In Progress' }],
    });

    // Use the actual VendorStatusName from the DB so vendor_details stays
    // consistent with whatever casing the tenant's collection uses.
    const inProgressName = inProgressRecord
      ? String(inProgressRecord['VendorStatusName'] ?? 'InProgress')
      : 'InProgress';
    const statusSet: Record<string, unknown> = { vendorStatus: inProgressName };
    if (inProgressRecord) {
      statusSet['vendorStatusId'] = String(inProgressRecord['statusId'] ?? '');
      statusSet['Status']         = inProgressRecord['_id'];
    }

    // Primary update: match by vendorId UUID. Always unconditional — approval
    // always advances to In Progress regardless of current status.
    const updateResult = await db.collection('vendor_details').updateOne({ vendorId }, { $set: statusSet });

    // Fallback: if no document matched by vendorId (e.g. legacy record inserted
    // without that field), locate by email and also stamp the correct vendorId
    // so future lookups use the indexed field.
    if (updateResult.matchedCount === 0) {
      const lookupEmail = request?.email ?? '';
      if (lookupEmail) {
        await db.collection('vendor_details').updateOne(
          { emailId: lookupEmail, vendorStatus: { $ne: 'Active' } },
          { $set: { ...statusSet, vendorId } },
        );
      }
    }

    res.status(200).json({ success: true, message: 'Vendor request approved.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.approveVendorRequest');
    res.status(500).json({ success: false, message: 'Internal server error while approving vendor request.' });
  }
}

export async function rejectVendorRequest(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId } = req.body as { vendorId?: string };

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const request = await VendorServiceRequestModel.findOne({
      vendorDetailId: vendorId,
      status: { $in: ['submitted', 'in_review'] },
    }).sort({ createdAt: -1 });

    if (request) {
      request.status     = 'rejected';
      request.reviewedBy = 'Admin';
      request.reviewedAt = new Date();
      await request.save();
    }

    const db = mongoose.connection.db!;

    // Look up the Disqualified status record from vendor_status
    const statusRecord = await db.collection('vendor_status').findOne({
      $or: [{ VendorStatusCode: 'Disqualified' }, { VendorStatusName: 'Disqualified' }],
    });

    const statusId = statusRecord ? String(statusRecord['statusId']) : null;

    const update: Record<string, unknown> = { vendorStatus: 'Disqualified', manualStatusOverride: true };
    if (statusId) update['vendorStatusId'] = statusId;
    if (statusRecord) update['Status'] = statusRecord['_id'];

    await db.collection('vendor_details').updateOne({ vendorId }, { $set: update });
    await recordVendorHistory(vendorId, 'Disqualified', 'Vendor service request rejected.', '', 'Admin');

    res.status(200).json({ success: true, message: 'Vendor request rejected.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.rejectVendorRequest');
    res.status(500).json({ success: false, message: 'Internal server error while rejecting vendor request.' });
  }
}

// ─── Vendor profile self-update ───────────────────────────────────────────────

export async function updateVendorProfile(req: Request, res: Response): Promise<void> {
  try {
    const vendorId = req.params['vendorId'] as string;
    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const {
      companyName,
      emailId,
      phoneNumber,
      address,
      website,
      contactPersonName,
      contactPersonEmail,
      contactPersonPhone,
      coverageStates,
    } = req.body as {
      companyName?:          string;
      emailId?:              string;
      phoneNumber?:          string;
      address?:              string;
      website?:              string;
      contactPersonName?:    string;
      contactPersonEmail?:   string;
      contactPersonPhone?:   string;
      coverageStates?:       string[];
    };

    const db = mongoose.connection.db!;
    const updates: Record<string, unknown> = {};

    if (companyName  !== undefined) updates['companyName']  = companyName.trim();
    if (emailId      !== undefined) updates['emailId']      = emailId.trim().toLowerCase();
    if (phoneNumber  !== undefined) updates['phoneNumber']  = phoneNumber.trim();
    if (address      !== undefined) updates['address']      = address.trim();
    if (website      !== undefined) updates['website']      = website.trim();
    if (contactPersonName  !== undefined) updates['contactPersonName']  = contactPersonName.trim();
    if (contactPersonEmail !== undefined) updates['contactPersonEmail'] = contactPersonEmail.trim().toLowerCase();
    if (contactPersonPhone !== undefined) updates['contactPersonPhone'] = contactPersonPhone.trim();
    if (Array.isArray(coverageStates)) {
      updates['Coverage'] = coverageStates.filter(Boolean).join(', ');
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No updatable fields provided.' });
      return;
    }

    // If vendor is currently Active, any profile change reverts them to Pending Approval
    const currentVendor = await db.collection('vendor_details').findOne({ vendorId });
    if (currentVendor && String(currentVendor['vendorStatus']) === 'Active') {
      updates['vendorStatus'] = 'Pending Approval';
    }

    const result = await db.collection('vendor_details').updateOne(
      { vendorId },
      { $set: updates },
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ success: false, message: `No vendor found with vendorId: ${vendorId}` });
      return;
    }

    res.status(200).json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    await logError(err as Error, 'vendorOnboardingController.updateVendorProfile');
    res.status(500).json({ success: false, message: 'Internal server error while updating profile.' });
  }
}
