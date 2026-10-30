import { Request, Response } from 'express';
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logError } from '../services/errorLogService';
import { ServiceRequestRoleModel } from '../graphQL/serviceRequestRoleEntity';
import { VendorModel } from '../graphQL/vendorEntity';

// ─── Mongoose: vendor_service_requests ────────────────────────────────────────

export type VendorServiceRequestStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export const VENDOR_SERVICE_REQUEST_STATUSES: VendorServiceRequestStatus[] =
  ['draft', 'submitted', 'in_review', 'approved', 'rejected'];

export interface IVendorServiceRequest extends Document {
  requestId:      string;
  companyName:    string;
  address:        string;
  email:          string;
  phone:          string;
  website:        string;
  contactPerson:  string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  services:       string[];   // roleId references into service_request_role
  coverage:       string[];   // state codes
  status:         VendorServiceRequestStatus;
  vendorDetailId: string | null; // vendorId reference into vendor_details
  submittedBy:    string;
  submittedAt:    Date | null;
  reviewedBy:     string;
  reviewedAt:     Date | null;
  notes:          string;
  createdAt:      Date;
  updatedAt:      Date;
}

const VendorServiceRequestSchema = new Schema<IVendorServiceRequest>({
  requestId:      { type: String, required: true, unique: true },
  companyName:    { type: String, required: true, trim: true },
  address:        { type: String, default: '', trim: true },
  email:          { type: String, default: '', trim: true, lowercase: true },
  phone:          { type: String, default: '', trim: true },
  website:        { type: String, default: '', trim: true },
  contactPerson:  { type: String, default: '', trim: true },
  contactPersonName:  { type: String, default: '', trim: true },
  contactPersonPhone: { type: String, default: '', trim: true },
  contactPersonEmail: { type: String, default: '', trim: true, lowercase: true },
  services:       [{ type: String }],
  coverage:       [{ type: String }],
  status:         { type: String, enum: VENDOR_SERVICE_REQUEST_STATUSES, default: 'draft' },
  vendorDetailId: { type: String, default: null },
  submittedBy:    { type: String, default: '' },
  submittedAt:    { type: Date,   default: null },
  reviewedBy:     { type: String, default: '' },
  reviewedAt:     { type: Date,   default: null },
  notes:          { type: String, default: '' },
}, { timestamps: true });

VendorServiceRequestSchema.index({ status: 1 });
VendorServiceRequestSchema.index({ companyName: 'text' });
VendorServiceRequestSchema.index({ createdAt: -1 });

export const VendorServiceRequestModel =
  (mongoose.models['vendor_service_requests'] as mongoose.Model<IVendorServiceRequest>) ||
  mongoose.model<IVendorServiceRequest>('vendor_service_requests', VendorServiceRequestSchema, 'vendor_service_requests');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

async function resolveServices(roleIds: string[]): Promise<{ roleId: string; name: string; description: string }[]> {
  if (!roleIds.length) return [];
  const roles = await ServiceRequestRoleModel.find({ roleId: { $in: roleIds } }).lean();
  const map = new Map(roles.map((r) => [r.roleId, r]));
  return roleIds.map((id) => ({
    roleId:      id,
    name:        map.get(id)?.roleName ?? id,
    description: map.get(id)?.description ?? '',
  }));
}

type VendorServiceRequestLean = Pick<IVendorServiceRequest,
  'requestId' | 'companyName' | 'address' | 'email' | 'phone' | 'website' | 'contactPerson' | 'contactPersonName' | 'contactPersonPhone' | 'contactPersonEmail' | 'coverage' | 'status' | 'submittedBy' | 'createdAt' | 'updatedAt'>;

function toListItem(doc: VendorServiceRequestLean, services: { roleId: string; name: string }[]) {
  return {
    requestId:     doc.requestId,
    companyName:   doc.companyName,
    address:       doc.address,
    email:         doc.email,
    phone:         doc.phone,
    website:       doc.website,
    contactPerson: doc.contactPerson,
    contactPersonName:  doc.contactPersonName,
    contactPersonPhone: doc.contactPersonPhone,
    contactPersonEmail: doc.contactPersonEmail,
    services,
    coverage:      doc.coverage,
    status:        doc.status,
    submittedBy:   doc.submittedBy,
    createdAt:     fmt(doc.createdAt),
    updatedAt:     fmt(doc.updatedAt),
  };
}

