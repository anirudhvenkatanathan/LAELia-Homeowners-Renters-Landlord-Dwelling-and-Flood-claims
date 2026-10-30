# Technical Specification — Executive Overview

## Document Information

| Property | Value |
|----------|-------|
| Module | Claims Triage |
| Screen | Executive Overview |
| Frontend | Next.js |
| Backend | Node.js |
| API Layer | REST + WebSocket |
| Database | PostgreSQL + ClickHouse + Redis |
| Version | 1.0 |
| Date | June 2026 |

---

# 1. Architecture Overview

The Executive Overview dashboard renders real-time performance data across 15 claims services and their vendor ecosystem. Data flows from:

- PostgreSQL — transactional records (vendors, alerts, users)
- ClickHouse — time-series aggregations (LAE ratio, savings trends, subrogation trends)
- Redis — cached aggregation responses (KPI cards, chart data)
- WebSocket — live alert badge count updates

All sections default to **top 5 records**. Extended data is accessible via **View All** drill-down pages at dedicated routes.

---

# 2. Frontend Design (Next.js)

## Components

- ExecutiveOverviewPage
- AppShell
- Sidebar
- TopHeader
- KpiCardRow
- LaeRatioChart
- SavingsByServiceChart
- SubrogationTrendChart
- VendorPerformanceTable
- SlaComplianceChart
- AlertsPanel
- AiInsightsPanel
- DateRangePicker
- FiltersPanel
- ViewAllPage *(shared wrapper for all drill-down pages)*

## Folder Structure

```
/pages/dashboard/overview
/pages/dashboard/view-all/[section]
/components/dashboard/overview
/components/dashboard/shared
/services/dashboard
/hooks/dashboard
```

---

# 3. REST APIs

## GET /api/v1/dashboard/kpis

Returns all 5 KPI card values and trend data.

### Query Parameters

- `from` — start date (ISO string)
- `to` — end date (ISO string)

### Response

- period
- kpis[ ]
  - id
  - label
  - value
  - formatted
  - trendPercent
  - trendDirection

---

## GET /api/v1/dashboard/lae-ratio

Returns monthly LAE ratio time-series.

### Query Parameters

- `from`
- `to`
- `granularity` (monthly)

### Response

- currentValue
- data[ ]
  - month
  - value

---

## GET /api/v1/dashboard/savings-by-service

Returns savings per service, sorted descending.

### Query Parameters

- `from`
- `to`
- `limit` (default: 5 for overview / 100 for View All)
- `page`

### Response

- total
- returned
- data[ ]
  - service
  - savings
  - ytdSavings
  - priorPeriodSavings
  - percentOfTotal

---

## GET /api/v1/dashboard/subrogation-trend

Returns monthly subrogation recovery time-series.

### Query Parameters

- `from`
- `to`
- `granularity` (monthly)

### Response

- data[ ]
  - month
  - amount

---

## GET /api/v1/vendors

Returns vendor list with performance scores.

### Query Parameters

- `sortBy` (score | sla | cycleTime | trend)
- `order` (asc | desc)
- `limit` (default: 5 for overview / 25 for View All)
- `page`

### Response

- total
- returned
- data[ ]
  - id
  - rank
  - vendorName
  - overallScore
  - slaCompliance
  - cycleTimeDays
  - trendValue
  - trendDirection
  - category
  - region
  - contractEndDate

---

## GET /api/v1/dashboard/sla-compliance

Returns SLA compliance percentage per service.

### Query Parameters

- `limit` (default: 5 for overview / 100 for View All)
- `sortBy` (compliance)
- `order` (asc | desc)

### Response

- data[ ]
  - serviceId
  - serviceName
  - compliance
  - slaTarget
  - breachCount
  - avgResolutionTimeHours
  - status (green | amber | red)

---

## GET /api/v1/alerts

Returns active alerts list.

### Query Parameters

- `limit` (default: 5 for overview / 25 for View All)
- `status` (open | in_progress | resolved)
- `page`

### Response

- data[ ]
  - id
  - severity (critical | high | warning | info)
  - title
  - description
  - count
  - status
  - raisedAt
  - assignedTo
  - resolvedAt

---

## POST /api/v1/alerts/:id/acknowledge

Acknowledges an alert.

---

## POST /api/v1/alerts/:id/assign

Assigns an alert to a user.

---

## PATCH /api/v1/alerts/:id/status

Updates alert status to open, in_progress, or resolved.

---

## GET /api/v1/ai-insights/latest

Returns the latest AI-generated insight snippet.

### Response

- insightText
- generatedAt

---

## WebSocket — ws://api/alerts/live

Streams live alert badge count updates to the top header notification bell.

### Message

- totalCount
- updatedAt

---

# 4. Backend Design (Node.js)

## Services

### dashboardKpi.service.ts

Responsibilities:

- Aggregate total claims, LAE, savings, subrogation recovery, SLA compliance
- Apply date range filters
- Return formatted values and trend calculations

### laeRatio.service.ts

Responsibilities:

- Query monthly LAE ratio from ClickHouse
- Return time-series array and current value

### savingsByService.service.ts

Responsibilities:

- Aggregate savings per service for the selected period
- Sort descending by savings amount
- Support limit / pagination for overview vs. View All

