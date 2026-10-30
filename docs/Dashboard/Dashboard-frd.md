# Functional Requirements Document — Executive Overview

## Document Information

| Property | Value |
|----------|-------|
| Module | Claims Triage |
| Screen | Executive Overview |
| Version | 1.0 |
| Date | June 2026 |
| Author | Product Team |
| Status | Draft |

---

# 1. Overview

The Executive Overview is the primary landing screen of the Claims Triage Performance Hub. It provides real-time visibility across 15 claims services and the associated vendor ecosystem, covering KPI metrics, savings performance, vendor scoring, SLA compliance, and exception management.

The dashboard defaults to showing **top 5 records** in every list and chart section. All sections include a **"View All →"** navigation link that opens a full drill-down page with extended records, search, sort, filter, and export capabilities.

---

# 2. User Roles

| Role | Access |
|------|--------|
| Claims Director | Full access — all sections, export, filters |
| Operations Manager | Full access — all sections, export, filters |
| Vendor Manager | Restricted — vendor sections only |
| Read-Only Analyst | View only — no export |

---

# 3. Global Navigation

## Sidebar

The left sidebar is always visible and contains the following items in order:

1. Overview *(active — highlighted)*
2. Services Performance
3. Vendor Scorecards
4. Claim Analytics
5. AI Recommendations
6. Leakage & Savings
7. Subrogation Recovery
8. Alerts & Exceptions
9. Reports
10. Data Explorer
11. Administration

An **AI Insights** panel is pinned to the bottom of the sidebar and displays the latest AI-generated recommendation with a **View Insights →** link.

## Top Header

- Page title: **Executive Overview**
- Subtitle: *Real-time performance across 15 claims services and vendor ecosystem*
- Date range picker (default: current rolling 20-day period)
- **Filters** button — opens filter panel (by Service, Vendor, Region, Claim Type, Severity)
- Notification bell with unread alert badge count
- Logged-in user avatar, name, and role with profile dropdown
- **Export Report** button

---

# 4. KPI Summary Cards

Five summary cards are displayed in a horizontal row at the top of the dashboard.

| # | Label | Sample Value | Trend |
|---|-------|-------------|-------|
| 1 | Total Claims | 12,845 | ↑ 8.4% |
| 2 | Total LAE | $45.62M | ↑ 4.7% |
| 3 | Total Savings | $8.73M | ↑ 12.3% |
| 4 | Subrogation Recovery | $3.21M | ↑ 15.6% |
| 5 | SLA Compliance | 94.2% | ↑ 2.8% |

Each card displays:
- Icon with colored background
- Metric label and value
- Trend arrow (green ↑ positive / red ↓ negative) and percentage vs. selected period
- Checkbox to toggle card visibility

---

# 5. LAE Ratio Trend

- Chart type: Area line chart
- Title: **LAE Ratio** — *LAE as % of Incurred*
- Hero number: current LAE ratio displayed prominently (e.g., 18.6%)
- X-axis: monthly labels aligned to selected date range (e.g., Dec '25 – Apr '26)
- Y-axis: percentage range ~15% to ~22%
- Data points labeled directly on chart (e.g., 20.8%, 20.1%, 19.4%, 18.9%, 18.6%)
- Shaded area fill below the trend line

---

# 6. Top 5 Savings by Service

- Chart type: Horizontal bar chart
- Title: **Top 5 Savings by Service** — *Total Savings (USD)*
- Default display: **top 5 services only**, sorted by savings descending

| # | Service | Savings |
|---|---------|---------|
| 1 | Medical Bill Review | $1.85M |
| 2 | Network Optimization | $1.32M |
| 3 | Pharmacy Carve-Out | $1.15M |
| 4 | DME & Supplies | $0.98M |
| 5 | UR Management | $0.76M |

- Service name displayed left; savings value displayed right of each bar
- Bar color: primary brand blue
- **View All →** link navigates to full savings list (see Section 11.1)

---

# 7. Subrogation Recovery Trend

- Chart type: Area line chart
- Title: **Subrogation Recovery Trend** — *Recovery Amount (USD)*
- X-axis: monthly labels (Dec '25 – Apr '26)
- Y-axis: $0 to $4M with $1M gridline intervals
- Data points labeled (e.g., $1.8M, $2.1M, $2.4M, $2.8M, $3.21M)
- Shaded area fill in green below the trend line

---

# 8. Vendor Performance Overview

- Title: **Vendor Performance Overview**
- Default display: **top 5 vendors**, sorted by Overall Score descending
- Sort dropdown: Overall Score, SLA Compliance, Cycle Time, Trend

### Columns

| Column | Description |
|--------|-------------|
| # | Rank |
| Vendor | Vendor name |
| Overall Score | Score out of 100 |
| SLA Compliance | Percentage |
| Cycle Time (Days) | Average days |
| Trend | Score change vs. period — green (positive) / red (negative) |

### Default Top 5

