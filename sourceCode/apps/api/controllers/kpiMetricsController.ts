import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '../services/errorLogService';

// ─── Mongoose Models ──────────────────────────────────────────────────────────

interface IKpiMatrics extends Document {
  kpiMatricsId:        string;
  serviceRequestRoleId: string;
  kpiGroupTracking:    string;
  isActive:            boolean;
  createdBy:           string;
  createdAt:           Date;
  updatedBy:           string;
  updatedAt:           Date;
}

interface IKpiGroupTracking extends Document {
  kpiMatricsGroupTrackingId: string;
  kpiMatricsId:              string;
  kpiGroupTracking:          string;
  kpiGroupTrackingSuggestion: string;
  isVendorKPI:               boolean;
  isActive:                  boolean;
  createdBy:                 string;
  createdAt:                 Date;
  updatedBy:                 string;
  updatedAt:                 Date;
}

interface IKpiFieldAndSections extends Document {
  kpiMatricsFieldAndSectionsId: string;
  kpiMatricsGroupTrackingId:    string;
  thresholdsGood:               string;
  thresholdsModerate:           string;
  thresholdsPoor:               string;
  betterWhen:                   string;
  aiSuggestionAccepted:         boolean;
  createdBy:                    string;
  createdAt:                    Date;
  updatedBy:                    string;
  updatedAt:                    Date;
}

interface IKpiCondition extends Document {
  kpiMatricsFieldAndConditionId: string;
  kpiMatricsFieldAndSectionsId:  string;
  fieldName:                     string;
  operator:                      string;
  value:                         string;
  ShowValue:                     string;
  conditionType:                 string;
  sortOrder:                     number;
  createdBy:                     string;
  createdAt:                     Date;
  updatedBy:                     string;
  updatedAt:                     Date;
}

const KpiMatricsModel =
  (mongoose.models['KPI_Matrics'] as mongoose.Model<IKpiMatrics>) ||
  mongoose.model<IKpiMatrics>('KPI_Matrics', new Schema<IKpiMatrics>({
    kpiMatricsId:        { type: String, required: true, unique: true },
    serviceRequestRoleId: { type: String, required: true },
    kpiGroupTracking:    { type: String, required: true },
    isActive:            { type: Boolean, default: true },
    createdBy:           { type: String, default: 'Admin' },
    createdAt:           { type: Date, default: Date.now },
    updatedBy:           { type: String, default: 'Admin' },
    updatedAt:           { type: Date, default: Date.now },
  }));

const KpiGroupTrackingModel =
  (mongoose.models['KPI_Matrics_Group_Tracking'] as mongoose.Model<IKpiGroupTracking>) ||
  mongoose.model<IKpiGroupTracking>('KPI_Matrics_Group_Tracking', new Schema<IKpiGroupTracking>({
    kpiMatricsGroupTrackingId: { type: String, required: true, unique: true },
    kpiMatricsId:              { type: String, required: true },
    kpiGroupTracking:          { type: String, default: '' },
    kpiGroupTrackingSuggestion: { type: String, default: '' },
    isVendorKPI:               { type: Boolean, default: false },
    isActive:                  { type: Boolean, default: true },
    createdBy:                 { type: String, default: 'Admin' },
    createdAt:                 { type: Date, default: Date.now },
    updatedBy:                 { type: String, default: 'Admin' },
    updatedAt:                 { type: Date, default: Date.now },
  }));

const KpiFieldAndSectionsModel =
  (mongoose.models['KPI_Matrics_Field_And_Sections'] as mongoose.Model<IKpiFieldAndSections>) ||
  mongoose.model<IKpiFieldAndSections>('KPI_Matrics_Field_And_Sections', new Schema<IKpiFieldAndSections>({
    kpiMatricsFieldAndSectionsId: { type: String, required: true, unique: true },
    kpiMatricsGroupTrackingId:    { type: String, required: true },
    thresholdsGood:               { type: String, default: '' },
    thresholdsModerate:           { type: String, default: '' },
    thresholdsPoor:               { type: String, default: '' },
    betterWhen:                   { type: String, default: 'Lower' },
    aiSuggestionAccepted:         { type: Boolean, default: false },
    createdBy:                    { type: String, default: 'Admin' },
    createdAt:                    { type: Date, default: Date.now },
    updatedBy:                    { type: String, default: 'Admin' },
    updatedAt:                    { type: Date, default: Date.now },
  }));

