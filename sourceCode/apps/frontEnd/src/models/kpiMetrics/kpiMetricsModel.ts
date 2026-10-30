export interface KpiServiceRole {
  roleId:   string;
  roleName: string;
  roleCode: string;
}

export interface KpiCondition {
  kpiMatricsFieldAndConditionId: string;
  fieldName:     string;
  operator:      string;
  value:         string;
  ShowValue:         string;
  conditionType: string;
  sortOrder:     number;
}

export interface KpiSection {
  kpiMatricsFieldAndSectionsId: string;
  thresholdsGood:     string;
  thresholdsModerate: string;
  thresholdsPoor:     string;
  betterWhen:         string;
}

export interface KpiMetric {
  kpiMatricsGroupTrackingId:  string;
  kpiGroupTracking:           string;
  kpiGroupTrackingSuggestion: string;
  isVendorKPI:                boolean;
  isActive:                   boolean;
  updatedBy:                  string;
  updatedAt:                  string;
  section:                    KpiSection | null;
  conditions:                 KpiCondition[];
}

export interface KpiGroup {
  kpiMatricsId:        string;
  kpiGroupTracking:    string;
  serviceRequestRoleId: string;
  isVendorKPI:         boolean;
  isActive:            boolean;
  metrics:             KpiMetric[];
}

export interface AiRecommendation {
  ruleId:                       string;
  kpiMatricsFieldAndSectionsId: string;
  kpiMatricsGroupTrackingId:    string;
  serviceName:   string;
  metricLabel:   string;
  currentRule:   string;
  suggestedRule: string;
  description:   string;
}

export interface NewMetricPayload {
  serviceRequestRoleId:       string;
  kpiGroupTracking:           string;
  kpiGroupTrackingName:       string;
  kpiGroupTrackingSuggestion: string;
  thresholdsGood:             string;
  thresholdsModerate:         string;
  thresholdsPoor:             string;
  betterWhen:                 string;
  isVendorKPI?:               boolean;
  conditions: Array<{
    fieldName:     string;
    operator:      string;
    value:         string;
    ShowValue:         string;
    conditionType: string;
    sortOrder:     number;
  }>;
}
