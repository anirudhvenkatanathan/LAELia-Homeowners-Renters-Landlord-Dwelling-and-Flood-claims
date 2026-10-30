# Technical Specification
## Vendor Service Request Module — ClaimFlow

**Version:** 1.0  
**Module:** Services > Vendor Service Request  
**Stack:** Node.js / Express · MongoDB (Mongoose) · React (existing frontend)

---

## 1. Architecture Overview

```
Frontend (React)
    └── /services/vendor-request          → List screen
    └── /services/vendor-request/new      → Create form
    └── /services/vendor-request/:id      → View/detail

Backend (REST API)
    └── /api/vendor-service-requests      → CRUD endpoints

MongoDB Collections
    ├── vendor_service_requests            → NEW — stores all requests
    ├── vendor_details                     → EXISTING — vendor master data
    └── service_request_roles              → EXISTING — service definitions
```

---

## 2. MongoDB Schema

### 2.1 New Collection: `vendor_service_requests`

```js
// mongoose schema: VendorServiceRequest
{
  _id: ObjectId,                      // auto

  // ── Company Info ──────────────────────────────────────────
  companyName:   { type: String, required: true, trim: true },
  email:         { type: String, trim: true, lowercase: true },
  phone:         { type: String, trim: true },

  // ── Service Selection ─────────────────────────────────────
  // Array of ObjectId refs to service_request_roles
  services: [
    { type: ObjectId, ref: 'ServiceRequestRole', required: true }
  ],

  // ── Geographic Coverage ───────────────────────────────────
  // ISO 3166-2 state codes e.g. ["FL", "GA", "AL"]
  coverage: [{ type: String, uppercase: true }],

  // ── Lifecycle ─────────────────────────────────────────────
  status: {
    type: String,
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected'],
    default: 'draft'
  },

  // ── Link to vendor_details (populated on Approved) ────────
  vendorDetailId: { type: ObjectId, ref: 'VendorDetail', default: null },

  // ── Audit ─────────────────────────────────────────────────
  submittedBy:   { type: String },          // user display name or userId
  submittedAt:   { type: Date },            // set when status → submitted
  reviewedBy:    { type: String },
  reviewedAt:    { type: Date },
  notes:         { type: String },

  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now }
}
```

**Indexes:**
```js
vendorServiceRequestSchema.index({ status: 1 });
vendorServiceRequestSchema.index({ companyName: 'text' });   // text search
vendorServiceRequestSchema.index({ createdAt: -1 });
```

---

### 2.2 Existing Collection: `service_request_roles`

Used as the source-of-truth for all service categories displayed in the New Vendor form. No schema changes required — only reads.

Expected shape (existing):
```js
{
  _id: ObjectId,
  code:     String,   // "S-01"
  name:     String,   // "Records — Defense"
  category: String,   // "Legal" | "Investigation" | "Medical Management" | ...
  active:   Boolean
}
```

All documents where `active: true` are fetched and rendered as selectable cards on the New Vendor Request form.

---

### 2.3 Existing Collection: `vendor_details`

Populated/linked when a request reaches **Approved** status. The `vendorDetailId` on the request record is set to the corresponding `_id` in `vendor_details`.

Expected shape (existing — read-only from this module):
```js
{
  _id: ObjectId,
  companyName: String,
  ...            // other vendor master fields
}
```

---

## 3. REST API Endpoints

Base path: `/api/vendor-service-requests`

### 3.1 List requests

```
GET /api/vendor-service-requests
```

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter by status enum value |
| `search` | string | — | Full-text search on companyName |
| `page` | number | 1 | Pagination |
| `limit` | number | 50 | Page size |

**Response `200`:**
```json
{
  "data": [
    {
      "_id": "...",
      "companyName": "Verity Field Services LLC",
      "services": [{ "code": "S-06", "name": "Field Investigations" }],
      "coverage": ["FL", "GA", "AL"],
      "submittedBy": "Admin",
      "createdAt": "2026-06-01",
      "status": "in_review"
    }
  ],
  "total": 5,
  "page": 1
}
```

