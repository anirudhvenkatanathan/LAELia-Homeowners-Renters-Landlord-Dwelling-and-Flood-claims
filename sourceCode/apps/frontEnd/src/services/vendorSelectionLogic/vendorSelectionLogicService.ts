import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type { VendorSelectionLogic, VendorSelectionLogicFormValues, VendorSelectionLogicMutationResponse } from '../../models/vendorSelectionLogic/vendorSelectionLogicModel';

const LOGIC_FIELDS = `
  ruleId name category description status conditions createdBy createdOn updatedBy updatedOn
`;

const GET_LOGIC_LIST = gql`
  query GetVendorSelectionLogicList {
    getVendorSelectionLogicList { ${LOGIC_FIELDS} }
  }
`;

const GET_LOGIC_DETAILS = gql`
  query GetVendorSelectionLogicDetails($ruleId: String!) {
    getVendorSelectionLogicDetails(ruleId: $ruleId) { ${LOGIC_FIELDS} }
  }
`;

const CREATE_LOGIC = gql`
  mutation CreateVendorSelectionLogic($input: VendorSelectionLogicInput!) {
    createVendorSelectionLogic(input: $input) { success message ruleId }
  }
`;

const UPDATE_LOGIC = gql`
  mutation UpdateVendorSelectionLogic($ruleId: String!, $input: VendorSelectionLogicInput!) {
    updateVendorSelectionLogic(ruleId: $ruleId, input: $input) { success message ruleId }
  }
`;

const DELETE_LOGIC = gql`
  mutation DeleteVendorSelectionLogic($ruleId: String!) {
    deleteVendorSelectionLogic(ruleId: $ruleId) { success message ruleId }
  }
`;

export async function getVendorSelectionLogicList(): Promise<VendorSelectionLogic[]> {
  try {
    const client = getApolloClient();
    const result = await client.query<{ getVendorSelectionLogicList: VendorSelectionLogic[] }>({
      query: GET_LOGIC_LIST,
      fetchPolicy: 'network-only',
    });
    return result.data.getVendorSelectionLogicList ?? [];
  } catch (err) {
    logError(err, 'vendorSelectionLogicService.getVendorSelectionLogicList');
    throw err;
  }
}

export async function getVendorSelectionLogicDetails(ruleId: string): Promise<VendorSelectionLogic | null> {
  try {
    const client = getApolloClient();
    const result = await client.query<{ getVendorSelectionLogicDetails: VendorSelectionLogic | null }>({
      query: GET_LOGIC_DETAILS,
      variables: { ruleId },
      fetchPolicy: 'network-only',
    });
    return result.data.getVendorSelectionLogicDetails ?? null;
  } catch (err) {
    logError(err, 'vendorSelectionLogicService.getVendorSelectionLogicDetails');
    throw err;
  }
}

export async function createVendorSelectionLogic(
  values: VendorSelectionLogicFormValues,
  user = 'Admin'
): Promise<VendorSelectionLogicMutationResponse> {
  try {
    const client = getApolloClient();
    const result = await client.mutate<{ createVendorSelectionLogic: VendorSelectionLogicMutationResponse }>({
      mutation: CREATE_LOGIC,
      variables: {
        input: {
          name:        values.name.trim(),
          category:    values.category.trim(),
          description: values.description.trim(),
          status:      values.status || 'Active',
          conditions:  values.conditions.trim(),
          user,
        },
      },
    });
    return result.data!.createVendorSelectionLogic;
  } catch (err) {
    logError(err, 'vendorSelectionLogicService.createVendorSelectionLogic');
    throw err;
  }
}

export async function updateVendorSelectionLogic(
  ruleId: string,
  values: VendorSelectionLogicFormValues,
  user = 'Admin'
): Promise<VendorSelectionLogicMutationResponse> {
  try {
    const client = getApolloClient();
    const result = await client.mutate<{ updateVendorSelectionLogic: VendorSelectionLogicMutationResponse }>({
      mutation: UPDATE_LOGIC,
      variables: {
        ruleId,
        input: {
          name:        values.name.trim(),
          category:    values.category.trim(),
          description: values.description.trim(),
          status:      values.status || 'Active',
          conditions:  values.conditions.trim(),
          user,
        },
      },
    });
    return result.data!.updateVendorSelectionLogic;
  } catch (err) {
    logError(err, 'vendorSelectionLogicService.updateVendorSelectionLogic');
    throw err;
  }
}

export async function deleteVendorSelectionLogic(ruleId: string): Promise<VendorSelectionLogicMutationResponse> {
  try {
    const client = getApolloClient();
    const result = await client.mutate<{ deleteVendorSelectionLogic: VendorSelectionLogicMutationResponse }>({
      mutation: DELETE_LOGIC,
      variables: { ruleId },
    });
    return result.data!.deleteVendorSelectionLogic;
  } catch (err) {
    logError(err, 'vendorSelectionLogicService.deleteVendorSelectionLogic');
    throw err;
  }
}
