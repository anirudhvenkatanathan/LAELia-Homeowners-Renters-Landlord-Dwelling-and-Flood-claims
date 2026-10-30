export interface VendorSelectionLogic {
  ruleId:      string;
  name:        string;
  category:    string;
  description: string;
  status:      string;
  conditions:  string;
  createdBy:   string;
  createdOn:   string;
  updatedBy:   string;
  updatedOn:   string;
}

export interface VendorSelectionLogicFormValues {
  name:        string;
  category:    string;
  description: string;
  status:      string;
  conditions:  string;
}

export const EMPTY_FORM: VendorSelectionLogicFormValues = {
  name:        '',
  category:    '',
  description: '',
  status:      'Active',
  conditions:  '',
};

export interface VendorSelectionLogicMutationResponse {
  success: boolean;
  message: string;
  ruleId:  string | null;
}

export type FormMode = 'create' | 'edit' | 'view';