---

### 3.2 Get single request

```
GET /api/vendor-service-requests/:id
```

Populates `services` from `service_request_roles` and `vendorDetailId` from `vendor_details`.

**Response `200`:**
```json
{
  "_id": "...",
  "companyName": "Verity Field Services LLC",
  "email": "ops@verityinvestigations.com",
  "phone": "(904) 555-0182",
  "services": [
    { "_id": "...", "code": "S-05", "name": "Desk Investigations", "category": "Investigation" },
    { "_id": "...", "code": "S-06", "name": "Field Investigations", "category": "Investigation" }
  ],
  "coverage": ["FL", "GA", "AL"],
  "status": "in_review",
  "submittedBy": "Admin",
  "createdAt": "2026-06-01"
}
```

---

### 3.3 Create request (New Vendor)

```
POST /api/vendor-service-requests
```

**Request body:**
```json
{
  "companyName": "Acme Field Services",
  "email": "contact@acme.com",
  "phone": "(800) 555-1234",
  "services": ["<ObjectId_S-01>", "<ObjectId_S-03>"],
  "coverage": ["TX", "OK"],
  "status": "draft"           // "draft" or "submitted"
}
```

**Validation:**
- `companyName` required.
- `services` must be non-empty array.
- `status` must be `draft` or `submitted` (cannot create as in_review/approved/rejected).
- If `status = submitted`, set `submittedAt = now`, `submittedBy = req.user.name`.

**Response `201`:** Full created document.

---

### 3.4 Update request

```
PATCH /api/vendor-service-requests/:id
```

Allowed field updates:

| Field | Allowed when status is |
|---|---|
| companyName, email, phone, services, coverage | `draft` only |
| status | Any (role-gated — see §5) |
| reviewedBy, reviewedAt, notes | `in_review`, `approved`, `rejected` |
| vendorDetailId | `approved` only |

**Response `200`:** Updated document.

---

### 3.5 Get all service categories (for New Vendor form)

```
GET /api/service-request-roles
```

Returns all `active: true` services from `service_request_roles`, sorted by `code` ascending.

**Response `200`:**
```json
[
  { "_id": "...", "code": "S-01", "name": "Records — Defense", "category": "Legal" },
  { "_id": "...", "code": "S-02", "name": "Records — Adverse Party", "category": "Legal" },
  ...
]
```

---

## 4. Frontend — Component Map

```
/services/vendor-request
  └── VendorRequestList.jsx
        ├── StatusFilterTabs.jsx          (All | Draft | Submitted | ...)
        ├── VendorSearchInput.jsx
        └── VendorRequestTable.jsx
              └── StatusBadge.jsx

/services/vendor-request/new
  └── NewVendorRequestForm.jsx
        ├── CompanySection.jsx            (Name, Email, Phone)
        ├── ServiceCategoryGrid.jsx       ← fetches GET /api/service-request-roles
        │     └── ServiceCard.jsx         (checkbox, code badge, category tag)
        ├── GeographicCoverage.jsx        (state multi-select)
        └── FormActions.jsx               (Save Draft | Submit | Cancel)

/services/vendor-request/:id
  └── VendorRequestDetail.jsx
        ├── CompanySection.jsx            (read-only)
        ├── ServiceCategoryGrid.jsx       (read-only, selected cards highlighted)
        └── GeographicCoverage.jsx        (read-only)
```

### Key State & Data Flow

```
NewVendorRequestForm:
  onMount   → GET /api/service-request-roles   → populate ServiceCategoryGrid
  onSubmit  → POST /api/vendor-service-requests → redirect to list

VendorRequestList:
  onMount   → GET /api/vendor-service-requests  → populate table
  onFilter  → re-fetch with ?status=            → update table
  onSearch  → re-fetch with ?search=            → update table
  onView    → navigate /services/vendor-request/:id

VendorRequestDetail:
  onMount   → GET /api/vendor-service-requests/:id (populated) → render
```

