import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type {
  UploadServiceRequestRoleResponse,
  ServiceRequestRoleUploadRow,
  ServiceRequestRoleDetails,
  RoleInput,
  ConditionInput,
  SaveRoleResponse,
  SaveConditionsResponse,
} from '../../models/ServiceRequestRole/serviceRequestRoleModel';
import type { RoleOperator, NlpFieldMapping } from '../../models/ServiceRequestRole/serviceRequestRoleModel';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const UPLOAD_SRR_MUTATION = gql`
  mutation UploadServiceRequestRole(
    $excelBase64: String!
    $fileName:    String
    $uploadedBy:  String
  ) {
    uploadServiceRequestRole(
      excelBase64: $excelBase64
      fileName:    $fileName
      uploadedBy:  $uploadedBy
    ) {
      uploadId totalRecords status message success
    }
  }
`;

const GET_SRR_UPLOADS_QUERY = gql`
  query GetServiceRequestRoleUploads {
    getServiceRequestRoleUploads {
      uploadId fileName uploadType totalRecords uploadedBy uploadDate status
    }
  }
`;

const GET_SRR_DETAILS_QUERY = gql`
  query GetServiceRequestRoleDetails($uploadId: String!) {
    getServiceRequestRoleDetails(uploadId: $uploadId) {
      uploadId fileName uploadType totalRecords uploadedBy uploadDate status
      roles      { roleId uploadId roleName description status lineOfBusiness }
      conditions { conditionId roleId fieldName operator value conditionType sortOrder }
    }
  }
`;

const SAVE_ROLES_MUTATION = gql`
  mutation SaveServiceRequestRole($uploadId: String!, $roles: [RoleInput!]!) {
    saveServiceRequestRole(uploadId: $uploadId, roles: $roles) {
      success message savedCount
    }
  }
`;

const SAVE_CONDITIONS_MUTATION = gql`
  mutation SaveRoleConditions($roleId: String!, $conditions: [ConditionInput!]!) {
    saveRoleConditions(roleId: $roleId, conditions: $conditions) {
      success message savedCount
    }
  }
`;

const GET_ALL_ROLES_QUERY = gql`
  query GetAllServiceRequestRoles {
    getAllServiceRequestRoles {
      roleId uploadId roleName description status nlpCondition conditionExpression nlpConditionInWords lineOfBusiness
    }
  }
`;

const GET_ROLE_BY_ID_QUERY = gql`
  query GetServiceRequestRoleById($roleId: String!) {
    getServiceRequestRoleById(roleId: $roleId) {
      roleId uploadId roleName description status nlpCondition conditionExpression nlpConditionInWords lineOfBusiness
    }
  }
`;

const GET_ROLE_CONDITIONS_QUERY = gql`
  query GetRoleConditions($roleId: String!) {
    getRoleConditions(roleId: $roleId) {
      conditionId roleId fieldName operator value conditionType sortOrder
    }
  }
`;

const CREATE_ROLE_MUTATION = gql`
  mutation CreateServiceRequestRole($roleName: String!, $description: String, $uploadedBy: String, $nlpCondition: String, $conditionExpression: String, $nlpConditionInWords: String, $lineOfBusiness: [String!]!) {
    createServiceRequestRole(roleName: $roleName, description: $description, uploadedBy: $uploadedBy, nlpCondition: $nlpCondition, conditionExpression: $conditionExpression, nlpConditionInWords: $nlpConditionInWords, lineOfBusiness: $lineOfBusiness) {
      success roleId message
    }
  }
`;

const UPDATE_ROLE_MUTATION = gql`
  mutation UpdateServiceRequestRole($roleId: String!, $roleName: String!, $description: String, $status: String, $nlpCondition: String, $conditionExpression: String, $nlpConditionInWords: String, $lineOfBusiness: [String!]!) {
    updateServiceRequestRole(roleId: $roleId, roleName: $roleName, description: $description, status: $status, nlpCondition: $nlpCondition, conditionExpression: $conditionExpression, nlpConditionInWords: $nlpConditionInWords, lineOfBusiness: $lineOfBusiness) {
      success roleId message
    }
  }
`;