/** Resolve a vendor_status document by display name and return all three FK values. */
async function resolveVendorStatusFKs(statusName: string): Promise<{ vendorStatus: string; Status: string; vendorStatusId: string }> {
  const doc = await mongoose.connection.db!
    .collection('vendor_status')
    .findOne({ $or: [{ VendorStatusName: statusName }, { VendorStatusCode: statusName.replace(/\s/g, '') }] });
  const raw = doc as Record<string, unknown> | null;
  return {
    vendorStatus:   statusName,
    Status:         raw ? String(raw['_id']      ?? '') : '',
    vendorStatusId: raw ? String(raw['statusId'] ?? '') : '',
  };
}

/**
 * Link the request to vendor_details: update an existing vendor (matched by
 * companyName) or create a new one, merging services/coverage. New vendor
 * records are created with Pending Approval status with all FK fields set.
 */
export async function linkToVendorDetails(request: IVendorServiceRequest, initialVendorStatus: string): Promise<string> {
  const services = await resolveServices(request.services);
  const primaryService = services[0];
  const statusFKs = await resolveVendorStatusFKs(initialVendorStatus);

  let vendor = await VendorModel.findOne({
    companyName: { $regex: `^${request.companyName.trim()}$`, $options: 'i' },
  });

  if (!vendor) {
    vendor = new VendorModel({
      vendorId:               uuidv4(),
      companyName:            request.companyName,
      emailId:                request.email,
      address:                request.address,
      phoneNumber:            request.phone,
      website:                request.website,
      contactPersonName:      request.contactPersonName,
      contactPersonPhone:     request.contactPersonPhone,
      contactPersonEmail:     request.contactPersonEmail,
      Coverage:               request.coverage.join(', '),
      serviceRequestRoleId:   primaryService?.roleId ?? '',
      serviceRequestRoleName: primaryService?.name ?? '',
      vendorStatus:           statusFKs.vendorStatus,
      Status:                 statusFKs.Status,
      vendorStatusId:         statusFKs.vendorStatusId,
      createdBy:              'System',
      uploadedBy:             'System',
    });
  } else {
    const existingCoverage = vendor.Coverage ? vendor.Coverage.split(',').map((c) => c.trim()).filter(Boolean) : [];
    vendor.Coverage = [...new Set([...existingCoverage, ...request.coverage])].join(', ');

    if (!vendor.serviceRequestRoleId && primaryService) {
      vendor.serviceRequestRoleId   = primaryService.roleId;
      vendor.serviceRequestRoleName = primaryService.name;
    }

    // Move the existing vendor to the requested status (e.g. 'Pending Approval'
    // for re-signups, 'In Progress' for CM-submitted requests), unless it is
    // already Active — Active vendors stay Active until explicitly changed.
    if (vendor.vendorStatus !== 'Active') {
      vendor.vendorStatus = statusFKs.vendorStatus;
      if (statusFKs.Status)         vendor.Status         = statusFKs.Status;
      if (statusFKs.vendorStatusId) vendor.vendorStatusId = statusFKs.vendorStatusId;
    }
  }

  await vendor.save();
  return vendor.vendorId;
}

/**
 * Moves the linked vendor_details record from one onboarding status to the
 * next as its vendor service request progresses. Updates all three status
 * FK fields so the status is consistent across all lookup paths.
 */
// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function listVendorServiceRequests(req: Request, res: Response): Promise<void> {
  try {
    const { status, search } = req.query as Record<string, string | undefined>;
    const page  = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50);

    const filter: Record<string, unknown> = {};
    if (status) filter['status'] = status;
    if (search) filter['companyName'] = { $regex: search, $options: 'i' };

    const [docs, total] = await Promise.all([
      VendorServiceRequestModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VendorServiceRequestModel.countDocuments(filter),
    ]);

    const allRoleIds = [...new Set(docs.flatMap((d) => d.services))];
    const resolved   = await resolveServices(allRoleIds);
    const roleMap    = new Map(resolved.map((r) => [r.roleId, { roleId: r.roleId, name: r.name }]));

    const data = docs.map((d) =>
      toListItem(d, d.services.map((id) => roleMap.get(id) ?? { roleId: id, name: id })),
    );

    res.status(200).json({ data, total, page });
  } catch (err) {
    await logError(err, 'vendorServiceRequestController.listVendorServiceRequests');
    res.status(500).json({ error: 'Failed to load vendor service requests.', code: 'SERVER_ERROR' });
  }
}

