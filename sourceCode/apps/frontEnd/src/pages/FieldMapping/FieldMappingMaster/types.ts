// Re-export all types and shared helpers from the model.
// No business logic belongs in this screen folder.
export type {
  UploadedFileRow,
  FieldMappingRecord,
  MappingConfiguration,
  FieldMappingDetails,
  UploadFieldMappingInput,
  UploadFieldMappingResponse,
  MappingInput,
  SaveMappingResponse,
  DownloadTemplateResponse,
  StatusBadgeVariant,
  DataTypeOption,
} from '../../../models/FieldMappingMaster/fieldMappingModel';

export {
  resolveStatusBadge,
  DATA_TYPE_OPTIONS,
} from '../../../models/FieldMappingMaster/fieldMappingModel';
