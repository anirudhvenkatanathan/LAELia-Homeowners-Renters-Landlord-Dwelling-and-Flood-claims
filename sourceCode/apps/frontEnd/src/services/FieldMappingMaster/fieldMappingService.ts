import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type {
  UploadFieldMappingResponse,
  UploadedFileRow,
  FieldMappingDetails,
  MappingInput,
  SaveMappingResponse,
  DownloadTemplateResponse,
} from '../../models/FieldMappingMaster/fieldMappingModel';

// ─── GraphQL Operations ───────────────────────────────────────────────────────

const UPLOAD_FIELD_MAPPING_MUTATION = gql`
  mutation UploadFieldMappingFile(
    $excelBase64: String!
    $fileName:    String
    $uploadedBy:  String
  ) {
    uploadFieldMappingFile(
      excelBase64: $excelBase64
      fileName:    $fileName
      uploadedBy:  $uploadedBy
    ) {
      uploadId
      totalRecords
      status
      message
      success
    }
  }
`;

const GET_UPLOADED_FILES_QUERY = gql`
  query GetUploadedFiles {
    getUploadedFiles {
      uploadId
      fileName
      uploadType
      totalRecords
      uploadedBy
      uploadDate
      status
    }
  }
`;

const GET_FIELD_MAPPING_DETAILS_QUERY = gql`
  query GetFieldMappingDetails($uploadId: String!) {
    getFieldMappingDetails(uploadId: $uploadId) {
      uploadId
      fileName
      uploadType
      totalRecords
      uploadedBy
      uploadDate
      status
      headers
      records {
        recordIndex
        recordData
      }
      mappings {
        mappingId
        uploadId
        sourceField
        targetField
        dataType
        isMandatory
        sortOrder
      }
    }
  }
`;

const SAVE_FIELD_MAPPING_MUTATION = gql`
  mutation SaveFieldMapping($uploadId: String!, $mappings: [MappingInput!]!) {
    saveFieldMapping(uploadId: $uploadId, mappings: $mappings) {
      success
      message
      savedCount
    }
  }
`;

const DOWNLOAD_TEMPLATE_MUTATION = gql`
  mutation DownloadTemplate($uploadId: String) {
    downloadTemplate(uploadId: $uploadId) {
      success
      base64
      fileName
      message
    }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function uploadFieldMappingFile(
  excelBase64: string,
  fileName?: string,
  uploadedBy?: string
): Promise<UploadFieldMappingResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ uploadFieldMappingFile: UploadFieldMappingResponse }>({
      mutation: UPLOAD_FIELD_MAPPING_MUTATION,
      variables: {
        excelBase64,
        fileName:   fileName   ?? null,
        uploadedBy: uploadedBy ?? 'Admin',
      },
    });
    if (!data?.uploadFieldMappingFile) throw new Error('No data returned from uploadFieldMappingFile.');
    return data.uploadFieldMappingFile;
  } catch (err) {
    logError(err, 'fieldMappingService.uploadFieldMappingFile');
    throw err;
  }
}

export async function getUploadedFiles(): Promise<UploadedFileRow[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getUploadedFiles: UploadedFileRow[] }>({
      query: GET_UPLOADED_FILES_QUERY,
      fetchPolicy: 'network-only',
    });
    return data?.getUploadedFiles ?? [];
  } catch (err) {
    logError(err, 'fieldMappingService.getUploadedFiles');
    throw err;
  }
}

export async function getFieldMappingDetails(uploadId: string): Promise<FieldMappingDetails> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getFieldMappingDetails: FieldMappingDetails }>({
      query: GET_FIELD_MAPPING_DETAILS_QUERY,
      variables: { uploadId },
      fetchPolicy: 'network-only',
    });
    if (!data?.getFieldMappingDetails) throw new Error(`No details found for uploadId: ${uploadId}`);
    return data.getFieldMappingDetails;
  } catch (err) {
    logError(err, 'fieldMappingService.getFieldMappingDetails');
    throw err;
  }
}

export async function saveFieldMapping(
  uploadId: string,
  mappings: MappingInput[]
): Promise<SaveMappingResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ saveFieldMapping: SaveMappingResponse }>({
      mutation: SAVE_FIELD_MAPPING_MUTATION,
      variables: { uploadId, mappings },
    });
    if (!data?.saveFieldMapping) throw new Error('No data returned from saveFieldMapping.');
    return data.saveFieldMapping;
  } catch (err) {
    logError(err, 'fieldMappingService.saveFieldMapping');
    throw err;
  }
}

export async function downloadTemplate(uploadId?: string): Promise<DownloadTemplateResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ downloadTemplate: DownloadTemplateResponse }>({
      mutation: DOWNLOAD_TEMPLATE_MUTATION,
      variables: { uploadId: uploadId ?? null },
    });
    if (!data?.downloadTemplate) throw new Error('No data returned from downloadTemplate.');
    return data.downloadTemplate;
  } catch (err) {
    logError(err, 'fieldMappingService.downloadTemplate');
    throw err;
  }
}