---

## 5. Authorization

Middleware: `requireRole(['admin', 'reviewer', 'submitter'])`

| Route | Minimum Role |
|---|---|
| GET list | submitter |
| GET single | submitter (own records); reviewer/admin (all) |
| POST create | submitter |
| PATCH (fields only) | submitter (own draft records) |
| PATCH status → submitted | submitter |
| PATCH status → in_review / approved / rejected | reviewer / admin |
| PATCH vendorDetailId | admin |

---

## 6. Linking `vendor_service_requests` → `vendor_details`

When a request is **Approved**:

1. Admin/reviewer sets `status = approved` via `PATCH /api/vendor-service-requests/:id`.
2. Backend hook (`post-save` or explicit service call) checks if a `vendor_details` record with matching `companyName` already exists.
   - If **found**: update the existing `vendor_details` record — add new service codes and states to its profile. Set `vendorDetailId` on the request.
   - If **not found**: create a new `vendor_details` document from the request data. Set `vendorDetailId` on the request.
3. Respond with the updated request (including populated `vendorDetailId`).

```js
// pseudo-code — vendor linking service
async function linkToVendorDetails(request) {
  let vendor = await VendorDetail.findOne({ companyName: request.companyName });
  if (!vendor) {
    vendor = await VendorDetail.create({
      companyName: request.companyName,
      email: request.email,
      phone: request.phone,
      services: request.services,
      coverage: request.coverage,
    });
  } else {
    // merge services and coverage without duplicates
    vendor.services = [...new Set([...vendor.services.map(String), ...request.services.map(String)])];
    vendor.coverage = [...new Set([...vendor.coverage, ...request.coverage])];
    await vendor.save();
  }
  request.vendorDetailId = vendor._id;
  await request.save();
}
```

---

## 7. Migration / Seed

On first deploy, seed `service_request_roles` with all 15 service definitions if not already present:

```js
// seed/serviceRoles.js
const roles = [
  { code: 'S-01', name: 'Records — Defense',       category: 'Legal',              active: true },
  { code: 'S-02', name: 'Records — Adverse Party', category: 'Legal',              active: true },
  { code: 'S-03', name: 'Medical Canvassing',       category: 'Investigation',      active: true },
  { code: 'S-04', name: 'IME / Peer Review',        category: 'Medical Management', active: true },
  { code: 'S-05', name: 'Desk Investigations',      category: 'Investigation',      active: true },
  { code: 'S-06', name: 'Field Investigations',     category: 'Investigation',      active: true },
  { code: 'S-07', name: 'TBD',                      category: 'TBD',                active: false },
  // ... S-08 through S-15 to be defined
];
await ServiceRequestRole.insertMany(roles, { ordered: false });
```

---

## 8. Error Handling

| HTTP Code | Scenario |
|---|---|
| 400 | Validation failure (missing companyName, empty services) |
| 403 | Role not permitted for the action |
| 404 | Request ID not found |
| 409 | Attempt to edit a non-draft record's core fields |
| 500 | Unexpected server/DB error |

All errors return: `{ "error": "human readable message", "code": "ERROR_CODE" }`

---

## 9. Testing Checklist

- [ ] Create request as Draft — appears in list with Draft badge
- [ ] Submit request — status changes to Submitted
- [ ] View detail via "View" link — all fields display correctly
- [ ] New Vendor form loads all 15 services from `service_request_roles`
- [ ] Select All / Clear All work correctly
- [ ] Status filter tabs filter correctly
- [ ] Vendor name search filters results
- [ ] Approving a request creates/updates a `vendor_details` record
- [ ] `vendorDetailId` is set on approved request
- [ ] Submitter cannot change status beyond Submitted
- [ ] Reviewer/Admin can move status through full lifecycle
