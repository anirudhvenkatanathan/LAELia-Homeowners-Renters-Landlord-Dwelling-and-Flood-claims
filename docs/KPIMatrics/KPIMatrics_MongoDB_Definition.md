# KPI MongoDB Schema Definition

## Collection: KPI_Matrics
- kpiMatricsId
- serviceRequestRoleId (FK -> service_request_roles)
- kpiGroupTracking
- createdBy
- createdAt
- updatedBy
- updatedAt

## Collection: KPI_Matrics_Group_Tracking
- kpiMatricsGroupTrackingId
- kpiMatricsId (FK -> KPI_Matrics)
- kpiGroupTracking
- kpiGroupTrackingSuggestion
- createdBy
- createdAt
- updatedBy
- updatedAt

## Collection: KPI_Matrics_Field_And_Sections
- kpiMatricsFieldAndSectionsId
- kpiMatricsGroupTrackingId (FK -> KPI_Matrics_Group_Tracking)
- thresholdsGood
- thresholdsModerate
- thresholdsPoor
- betterWhen
- createdBy
- createdAt
- updatedBy
- updatedAt

## Collection: KPI_Matrics_Field_And_Condition
- kpiMatricsFieldAndConditionId
- kpiMatricsFieldAndSectionsId (FK -> KPI_Matrics_Field_And_Sections)
- fieldName
- operator
- value
- conditionType
- sortOrder
- createdBy
- createdAt
- updatedBy
- updatedAt
