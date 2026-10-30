export interface Vendor {
  vendorId:               string;
  companyName:            string;
  emailId:                string;
  rating:                 number;
  address:                string;
  city:                   string;
  state:                  string;
  country:                string;
  phoneNumber:            string;
  turnaroundTime:         string;
  serviceRequestRoleId:    string;
  serviceRequestRoleName:  string;
  serviceRequestRoleNames?: string[];
  createdBy:              string;
  createdAt:              string;
  uploadedBy:             string;
  uploadedAt:             string;
  coverage?:      string;    // Coverage areas, e.g. "TX, OK, LA, NM" (from vendor_details.Coverage)
  vendorSource?:  string;    // 'panel' for Vendor Panel vendors
  // ─── Vendor Search extended fields ───────────────────────────────────────────
  status?:        string;    // 'Active' | 'Suspended' | 'requal Due' (normalised from vendor_status.VendorStatusCode)
  statusReason?:  string;    // Reason for suspension or upcoming requalification
  legalEntity?:   string;    // Legal entity / registered name
  capacity?:      number;    // Current active assignment count
  capacityMax?:   number;    // Maximum assignment capacity
  requalDue?:     string;    // ISO date string for next requalification due date
  boostApplied?:  boolean;   // Priority Boost completed (Service Provider Administration "Boost" column)
}

export interface VendorFormValues {
  companyName:          string;
  emailId:              string;
  phoneNumber:          string;
  serviceRequestRoleId: string;
  rating:               string;
  address:              string;
  city:                 string;
  state:                string;
  country:              string;
  turnaroundTime:       string;
}

export const EMPTY_FORM: VendorFormValues = {
  companyName:          '',
  emailId:              '',
  phoneNumber:          '',
  serviceRequestRoleId: '',
  rating:               '',
  address:              '',
  city:                 '',
  state:                '',
  country:              '',
  turnaroundTime:       '',
};

export interface VendorMutationResponse {
  success:  boolean;
  message:  string;
  vendorId: string;
}