### subrogationTrend.service.ts

Responsibilities:

- Query monthly subrogation recovery amounts from ClickHouse
- Return time-series array

### vendor.service.ts

Responsibilities:

- Retrieve vendor list with scores
- Support sort, limit, and pagination
- Return vendor detail for scorecard navigation

### slaCompliance.service.ts

Responsibilities:

- Calculate SLA compliance percentage per service
- Classify status as green, amber, or red
- Support limit / pagination for overview vs. View All

### alert.service.ts

Responsibilities:

- Retrieve and sort active alerts by severity
- Support limit / pagination for overview vs. View All
- Handle acknowledge, assign, and status update actions
- Push live count updates via WebSocket

### aiInsight.service.ts

Responsibilities:

- Return the latest AI-generated insight record

---

# 5. MongoDB Collections

> Note: PostgreSQL is used for transactional records. ClickHouse is used for time-series analytics. The collections below reflect the logical data models.

## vendors

Fields:

- id
- name
- category
- region
- contractEndDate
- overallScore
- slaCompliance
- cycleTimeDays
- trendValue
- trendDirection
- updatedAt

---

## alerts

Fields:

- id
- severity
- title
- description
- count
- status
- raisedAt
- assignedTo
- resolvedAt
- createdAt
- updatedAt

---

## alert_audit

Fields:

- alertId
- action
- user
- timestamp
- status
- remarks

---

## sla_compliance

Fields:

- serviceId
- serviceName
- compliance
- slaTarget
- breachCount
- avgResolutionTimeHours
- status
- periodFrom
- periodTo
- updatedAt

---

## service_savings

Fields:

- serviceId
- serviceName
- periodFrom
- periodTo
- savings
- ytdSavings
- priorPeriodSavings
- percentOfTotal

---

# 6. View All Pages

All View All pages are served at `/dashboard/view-all/[section]` and rendered by the shared `<ViewAllPage />` component.

## Shared Behaviour

- Full untruncated data (no top-5 limit)
- Breadcrumb: Overview → [Section]
- Search input (client-side row filtering)
- Column-level sort (ASC / DESC toggle)
- Pagination — 25 rows per page
- Export to CSV / Excel

## Sections

| Section | Route | Additional Columns |
|---------|-------|--------------------|
| Savings by Service | `/view-all/savings` | YTD Savings, % of Total, Prior Period, Change % |
| Vendors | `/view-all/vendors` | Category, Contract End Date, Region |
| SLA Compliance | `/view-all/sla-compliance` | Breach Count, Avg Resolution Time, SLA Target |
| Alerts & Exceptions | `/view-all/alerts` | Raised At, Assigned To, Status |

---

# 7. Validation Rules

## Date Range

- `from` and `to` must be valid ISO date strings
- `from` must not be after `to`
- Maximum range: 365 days

## Filters

- Service, Vendor, Region, Claim Type values must match allowed enumerations
- Severity filter accepts: critical, high, warning, info

## Export

- Maximum exportable rows: 10,000
- Allowed formats: CSV, XLSX

---

# 8. Security

- Authentication required on all endpoints
- Role-based authorization enforced per section
- Audit logging for all user actions (filter, export, navigation, alert actions)
- Access token stored in memory only (not localStorage)
- Refresh token stored in HttpOnly secure cookie
- JWT expiry: 15 minutes; Refresh token expiry: 7 days

---

# 9. Error Codes

| Code | Description |
|------|-------------|
| EO-001 | Invalid date range |
| EO-002 | Unauthorized access |
| EO-003 | Invalid filter parameter |
| EO-004 | Data aggregation failure |
| EO-005 | Export generation failure |
| EO-006 | Alert action failed |
| EO-007 | WebSocket connection error |
| EO-008 | Database query timeout |

---

# 10. Performance

- Dashboard initial load < 3 seconds
- Chart refresh on filter change < 1.5 seconds
- View All page load < 2 seconds
- Export generation < 10 seconds

### Caching (Redis TTLs)

| Data | TTL |
|------|-----|
| KPI cards | 15 minutes |
| Chart time-series | 15 minutes |
| SLA compliance | 5 minutes |
| Alert count | 5 minutes |
| AI insight | 10 minutes |

---

# 11. Required Packages

**Frontend**

```
next
react
typescript
recharts
zustand
@tanstack/react-query
tailwindcss
react-virtual
```

**Backend**

```
fastify
prisma
ioredis
ws
clickhouse-client
jsonwebtoken
zod
uuid
```

---

# 12. Processing Workflow

1. User lands on Executive Overview.
2. System applies default date range (rolling 20-day period).
3. System fetches KPI cards, LAE ratio, top-5 savings, subrogation trend, top-5 vendors, top-5 SLA, top-5 alerts in parallel.
4. Charts and tables render with skeleton placeholders during fetch.
5. User adjusts date range or applies filters.
6. All sections re-fetch and refresh with updated parameters.
7. User clicks **View All →** on any section.
8. System navigates to the corresponding View All route with active filters preserved in URL.
9. Full dataset loads with search, sort, and pagination available.
10. User clicks **Export Report**.
11. System generates PDF or Excel report reflecting current state and downloads it.

---

*End of Technical Specification*