| # | Vendor | Score | SLA | Cycle Time | Trend |
|---|--------|-------|-----|------------|-------|
| 1 | MedReview Solutions | 92.4 | 96.3% | 7.1 | ↑ 5.2 |
| 2 | Care Network Partners | 89.7 | 94.8% | 12.3 | ↑ 3.1 |
| 3 | PharmaMetrics | 88.9 | 93.6% | 8.4 | ↑ 2.8 |
| 4 | DME Care Services | 87.1 | 92.1% | 2.6 | ↓ 1.4 |
| 5 | NurseSupport 360 | 86.3 | 93.0% | 14.2 | ↑ 1.9 |

- **View All Vendors →** link navigates to full vendor list (see Section 11.2)

---

# 9. SLA Compliance by Service

- Chart type: Horizontal bar chart
- Title: **SLA Compliance by Service**
- Default display: **top 5 services** by compliance rate

### Default Top 5

| # | Service | Compliance |
|---|---------|-----------|
| 1 | Medical Bill Review | 96.8% |
| 2 | UR Management | 95.6% |
| 3 | Network Optimization | 94.7% |
| 4 | Nurse Case Mgmt | 93.9% |
| 5 | Pharmacy Carve-Out | 93.2% |

- Bar color scale: green ≥ 90% / amber 80–89% / red < 80%
- X-axis markers: 0%, 50%, 100%
- Info icon (ⓘ) next to title shows tooltip with metric definition on hover
- **View All →** link navigates to full SLA list (see Section 11.3)

---

# 10. Top Alerts & Exceptions

- Title: **Top Alerts & Exceptions**
- Default display: **top 5 alerts**, ordered by severity (Critical → High → Warning → Info)
- Each row shows: severity icon, alert title, description, and count badge

### Default Alerts

| Severity | Alert Type | Description | Count |
|----------|-----------|-------------|-------|
| 🔴 Critical | SLA Breaches | 12 services breached SLA | 23 |
| 🟠 High | High Cycle Time | 5 services exceeding benchmark | 17 |
| 🟡 Warning | Leakage Risk | 8 claims flagged for leakage | 8 |
| 🔵 Info | Vendor Score Below Threshold | 3 vendors below score threshold | 3 |

- Alert counts refresh in real time (every 5 minutes)
- **View All** link navigates to full alerts page (see Section 11.4)

---

# 11. View All — Extended Lists

All **View All** pages share the following behaviour:

- Full untruncated list (not limited to top 5)
- Same column structure as the overview section
- Breadcrumb back to Executive Overview
- Search / filter by name or value
- Column-level sorting (ASC / DESC)
- Pagination — 25 rows per page
- Export to CSV / Excel

## 11.1 View All — Savings by Service

Additional columns: YTD Savings, % of Total Savings, Prior Period Savings, Change %

## 11.2 View All — Vendors

Additional columns: Vendor Category, Contract End Date, Region
Row click navigates to the vendor's full scorecard page.
Filter sidebar: by SLA status, score range, region.

## 11.3 View All — SLA Compliance

All 15 services displayed.
Additional columns: Breach Count, Avg Resolution Time (hrs), SLA Target %
Filter chips: Green / Amber / Red status.

## 11.4 View All — Alerts & Exceptions

All open alerts displayed.
Additional columns: Raised At, Assigned To, Status (Open / In Progress / Resolved)
Inline actions: Acknowledge, Assign, Mark Resolved.
Filter by: Severity, Status, Date Range.

---

# 12. AI Insights Panel

- Pinned to the bottom of the left sidebar
- Displays the latest AI-generated insight as a short text snippet
- Example: *"DME delivery TAT is above SLA for Region West. Consider vendor rebalancing."*
- Insight text updates dynamically as new recommendations are generated
- **View Insights →** link navigates to the AI Recommendations page

---

# 13. Date Range & Filters

- Preset ranges: Today, Last 7 Days, Last 30 Days, Month to Date, Quarter to Date, Year to Date, Custom Range
- On date range change, all KPI cards, charts, tables, and alerts refresh
- Filter panel: multi-select by Service, Vendor, Region, Claim Type, Severity
- Active filters shown as badge count on the Filters button
- **Clear All Filters** resets to defaults

---

# 14. Export

- **Export Report** button generates a PDF or Excel report of the current dashboard state
- Report reflects the active date range and applied filters
- Includes all visible KPI cards, charts (as images), and top-5 tables
- Export completes within 10 seconds

---

# 15. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Dashboard initial load < 3 seconds |
| NFR-02 | Performance | Chart refresh on filter change < 1.5 seconds |
| NFR-03 | Availability | 99.5% uptime during business hours |
| NFR-04 | Responsiveness | Supports desktop (1280px+) and tablet (768px+) |
| NFR-05 | Accessibility | WCAG 2.1 AA compliant |
| NFR-06 | Security | Authenticated sessions with role-based access control |
| NFR-07 | Data Freshness | KPIs refresh every 15 min; alerts refresh every 5 min |
| NFR-08 | Audit | All user actions (filter, export, navigation) are logged |

---

*End of Functional Requirements Document*