export async function getVendorServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const doc = await VendorServiceRequestModel.findOne({ requestId: req.params['id'] }).lean();
    if (!doc) {
      res.status(404).json({ error: 'Vendor service request not found.', code: 'NOT_FOUND' });
      return;
    }

    const services = await resolveServices(doc.services);

    let vendorDetail: { vendorId: string; companyName: string } | null = null;
    if (doc.vendorDetailId) {
      const vendor = await VendorModel.findOne({ vendorId: doc.vendorDetailId }).lean();
      if (vendor) vendorDetail = { vendorId: vendor.vendorId, companyName: vendor.companyName };
    }

    res.status(200).json({
      requestId:      doc.requestId,
      companyName:    doc.companyName,
      address:        doc.address,
      email:          doc.email,
      phone:          doc.phone,
      website:        doc.website,
      contactPerson:  doc.contactPerson,
      contactPersonName:  doc.contactPersonName,
      contactPersonPhone: doc.contactPersonPhone,
      contactPersonEmail: doc.contactPersonEmail,
      services,
      coverage:       doc.coverage,
      status:         doc.status,
      vendorDetail,
      submittedBy:    doc.submittedBy,
      submittedAt:    fmt(doc.submittedAt),
      reviewedBy:     doc.reviewedBy,
      reviewedAt:     fmt(doc.reviewedAt),
      notes:          doc.notes,
      createdAt:      fmt(doc.createdAt),
      updatedAt:      fmt(doc.updatedAt),
    });
  } catch (err) {
    await logError(err, 'vendorServiceRequestController.getVendorServiceRequest');
    res.status(500).json({ error: 'Failed to load vendor service request.', code: 'SERVER_ERROR' });
  }
}

export async function createVendorServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      companyName?:   string;
      address?:       string;
      email?:         string;
      phone?:         string;
      website?:       string;
      contactPerson?: string;
      contactPersonName?:  string;
      contactPersonPhone?: string;
      contactPersonEmail?: string;
      services?:      string[];
      coverage?:      string[];
      status?:        string;
      submittedBy?:   string;
    };

    if (!body.companyName?.trim()) {
      res.status(400).json({ error: 'companyName is required.', code: 'VALIDATION_ERROR' });
      return;
    }

    const status: VendorServiceRequestStatus = body.status === 'submitted' ? 'submitted' : 'draft';
    const now = new Date();

    const doc = new VendorServiceRequestModel({
      requestId:     uuidv4(),
      companyName:   body.companyName.trim(),
      address:       body.address ?? '',
      email:         body.email ?? '',
      phone:         body.phone ?? '',
      website:       body.website ?? '',
      contactPerson: body.contactPerson ?? '',
      contactPersonName:  body.contactPersonName ?? '',
      contactPersonPhone: body.contactPersonPhone ?? '',
      contactPersonEmail: body.contactPersonEmail ?? '',
      services:      body.services,
      coverage:      Array.isArray(body.coverage) ? body.coverage : [],
      status,
      submittedBy: status === 'submitted' ? (body.submittedBy ?? 'Admin') : '',
      submittedAt: status === 'submitted' ? now : null,
    });
    await doc.save();

    // Client Manager-submitted requests go directly to In Progress (no Pending Approval step).
    // Provider self-signup goes through Pending Approval via the vendorSignUp GraphQL mutation.
    if (doc.status === 'submitted' && !doc.vendorDetailId) {
      doc.vendorDetailId = await linkToVendorDetails(doc, 'In Progress');
      await doc.save();
    }

    const services = await resolveServices(doc.services);
    res.status(201).json({
      requestId:     doc.requestId,
      companyName:   doc.companyName,
      address:       doc.address,
      email:         doc.email,
      phone:         doc.phone,
      website:       doc.website,
      contactPerson: doc.contactPerson,
      contactPersonName:  doc.contactPersonName,
      contactPersonPhone: doc.contactPersonPhone,
      contactPersonEmail: doc.contactPersonEmail,
      services,
      coverage:    doc.coverage,
      status:      doc.status,
      vendorDetailId: doc.vendorDetailId,
      submittedBy: doc.submittedBy,
      submittedAt: fmt(doc.submittedAt),
      createdAt:   fmt(doc.createdAt),
    });
  } catch (err) {
    await logError(err, 'vendorServiceRequestController.createVendorServiceRequest');
    res.status(500).json({ error: 'Failed to create vendor service request.', code: 'SERVER_ERROR' });
  }
}