const DELETE_ROLE_MUTATION = gql`
  mutation DeleteServiceRequestRole($roleId: String!) {
    deleteServiceRequestRole(roleId: $roleId) {
      success roleId message
    }
  }
`;

const GET_OPERATOR_OPTIONS_QUERY = gql`
  query GetOperatorOptions {
    getOperatorOptions {
      operatorId label value sortOrder
    }
  }
`;

const GET_FIELD_OPTIONS_QUERY = gql`
  query GetFieldOptions {
    getFieldOptions
  }
`;

const GET_NLP_FIELD_MAPPINGS_QUERY = gql`
  query GetNlpFieldMappings {
    getNlpFieldMappings {
      sourceField
      nlpAlias
    }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function uploadServiceRequestRole(
  excelBase64: string,
  fileName?: string,
  uploadedBy?: string
): Promise<UploadServiceRequestRoleResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ uploadServiceRequestRole: UploadServiceRequestRoleResponse }>({
      mutation: UPLOAD_SRR_MUTATION,
      variables: { excelBase64, fileName: fileName ?? null, uploadedBy: uploadedBy ?? 'Admin' },
    });
    if (!data?.uploadServiceRequestRole) throw new Error('No data returned.');
    return data.uploadServiceRequestRole;
  } catch (err) {
    logError(err, 'serviceRequestRoleService.uploadServiceRequestRole');
    throw err;
  }
}

export async function getServiceRequestRoleUploads(): Promise<ServiceRequestRoleUploadRow[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getServiceRequestRoleUploads: ServiceRequestRoleUploadRow[] }>({
      query: GET_SRR_UPLOADS_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getServiceRequestRoleUploads ?? [];
  } catch (err) {
    logError(err, 'serviceRequestRoleService.getServiceRequestRoleUploads');
    throw err;
  }
}

export async function getServiceRequestRoleDetails(uploadId: string): Promise<ServiceRequestRoleDetails> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getServiceRequestRoleDetails: ServiceRequestRoleDetails }>({
      query: GET_SRR_DETAILS_QUERY,
      variables: { uploadId },
      fetchPolicy: 'network-only',
    });
    if (!data?.getServiceRequestRoleDetails) throw new Error(`No details found for uploadId: ${uploadId}`);
    return data.getServiceRequestRoleDetails;
  } catch (err) {
    logError(err, 'serviceRequestRoleService.getServiceRequestRoleDetails');
    throw err;
  }
}

export async function saveServiceRequestRole(uploadId: string, roles: RoleInput[]): Promise<SaveRoleResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ saveServiceRequestRole: SaveRoleResponse }>({
      mutation: SAVE_ROLES_MUTATION,
      variables: { uploadId, roles },
    });
    if (!data?.saveServiceRequestRole) throw new Error('No data returned.');
    return data.saveServiceRequestRole;
  } catch (err) {
    logError(err, 'serviceRequestRoleService.saveServiceRequestRole');
    throw err;
  }
}

export async function saveRoleConditions(roleId: string, conditions: ConditionInput[]): Promise<SaveConditionsResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ saveRoleConditions: SaveConditionsResponse }>({
      mutation: SAVE_CONDITIONS_MUTATION,
      variables: { roleId, conditions },
    });
    if (!data?.saveRoleConditions) throw new Error('No data returned.');
    return data.saveRoleConditions;
  } catch (err) {
    logError(err, 'serviceRequestRoleService.saveRoleConditions');
    throw err;
  }
}

export async function getServiceRequestRoleById(roleId: string): Promise<import('../../models/ServiceRequestRole/serviceRequestRoleModel').ServiceRequestRole | null> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getServiceRequestRoleById: import('../../models/ServiceRequestRole/serviceRequestRoleModel').ServiceRequestRole | null }>({
      query: GET_ROLE_BY_ID_QUERY, variables: { roleId }, fetchPolicy: 'network-only',
    });
    return data?.getServiceRequestRoleById ?? null;
  } catch (err) { logError(err, 'serviceRequestRoleService.getServiceRequestRoleById'); return null; }
}

export async function getAllServiceRequestRoles(): Promise<import('../../models/ServiceRequestRole/serviceRequestRoleModel').ServiceRequestRole[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getAllServiceRequestRoles: import('../../models/ServiceRequestRole/serviceRequestRoleModel').ServiceRequestRole[] }>({
      query: GET_ALL_ROLES_QUERY, fetchPolicy: 'network-only',
    });
    return data?.getAllServiceRequestRoles ?? [];
  } catch (err) { logError(err, 'serviceRequestRoleService.getAllServiceRequestRoles'); throw err; }
}

export async function getRoleConditions(roleId: string): Promise<import('../../models/ServiceRequestRole/serviceRequestRoleModel').RoleCondition[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getRoleConditions: import('../../models/ServiceRequestRole/serviceRequestRoleModel').RoleCondition[] }>({
      query: GET_ROLE_CONDITIONS_QUERY, variables: { roleId }, fetchPolicy: 'network-only',
    });
    return data?.getRoleConditions ?? [];
  } catch (err) { logError(err, 'serviceRequestRoleService.getRoleConditions'); throw err; }
}

export async function createServiceRequestRole(roleName: string, description: string, nlpCondition: string, conditionExpression: string, uploadedBy: string | undefined, nlpConditionInWords: string | undefined, lineOfBusiness: string[]): Promise<{ success: boolean; roleId: string | null; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ createServiceRequestRole: { success: boolean; roleId: string; message: string } }>({
      mutation: CREATE_ROLE_MUTATION, variables: { roleName, description, nlpCondition, conditionExpression, uploadedBy: uploadedBy ?? 'Admin', nlpConditionInWords: nlpConditionInWords ?? '', lineOfBusiness },
    });
    if (!data?.createServiceRequestRole) throw new Error('No data returned.');
    return data.createServiceRequestRole;
  } catch (err) { logError(err, 'serviceRequestRoleService.createServiceRequestRole'); throw err; }
}

export async function updateServiceRequestRole(roleId: string, roleName: string, description: string, status: string, nlpCondition: string, conditionExpression: string, nlpConditionInWords: string | undefined, lineOfBusiness: string[]): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ updateServiceRequestRole: { success: boolean; message: string } }>({
      mutation: UPDATE_ROLE_MUTATION, variables: { roleId, roleName, description, status, nlpCondition, conditionExpression, nlpConditionInWords: nlpConditionInWords ?? '', lineOfBusiness },
    });
    if (!data?.updateServiceRequestRole) throw new Error('No data returned.');
    return data.updateServiceRequestRole;
  } catch (err) { logError(err, 'serviceRequestRoleService.updateServiceRequestRole'); throw err; }
}

export async function deleteServiceRequestRole(roleId: string): Promise<{ success: boolean; message: string }> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ deleteServiceRequestRole: { success: boolean; message: string } }>({
      mutation: DELETE_ROLE_MUTATION, variables: { roleId },
    });
    if (!data?.deleteServiceRequestRole) throw new Error('No data returned.');
    return data.deleteServiceRequestRole;
  } catch (err) { logError(err, 'serviceRequestRoleService.deleteServiceRequestRole'); throw err; }
}

export async function getOperatorOptions(): Promise<import('../../models/ServiceRequestRole/serviceRequestRoleModel').RoleOperator[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getOperatorOptions: import('../../models/ServiceRequestRole/serviceRequestRoleModel').RoleOperator[] }>({
      query: GET_OPERATOR_OPTIONS_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getOperatorOptions ?? [];
  } catch (err) {
    logError(err, 'serviceRequestRoleService.getOperatorOptions');
    return [];
  }
}

export async function getFieldOptions(): Promise<string[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getFieldOptions: string[] }>({
      query: GET_FIELD_OPTIONS_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getFieldOptions ?? [];
  } catch (err) {
    logError(err, 'serviceRequestRoleService.getFieldOptions');
    return [];
  }
}

export async function getNlpFieldMappings(): Promise<NlpFieldMapping[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getNlpFieldMappings: NlpFieldMapping[] }>({
      query: GET_NLP_FIELD_MAPPINGS_QUERY,
      fetchPolicy: 'cache-first',
    });
    return data?.getNlpFieldMappings ?? [];
  } catch (err) {
    logError(err, 'serviceRequestRoleService.getNlpFieldMappings');
    return [];
  }
}
