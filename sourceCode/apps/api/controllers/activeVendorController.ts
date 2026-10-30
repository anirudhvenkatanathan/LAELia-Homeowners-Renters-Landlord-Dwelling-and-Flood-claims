import { Request, Response } from 'express';
import mongoose, { Document, Schema } from 'mongoose';
import { logError } from '../services/errorLogService';

// ─── Mongoose model ───────────────────────────────────────────────────────────

export type AssignmentStatus = 'New' | 'Accepted' | 'In Progress' | 'Completed' | 'Declined';

interface IVendorAssignment extends Document {
  assignmentId: string;
  vendorId:     string;
  claimNumber:  string;
  companyName:  string;
  service:      string;
  serviceId:    string;
  assignedDate: Date;
  dueDate:      Date | null;
  status:       AssignmentStatus;
  startedAt:    Date | null;
  completedAt:  Date | null;
  notes:        string;
}

const VendorAssignmentSchema = new Schema<IVendorAssignment>({
  assignmentId: { type: String, required: true, unique: true },
  vendorId:     { type: String, required: true },
  claimNumber:  { type: String, required: true },
  companyName:  { type: String, default: '' },
  service:      { type: String, default: '' },
  serviceId:    { type: String, default: '' },
  assignedDate: { type: Date, default: Date.now },
  dueDate:      { type: Date, default: null },
  status:       { type: String, enum: ['New', 'Accepted', 'In Progress', 'Completed', 'Declined'], default: 'New' },
  startedAt:    { type: Date, default: null },
  completedAt:  { type: Date, default: null },
  notes:        { type: String, default: '' },
}, { timestamps: true });

VendorAssignmentSchema.index({ vendorId: 1, status: 1 });
VendorAssignmentSchema.index({ vendorId: 1, assignedDate: -1 });

export const VendorAssignmentModel =
  (mongoose.models['vendor_assignments'] as mongoose.Model<IVendorAssignment>) ||
  mongoose.model<IVendorAssignment>('vendor_assignments', VendorAssignmentSchema, 'vendor_assignments');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── GET /api/vendors/active/:vendorId/assignments ─────────────────────────────

export async function getAssignments(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId } = req.params as { vendorId: string };
    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const assignments = await VendorAssignmentModel
      .find({ vendorId })
      .sort({ assignedDate: -1 })
      .lean()
      .exec();

    const data = assignments.map((a) => ({
      assignmentId: a.assignmentId,
      claimNumber:  a.claimNumber,
      companyName:  a.companyName,
      service:      a.service,
      serviceId:    a.serviceId,
      assignedDate: fmt(a.assignedDate),
      dueDate:      fmt(a.dueDate),
      status:       a.status,
      startedAt:    fmt(a.startedAt),
      completedAt:  fmt(a.completedAt),
      notes:        a.notes,
    }));

    res.status(200).json({ success: true, data });
  } catch (err) {
    await logError(err as Error, 'activeVendorController.getAssignments');
    res.status(500).json({ success: false, message: 'Failed to fetch assignments.' });
  }
}

// ─── PUT /api/vendors/active/:vendorId/assignments/:assignmentId ───────────────

export async function updateAssignmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId, assignmentId } = req.params as { vendorId: string; assignmentId: string };
    const { action } = req.body as { action?: 'accept' | 'decline' | 'start' | 'end' };

    if (!action) {
      res.status(400).json({ success: false, message: 'action is required.' });
      return;
    }

    const assignment = await VendorAssignmentModel.findOne({ vendorId, assignmentId });
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    switch (action) {
      case 'accept':
        if (assignment.status !== 'New') {
          res.status(400).json({ success: false, message: 'Only New assignments can be accepted.' });
          return;
        }
        assignment.status = 'Accepted';
        break;
      case 'decline':
        if (assignment.status !== 'New') {
          res.status(400).json({ success: false, message: 'Only New assignments can be declined.' });
          return;
        }
        assignment.status = 'Declined';
        break;
      case 'start':
        if (assignment.status !== 'Accepted') {
          res.status(400).json({ success: false, message: 'Only Accepted assignments can be started.' });
          return;
        }
        assignment.status    = 'In Progress';
        assignment.startedAt = new Date();
        break;
      case 'end':
        if (assignment.status !== 'In Progress') {
          res.status(400).json({ success: false, message: 'Only In Progress assignments can be ended.' });
          return;
        }
        assignment.status      = 'Completed';
        assignment.completedAt = new Date();
        break;
      default:
        res.status(400).json({ success: false, message: 'Invalid action. Use accept | decline | start | end.' });
        return;
    }

    await assignment.save();
    res.status(200).json({ success: true, message: `Assignment ${action}ed.`, status: assignment.status });
  } catch (err) {
    await logError(err as Error, 'activeVendorController.updateAssignmentStatus');
    res.status(500).json({ success: false, message: 'Failed to update assignment status.' });
  }
}