export async function updateVendorServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const doc = await VendorServiceRequestModel.findOne({ requestId: req.params['id'] });
    if (!doc) {
      res.status(404).json({ error: 'Vendor service request not found.', code: 'NOT_FOUND' });
      return;
    }

    const body = req.body as {
      companyName?:   string;
      address?:       string;
      email?:         string;
      phone?:         string;
      website?:       string;
      contactPerson?: string;
      contactPersonName?:  string;
      contactPersonPhone?: string;
      contactPersonEmail?: string;
      services?:      string[];
      coverage?:      string[];
      status?:        string;
      submittedBy?:   string;
      reviewedBy?:    string;
      notes?:         string;
    };

    // ── Core fields — editable only while in draft ──────────────────────────
    const editsCore = ['companyName', 'address', 'email', 'phone', 'website', 'contactPerson', 'contactPersonName', 'contactPersonPhone', 'contactPersonEmail', 'services', 'coverage'].some((k) => k in body);
    if (editsCore) {
      if (doc.status !== 'draft') {
        res.status(409).json({ error: 'Only draft requests can have their details edited.', code: 'NOT_EDITABLE' });
        return;
      }
      if (body.companyName   !== undefined) doc.companyName   = body.companyName.trim();
      if (body.address       !== undefined) doc.address       = body.address.trim();
      if (body.email         !== undefined) doc.email         = body.email;
      if (body.phone         !== undefined) doc.phone         = body.phone;
      if (body.website       !== undefined) doc.website       = body.website.trim();
      if (body.contactPerson !== undefined) doc.contactPerson = body.contactPerson.trim();
      if (body.contactPersonName  !== undefined) doc.contactPersonName  = body.contactPersonName.trim();
      if (body.contactPersonPhone !== undefined) doc.contactPersonPhone = body.contactPersonPhone.trim();
      if (body.contactPersonEmail !== undefined) doc.contactPersonEmail = body.contactPersonEmail.trim();
      if (body.services      !== undefined) doc.services      = body.services;
      if (body.coverage      !== undefined) doc.coverage      = body.coverage;
    }

    // ── Status transition ────────────────────────────────────────────────────
    if (body.status !== undefined) {
      if (!VENDOR_SERVICE_REQUEST_STATUSES.includes(body.status as VendorServiceRequestStatus)) {
        res.status(400).json({ error: 'Invalid status value.', code: 'VALIDATION_ERROR' });
        return;
      }
      const nextStatus = body.status as VendorServiceRequestStatus;

      if (nextStatus === 'submitted' && doc.status === 'draft') {
        doc.submittedAt = new Date();
        doc.submittedBy = body.submittedBy ?? doc.submittedBy ?? 'Admin';
      }

      doc.status = nextStatus;
    }

    // ── Review fields ────────────────────────────────────────────────────────
    if (body.reviewedBy !== undefined || body.notes !== undefined) {
      if (body.reviewedBy !== undefined) doc.reviewedBy = body.reviewedBy;
      if (body.notes      !== undefined) doc.notes      = body.notes;
      doc.reviewedAt = new Date();
    }

    // When a Client Manager transitions a draft to submitted, link to In Progress.
    if (['submitted', 'in_review'].includes(doc.status) && !doc.vendorDetailId) {
      doc.vendorDetailId = await linkToVendorDetails(doc, 'In Progress');
    }

    await doc.save();

    const services = await resolveServices(doc.services);
    res.status(200).json({
      requestId:      doc.requestId,
      companyName:    doc.companyName,
      address:        doc.address,
      email:          doc.email,
      phone:          doc.phone,
      website:        doc.website,
      contactPerson:  doc.contactPerson,
      contactPersonName:  doc.contactPersonName,
      contactPersonPhone: doc.contactPersonPhone,
      contactPersonEmail: doc.contactPersonEmail,
      services,
      coverage:       doc.coverage,
      status:         doc.status,
      vendorDetailId: doc.vendorDetailId,
      submittedBy:    doc.submittedBy,
      submittedAt:    fmt(doc.submittedAt),
      reviewedBy:     doc.reviewedBy,
      reviewedAt:     fmt(doc.reviewedAt),
      notes:          doc.notes,
      createdAt:      fmt(doc.createdAt),
      updatedAt:      fmt(doc.updatedAt),
    });
  } catch (err) {
    await logError(err, 'vendorServiceRequestController.updateVendorServiceRequest');
    res.status(500).json({ error: 'Failed to update vendor service request.', code: 'SERVER_ERROR' });
  }
}

export async function getServiceCategories(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await ServiceRequestRoleModel.find({ status: 'Active' }).sort({ roleName: 1 }).lean();
    res.status(200).json(roles.map((r) => ({
      roleId:      r.roleId,
      name:        r.roleName,
      description: r.description,
    })));
  } catch (err) {
    await logError(err, 'vendorServiceRequestController.getServiceCategories');
    res.status(500).json({ error: 'Failed to load service categories.', code: 'SERVER_ERROR' });
  }
}
