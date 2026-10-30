export type VendorServiceRequestStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export const VENDOR_SERVICE_REQUEST_STATUSES: VendorServiceRequestStatus[] =
  ['draft', 'submitted', 'in_review', 'approved', 'rejected'];

export interface ServiceCategory {
  roleId:      string;
  name:        string;
  description: string;
}

export interface VendorServiceRequestService {
  roleId: string;
  name:   string;
}

export interface VendorServiceRequestListItem {
  requestId:     string;
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  services:      VendorServiceRequestService[];
  coverage:      string[];
  status:        VendorServiceRequestStatus;
  submittedBy:   string;
  createdAt:     string | null;
  updatedAt:     string | null;
}

export interface VendorServiceRequestDetail extends VendorServiceRequestListItem {
  vendorDetail: { vendorId: string; companyName: string } | null;
  vendorDetailId?: string | null;
  submittedAt: string | null;
  reviewedBy:  string;
  reviewedAt:  string | null;
  notes:       string;
}

export interface VendorServiceRequestListResponse {
  data:  VendorServiceRequestListItem[];
  total: number;
  page:  number;
}

export interface CreateVendorServiceRequestInput {
  companyName:   string;
  address:       string;
  email:         string;
  phone:         string;
  website:       string;
  contactPerson: string;
  contactPersonName:  string;
  contactPersonPhone: string;
  contactPersonEmail: string;
  services:      string[];
  coverage:      string[];
  status:        'draft' | 'submitted';
  submittedBy?:  string;
}

export interface UpdateVendorServiceRequestInput {
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
  status?:        VendorServiceRequestStatus;
  submittedBy?:   string;
  reviewedBy?:    string;
  notes?:         string;
}

// ─── Status display helpers ────────────────────────────────────────────────

export type StatusBadgeVariant = 'badge-green' | 'badge-yellow' | 'badge-red' | 'badge-blue' | 'badge-gray';

export const STATUS_LABELS: Record<VendorServiceRequestStatus, string> = {
  draft:      'Draft',
  submitted:  'Submitted',
  in_review:  'In Review',
  approved:   'Approved',
  rejected:   'Rejected',
};

export function resolveStatusLabel(status: string): string {
  return STATUS_LABELS[status as VendorServiceRequestStatus] ?? status;
}

export function resolveStatusBadge(status: string): StatusBadgeVariant {
  switch (status) {
    case 'draft':     return 'badge-gray';
    case 'submitted': return 'badge-blue';
    case 'in_review': return 'badge-yellow';
    case 'approved':  return 'badge-green';
    case 'rejected':  return 'badge-red';
    default:          return 'badge-gray';
  }
}

// ─── Geographic coverage ────────────────────────────────────────────────────

export const US_STATES: { code: string; name: string }[] = [
  { code: 'Virtual', name: 'Virtual' },
  { code: 'AL', name: 'Alabama' },        { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },        { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },     { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },    { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },        { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },         { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },       { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },           { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },       { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },          { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },      { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },       { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },       { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },     { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },           { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },         { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },   { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },   { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },          { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },        { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },     { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },      { code: 'WY', name: 'Wyoming' },
];