const KpiConditionModel =
  (mongoose.models['KPI_Matrics_Field_And_Condition'] as mongoose.Model<IKpiCondition>) ||
  mongoose.model<IKpiCondition>('KPI_Matrics_Field_And_Condition', new Schema<IKpiCondition>({
    kpiMatricsFieldAndConditionId: { type: String, required: true, unique: true },
    kpiMatricsFieldAndSectionsId:  { type: String, required: true },
    fieldName:                     { type: String, default: '' },
    operator:                      { type: String, default: '' },
    value:                         { type: String, default: '' },
    ShowValue:                     { type: String, default: '' },
    conditionType:                 { type: String, default: '' },
    sortOrder:                     { type: Number, default: 0 },
    createdBy:                     { type: String, default: 'Admin' },
    createdAt:                     { type: Date, default: Date.now },
    updatedBy:                     { type: String, default: 'Admin' },
    updatedAt:                     { type: Date, default: Date.now },
  }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const now = () => new Date();

// ─── GET /roles ───────────────────────────────────────────────────────────────

export async function getRoles(req: Request, res: Response): Promise<void> {
  try {
    const roles = await mongoose.connection.db!
      .collection('service_request_roles')
      .find({ status: { $ne: 'Inactive' } })
      .sort({ roleName: 1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: roles.map((r) => ({
        roleId:   String(r['roleId'] ?? ''),
        roleName: String(r['roleName'] ?? ''),
        roleCode: String(r['roleCode'] ?? ''),
      })),
    });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.getRoles');
    res.status(500).json({ success: false, message: 'Failed to load service roles.' });
  }
}

// ─── GET /?roleId= ────────────────────────────────────────────────────────────

export async function getKpiMetrics(req: Request, res: Response): Promise<void> {
  try {
    const roleId = String(req.query['roleId'] ?? '');
    if (!roleId) { res.status(400).json({ success: false, message: 'roleId is required.' }); return; }

    const kpiMatrics = await KpiMatricsModel.find({ serviceRequestRoleId: roleId }).sort({ createdAt: 1 }).lean();

    // Join kpi_matrics_group_trackings by kpiMatricsId FK
    const kpiIds = kpiMatrics.map((k) => k.kpiMatricsId);

    const groupTrackings = await KpiGroupTrackingModel.find({
      kpiMatricsId: { $in: kpiIds },
    }).sort({ createdAt: 1 }).lean();
    
    const gtIds = groupTrackings.map((g) => g.kpiMatricsGroupTrackingId);

    const sections = await KpiFieldAndSectionsModel.find({ kpiMatricsGroupTrackingId: { $in: gtIds } }).lean();
    const secIds = sections.map((s) => s.kpiMatricsFieldAndSectionsId);

    const conditions = await KpiConditionModel.find({ kpiMatricsFieldAndSectionsId: { $in: secIds } }).sort({ sortOrder: 1 }).lean();

    // Build lookup maps
    const sectionByGt = new Map(sections.map((s) => [s.kpiMatricsGroupTrackingId, s]));
    const condsBySection = new Map<string, typeof conditions>();
    for (const c of conditions) {
      if (!condsBySection.has(c.kpiMatricsFieldAndSectionsId)) condsBySection.set(c.kpiMatricsFieldAndSectionsId, []);
      condsBySection.get(c.kpiMatricsFieldAndSectionsId)!.push(c);
    }
    // Group tracking records by their kpiMatricsId FK
    const gtsByGroupTracking = new Map<string, typeof groupTrackings>();
    for (const g of groupTrackings) {
      if (!gtsByGroupTracking.has(g.kpiMatricsId)) gtsByGroupTracking.set(g.kpiMatricsId, []);
      gtsByGroupTracking.get(g.kpiMatricsId)!.push(g);
    }

    const data = kpiMatrics.map((km) => {
      const gts = (gtsByGroupTracking.get(km.kpiMatricsId) ?? []).map((gt) => {
        const sec = sectionByGt.get(gt.kpiMatricsGroupTrackingId);
        const conds = sec ? (condsBySection.get(sec.kpiMatricsFieldAndSectionsId) ?? []) : [];
        return {
          kpiMatricsGroupTrackingId: gt.kpiMatricsGroupTrackingId,
          kpiGroupTracking:          gt.kpiGroupTracking,
          kpiGroupTrackingSuggestion: gt.kpiGroupTrackingSuggestion,
          isVendorKPI:               gt.isVendorKPI ?? false,
          isActive:                  gt.isActive,
          updatedBy:                 gt.updatedBy,
          updatedAt:                 gt.updatedAt,
          section: sec ? {
            kpiMatricsFieldAndSectionsId: sec.kpiMatricsFieldAndSectionsId,
            thresholdsGood:     sec.thresholdsGood,
            thresholdsModerate: sec.thresholdsModerate,
            thresholdsPoor:     sec.thresholdsPoor,
            betterWhen:         sec.betterWhen,
          } : null,
          conditions: conds.map((c) => ({
            kpiMatricsFieldAndConditionId: c.kpiMatricsFieldAndConditionId,
            fieldName:     c.fieldName,
            operator:      c.operator,
            value:         c.value,
            ShowValue:     c.ShowValue ?? '',
            conditionType: c.conditionType,
            sortOrder:     c.sortOrder,
          })),
        };
      });

      return {
        kpiMatricsId:     km.kpiMatricsId,
        kpiGroupTracking: km.kpiGroupTracking,
        isVendorKPI:      gts.length > 0 ? (gts[0].isVendorKPI ?? false) : false,
        isActive:         km.isActive,
        metrics:          gts,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.getKpiMetrics');
    res.status(500).json({ success: false, message: 'Failed to load KPI metrics.' });
  }
}

// ─── GET /for-claim?roleIds=id1,id2 ──────────────────────────────────────────

export async function getKpiMetricsForClaim(req: Request, res: Response): Promise<void> {
  try {
    const raw = String(req.query['roleIds'] ?? '');
    if (!raw) { res.status(400).json({ success: false, message: 'roleIds is required.' }); return; }
    const roleIds = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!roleIds.length) { res.status(400).json({ success: false, message: 'roleIds is required.' }); return; }

    const kpiMatrics = await KpiMatricsModel.find({ serviceRequestRoleId: { $in: roleIds } }).sort({ createdAt: 1 }).lean();
    const kpiIds     = kpiMatrics.map((k) => k.kpiMatricsId);

    const groupTrackings = await KpiGroupTrackingModel.find({ kpiMatricsId: { $in: kpiIds } }).sort({ createdAt: 1 }).lean();
    const gtIds          = groupTrackings.map((g) => g.kpiMatricsGroupTrackingId);

    const sections = await KpiFieldAndSectionsModel.find({ kpiMatricsGroupTrackingId: { $in: gtIds } }).lean();
    const secIds   = sections.map((s) => s.kpiMatricsFieldAndSectionsId);

    const conditions = await KpiConditionModel.find({ kpiMatricsFieldAndSectionsId: { $in: secIds } }).sort({ sortOrder: 1 }).lean();

    const sectionByGt    = new Map(sections.map((s) => [s.kpiMatricsGroupTrackingId, s]));
    const condsBySection = new Map<string, typeof conditions>();
    for (const c of conditions) {
      if (!condsBySection.has(c.kpiMatricsFieldAndSectionsId)) condsBySection.set(c.kpiMatricsFieldAndSectionsId, []);
      condsBySection.get(c.kpiMatricsFieldAndSectionsId)!.push(c);
    }
    const gtsByKpi = new Map<string, typeof groupTrackings>();
    for (const g of groupTrackings) {
      if (!gtsByKpi.has(g.kpiMatricsId)) gtsByKpi.set(g.kpiMatricsId, []);
      gtsByKpi.get(g.kpiMatricsId)!.push(g);
    }

    const data = kpiMatrics.map((km) => {
      const gts = (gtsByKpi.get(km.kpiMatricsId) ?? []).map((gt) => {
        const sec   = sectionByGt.get(gt.kpiMatricsGroupTrackingId);
        const conds = sec ? (condsBySection.get(sec.kpiMatricsFieldAndSectionsId) ?? []) : [];
        return {
          kpiMatricsGroupTrackingId:  gt.kpiMatricsGroupTrackingId,
          kpiGroupTracking:           gt.kpiGroupTracking,
          kpiGroupTrackingSuggestion: gt.kpiGroupTrackingSuggestion,
          isVendorKPI:                gt.isVendorKPI ?? false,
          isActive:                   gt.isActive,
          updatedBy:                  gt.updatedBy,
          updatedAt:                  gt.updatedAt,
          section: sec ? {
            kpiMatricsFieldAndSectionsId: sec.kpiMatricsFieldAndSectionsId,
            thresholdsGood:     sec.thresholdsGood,
            thresholdsModerate: sec.thresholdsModerate,
            thresholdsPoor:     sec.thresholdsPoor,
            betterWhen:         sec.betterWhen,
          } : null,
          conditions: conds.map((c) => ({
            kpiMatricsFieldAndConditionId: c.kpiMatricsFieldAndConditionId,
            fieldName:     c.fieldName,
            operator:      c.operator,
            value:         c.value,
            ShowValue:     c.ShowValue ?? '',
            conditionType: c.conditionType,
            sortOrder:     c.sortOrder,
          })),
        };
      });
      return {
        kpiMatricsId:        km.kpiMatricsId,
        kpiGroupTracking:    km.kpiGroupTracking,
        serviceRequestRoleId: km.serviceRequestRoleId,
        isVendorKPI:         gts.length > 0 ? (gts[0].isVendorKPI ?? false) : false,
        isActive:            km.isActive,
        metrics:             gts,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.getKpiMetricsForClaim');
    res.status(500).json({ success: false, message: 'Failed to load KPI metrics for claim.' });
  }
}

// ─── POST / (create metric) ───────────────────────────────────────────────────

export async function createKpiMetric(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      serviceRequestRoleId: string;
      kpiGroupTracking: string;
      kpiGroupTrackingName: string;
      kpiGroupTrackingSuggestion: string;
      thresholdsGood: string;
      thresholdsModerate: string;
      thresholdsPoor: string;
      betterWhen: string;
      isVendorKPI?: boolean;
      conditions: Array<{ fieldName: string; operator: string; value: string; ShowValue?: string; conditionType: string; sortOrder: number }>;
      createdBy?: string;
    };

    const { serviceRequestRoleId, kpiGroupTracking, kpiGroupTrackingName, kpiGroupTrackingSuggestion,
      thresholdsGood, thresholdsModerate, thresholdsPoor, betterWhen, isVendorKPI = false, conditions, createdBy = 'Admin' } = body;

    if (!serviceRequestRoleId || !kpiGroupTracking || !kpiGroupTrackingName || !betterWhen) {
      res.status(400).json({ success: false, message: 'Required fields missing.' }); return;
    }
    if (!conditions || conditions.length === 0) {
      res.status(400).json({ success: false, message: 'At least one condition is required.' }); return;
    }

    // Reuse existing KPI_Matrics group or create new (isVendorKPI now lives on the tracking record)
    const existingMatrics = await KpiMatricsModel.findOne({ serviceRequestRoleId, kpiGroupTracking }).lean();
    let kpiMatricsId: string;
    if (existingMatrics) {
      kpiMatricsId = existingMatrics.kpiMatricsId;
    } else {
      kpiMatricsId = uuidv4();
      await KpiMatricsModel.create({
        kpiMatricsId, serviceRequestRoleId, kpiGroupTracking,
        isActive: true, createdBy, createdAt: now(), updatedBy: createdBy, updatedAt: now(),
      });
    }

    const kpiMatricsGroupTrackingId = uuidv4();
    await KpiGroupTrackingModel.create({
      kpiMatricsGroupTrackingId, kpiMatricsId,
      kpiGroupTrackingSuggestion: kpiGroupTrackingName || kpiGroupTrackingSuggestion,
      isVendorKPI,
      isActive: true, createdBy, createdAt: now(), updatedBy: createdBy, updatedAt: now(),
    });

    const kpiMatricsFieldAndSectionsId = uuidv4();
    await KpiFieldAndSectionsModel.create({
      kpiMatricsFieldAndSectionsId, kpiMatricsGroupTrackingId,
      thresholdsGood, thresholdsModerate, thresholdsPoor, betterWhen,
      createdBy, createdAt: now(), updatedBy: createdBy, updatedAt: now(),
    });

    await KpiConditionModel.insertMany(conditions.map((c, i) => ({
      kpiMatricsFieldAndConditionId: uuidv4(),
      kpiMatricsFieldAndSectionsId,
      fieldName:     c.fieldName,
      operator:      c.operator,
      value:         c.value,
      ShowValue:     c.ShowValue ?? '',
      conditionType: c.conditionType,
      sortOrder:     c.sortOrder ?? i,
      createdBy, createdAt: now(), updatedBy: createdBy, updatedAt: now(),
    })));

    res.status(201).json({ success: true, message: 'KPI metric created.' });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.createKpiMetric');
    res.status(500).json({ success: false, message: 'Failed to create KPI metric.' });
  }
}

// ─── PUT /:kpiMatricsGroupTrackingId (update metric) ─────────────────────────

export async function updateKpiMetric(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as {
      kpiGroupTracking?: string;
      kpiGroupTrackingSuggestion?: string;
      thresholdsGood?: string;
      thresholdsModerate?: string;
      thresholdsPoor?: string;
      betterWhen?: string;
      isVendorKPI?: boolean;
      conditions?: Array<{ kpiMatricsFieldAndConditionId?: string; fieldName: string; operator: string; value: string; ShowValue?: string; conditionType: string; sortOrder: number }>;
      updatedBy?: string;
    };
    const updatedBy = body.updatedBy ?? 'Admin';

    const gtUpdate: Record<string, unknown> = { kpiGroupTrackingSuggestion: body.kpiGroupTrackingSuggestion, updatedBy, updatedAt: now() };
    if (typeof body.isVendorKPI === 'boolean') gtUpdate['isVendorKPI'] = body.isVendorKPI;

    await KpiGroupTrackingModel.updateOne(
      { kpiMatricsGroupTrackingId: id },
      { $set: gtUpdate },
    );

    const section = await KpiFieldAndSectionsModel.findOne({ kpiMatricsGroupTrackingId: id }).lean();
    if (section) {
      await KpiFieldAndSectionsModel.updateOne(
        { kpiMatricsFieldAndSectionsId: section.kpiMatricsFieldAndSectionsId },
        { $set: { thresholdsGood: body.thresholdsGood, thresholdsModerate: body.thresholdsModerate, thresholdsPoor: body.thresholdsPoor, betterWhen: body.betterWhen, updatedBy, updatedAt: now() } },
      );

      if (body.conditions) {
        await KpiConditionModel.deleteMany({ kpiMatricsFieldAndSectionsId: section.kpiMatricsFieldAndSectionsId });
        await KpiConditionModel.insertMany(body.conditions.map((c, i) => ({
          kpiMatricsFieldAndConditionId: c.kpiMatricsFieldAndConditionId ?? uuidv4(),
          kpiMatricsFieldAndSectionsId: section.kpiMatricsFieldAndSectionsId,
          fieldName: c.fieldName, operator: c.operator, value: c.value, ShowValue: c.ShowValue ?? '', conditionType: c.conditionType,
          sortOrder: c.sortOrder ?? i,
          createdBy: updatedBy, createdAt: now(), updatedBy, updatedAt: now(),
        })));
      }
    }

    res.status(200).json({ success: true, message: 'KPI metric updated.' });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.updateKpiMetric');
    res.status(500).json({ success: false, message: 'Failed to update KPI metric.' });
  }
}

// ─── PUT /:id/toggle ──────────────────────────────────────────────────────────

export async function toggleKpiMetric(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const gt = await KpiGroupTrackingModel.findOne({ kpiMatricsGroupTrackingId: id }).lean();
    if (!gt) { res.status(404).json({ success: false, message: 'Metric not found.' }); return; }
    await KpiGroupTrackingModel.updateOne(
      { kpiMatricsGroupTrackingId: id },
      { $set: { isActive: !gt.isActive, updatedBy: 'Admin', updatedAt: now() } },
    );
    res.status(200).json({ success: true, isActive: !gt.isActive });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.toggleKpiMetric');
    res.status(500).json({ success: false, message: 'Failed to toggle KPI metric.' });
  }
}

// ─── PUT /vendor-toggle-role ──────────────────────────────────────────────────

export async function setVendorKpiForRole(req: Request, res: Response): Promise<void> {
  try {
    const { roleId, isVendorKPI } = req.body as { roleId: string; isVendorKPI: boolean };
    if (!roleId || typeof isVendorKPI !== 'boolean') {
      res.status(400).json({ success: false, message: 'roleId and isVendorKPI are required.' }); return;
    }
    const kpiMatrics = await KpiMatricsModel.find({ serviceRequestRoleId: roleId }).lean();
    const kpiIds = kpiMatrics.map((k) => k.kpiMatricsId);
    if (kpiIds.length > 0) {
      await KpiGroupTrackingModel.updateMany(
        { kpiMatricsId: { $in: kpiIds } },
        { $set: { isVendorKPI, updatedBy: 'Admin', updatedAt: now() } },
      );
    }
    res.status(200).json({ success: true, isVendorKPI });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.setVendorKpiForRole');
    res.status(500).json({ success: false, message: 'Failed to update Vendor KPI flag.' });
  }
}

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

export async function deleteKpiMetric(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const section = await KpiFieldAndSectionsModel.findOne({ kpiMatricsGroupTrackingId: id }).lean();
    if (section) {
      await KpiConditionModel.deleteMany({ kpiMatricsFieldAndSectionsId: section.kpiMatricsFieldAndSectionsId });
      await KpiFieldAndSectionsModel.deleteOne({ kpiMatricsFieldAndSectionsId: section.kpiMatricsFieldAndSectionsId });
    }
    await KpiGroupTrackingModel.deleteOne({ kpiMatricsGroupTrackingId: id });
    res.status(200).json({ success: true, message: 'KPI metric deleted.' });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.deleteKpiMetric');
    res.status(500).json({ success: false, message: 'Failed to delete KPI metric.' });
  }
}

// ─── AI Recommendations ───────────────────────────────────────────────────────

const AI_REC_CONFIG = [
  {
    ruleId:        'ai-rule-estimate-review',
    serviceName:   'Estimate & Invoice Review',
    metricLabel:   'Estimate Variance % · Cost Efficiency',
    currentRule:   'Good ≤ 5%',
    suggestedRule: 'Good ≤ 6%',
    description:   'Reviewers whose estimates land within 5–6% of the final settled repair cost showed the same supplement rate as those under 5% across 318 sample homeowners and dwelling claims. The current threshold marks these reviewers as Moderate and routes them away from higher-value property claims.',
    suggestionName: 'Estimate Variance %',
  },
  {
    ruleId:        'ai-rule-nfip-adjuster',
    serviceName:   'NFIP Authorized Adjuster',
    metricLabel:   'First Pass Acceptance Rate · Report Quality',
    currentRule:   'Good ≥ 90%',
    suggestedRule: 'Good ≥ 87%',
    description:   'NFIP adjusters with 87–90% first-pass acceptance of preliminary and final reports had no more reinspections than those above 90%, based on 146 sample flood claims. The current threshold labels these adjusters Moderate during catastrophe surges, when approved-adjuster capacity matters most.',
    suggestionName: 'First Pass Acceptance Rate',
  },
  {
    ruleId:        'ai-rule-mitigation',
    serviceName:   '24/7 Loss Mitigation Contractors',
    metricLabel:   'SLA Compliance % · Turnaround Time',
    currentRule:   'Good ≥ 90%',
    suggestedRule: 'Good ≥ 85%',
    description:   'Mitigation contractors on site within the SLA for 85–90% of dispatches kept secondary water damage and mold claims at the same level as those above 90%, across 231 sample water-loss claims. The current threshold excludes about 1 in 4 capable vendors from the after-hours panel.',
    suggestionName: 'SLA Compliance %',
  },
] as const;

import { formatThreshold, applySuggestedThreshold } from '../utils/kpiThresholdUtils';

export async function getAiRecommendations(_req: Request, res: Response): Promise<void> {
  try {
    // Return static rule suggestions, filtering out any already accepted in DB
    const acceptedSections = await KpiFieldAndSectionsModel.find(
      { aiSuggestionAccepted: true },
      { kpiMatricsGroupTrackingId: 1 },
    ).lean();
    const acceptedGtIds = new Set(acceptedSections.map((s) => s.kpiMatricsGroupTrackingId));

    // Resolve each card to the KPI of its own service (suggestion names repeat across services).
    const db = mongoose.connection.db!;
    const roleDocs = await db.collection('service_request_roles')
      .find({ roleName: { $in: AI_REC_CONFIG.map((c) => c.serviceName) } }).toArray();
    const roleIdByName = new Map(roleDocs.map((r) => [String(r['roleName']), String(r['roleId'] ?? '')]));
    const kpis = await KpiMatricsModel.find({ serviceRequestRoleId: { $in: [...roleIdByName.values()] } }).lean();
    const kpiIds = kpis.map((k) => k.kpiMatricsId);
    const groupTrackings = kpiIds.length
      ? await KpiGroupTrackingModel.find({ kpiMatricsId: { $in: kpiIds } }).lean()
      : [];
    const kpiRole = new Map(kpis.map((k) => [k.kpiMatricsId, k.serviceRequestRoleId]));
    const gtIds    = groupTrackings.map((g) => g.kpiMatricsGroupTrackingId);
    const sections = gtIds.length
      ? await KpiFieldAndSectionsModel.find({ kpiMatricsGroupTrackingId: { $in: gtIds } }).lean()
      : [];
    const sectionByGt = new Map(sections.map((s) => [s.kpiMatricsGroupTrackingId, s]));
    const gtByKey     = new Map(groupTrackings.map((g) => [`${kpiRole.get(g.kpiMatricsId)}|${g.kpiGroupTrackingSuggestion}`, g]));

    const data = AI_REC_CONFIG
      .map((cfg) => {
        const gt      = gtByKey.get(`${roleIdByName.get(cfg.serviceName)}|${cfg.suggestionName}`);
        const section = gt ? sectionByGt.get(gt.kpiMatricsGroupTrackingId) : undefined;
        if (gt && acceptedGtIds.has(gt.kpiMatricsGroupTrackingId)) return null;
        return {
          ruleId:                      cfg.ruleId,
          kpiMatricsFieldAndSectionsId: section?.kpiMatricsFieldAndSectionsId ?? '',
          kpiMatricsGroupTrackingId:    gt?.kpiMatricsGroupTrackingId ?? '',
          serviceName:   cfg.serviceName,
          metricLabel:   cfg.metricLabel,
          currentRule:   cfg.currentRule,
          suggestedRule: cfg.suggestedRule,
          description:   cfg.description,
        };
      })
      .filter(Boolean);

    res.status(200).json({ success: true, data });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.getAiRecommendations');
    res.status(500).json({ success: false, message: 'Failed to load AI recommendations.' });
  }
}

export async function acceptAiRecommendation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };           // ruleId
    const { kpiMatricsGroupTrackingId } = req.body as { kpiMatricsGroupTrackingId?: string };

    if (!id) {
      res.status(400).json({ success: false, message: 'id is required.' });
      return;
    }

    // Mark the linked KPI section as accepted so it won't appear again
    if (kpiMatricsGroupTrackingId) {
      await KpiFieldAndSectionsModel.updateOne(
        { kpiMatricsGroupTrackingId },
        { $set: { aiSuggestionAccepted: true, updatedBy: 'AI', updatedAt: now() } },
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    await logError(err as Error, 'kpiMetricsController.acceptAiRecommendation');
    res.status(500).json({ success: false, message: 'Failed to accept AI recommendation.' });
  }
}