// ─── GET /api/vendors/active/:vendorId/performance ────────────────────────────

export async function getPerformance(req: Request, res: Response): Promise<void> {
  try {
    const { vendorId } = req.params as { vendorId: string };
    if (!vendorId) {
      res.status(400).json({ success: false, message: 'vendorId is required.' });
      return;
    }

    const since90 = new Date();
    since90.setDate(since90.getDate() - 90);

    const [vendorDoc, allAssignments] = await Promise.all([
      mongoose.connection.db!.collection('vendor_details').findOne({ vendorId }),
      VendorAssignmentModel.find({ vendorId, assignedDate: { $gte: since90 } }).lean().exec(),
    ]);

    const completed  = allAssignments.filter((a) => a.status === 'Completed');
    const inProgress = allAssignments.filter((a) => a.status === 'In Progress');
    const active     = allAssignments.filter((a) => ['Accepted', 'In Progress'].includes(a.status));

    const completedOnTime = completed.filter(
      (a) => a.completedAt && a.dueDate && new Date(a.completedAt) <= new Date(a.dueDate),
    );
    const slaCompliance = completed.length > 0
      ? Math.round((completedOnTime.length / completed.length) * 100)
      : 100;

    const cycleTimes = completed
      .filter((a) => a.completedAt)
      .map((a) => daysBetween(new Date(a.assignedDate), new Date(a.completedAt!)));
    const avgCycleTime = cycleTimes.length > 0
      ? Math.round((cycleTimes.reduce((s, t) => s + t, 0) / cycleTimes.length) * 10) / 10
      : 0;

    // Performance by client
    const clientMap = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      if (!clientMap.has(a.companyName)) clientMap.set(a.companyName, []);
      clientMap.get(a.companyName)!.push(a);
    }
    const byClient = [...clientMap.entries()].map(([companyName, items]) => {
      const done   = items.filter((a) => a.status === 'Completed');
      const onTime = done.filter((a) => a.completedAt && a.dueDate && new Date(a.completedAt) <= new Date(a.dueDate));
      const ct     = done.filter((a) => a.completedAt).map((a) => daysBetween(new Date(a.assignedDate), new Date(a.completedAt!)));
      return {
        companyName,
        total:     items.length,
        completed: done.length,
        slaHit:    done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 100,
        avgCycle:  ct.length > 0 ? Math.round((ct.reduce((s, t) => s + t, 0) / ct.length) * 10) / 10 : 0,
        score:     null as number | null,
      };
    });

    // Performance by service
    const serviceMap = new Map<string, { items: typeof allAssignments; serviceId: string }>();
    for (const a of allAssignments) {
      if (!serviceMap.has(a.service)) serviceMap.set(a.service, { items: [], serviceId: a.serviceId });
      serviceMap.get(a.service)!.items.push(a);
    }
    const byService = [...serviceMap.entries()].map(([service, { items, serviceId }]) => {
      const done   = items.filter((a) => a.status === 'Completed');
      const onTime = done.filter((a) => a.completedAt && a.dueDate && new Date(a.completedAt) <= new Date(a.dueDate));
      const ct     = done.filter((a) => a.completedAt).map((a) => daysBetween(new Date(a.assignedDate), new Date(a.completedAt!)));
      return {
        service,
        serviceId,
        volume:   items.length,
        slaHit:   done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 100,
        avgCycle: ct.length > 0 ? Math.round((ct.reduce((s, t) => s + t, 0) / ct.length) * 10) / 10 : 0,
        score:    null as number | null,
      };
    });

    const raw = vendorDoc as Record<string, unknown> | null;

    res.status(200).json({
      success: true,
      data: {
        overallScore:          typeof raw?.['rating'] === 'number' ? raw['rating'] : 0,
        panelMedian:           4.1,
        totalAssignments:      allAssignments.length,
        completedAssignments:  completed.length,
        inProgressAssignments: inProgress.length,
        activeAssignments:     active.length,
        slaCompliance,
        avgCycleTime,
        byClient,
        byService,
        requalDue: raw?.['requalDue'] ? String(raw['requalDue']) : null,
      },
    });
  } catch (err) {
    await logError(err as Error, 'activeVendorController.getPerformance');
    res.status(500).json({ success: false, message: 'Failed to fetch performance data.' });
  }
}
