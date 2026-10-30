import { gql } from '@apollo/client';
import { getApolloClient } from '../../config/apolloClient';
import { logError } from '../../utils/logError';
import type { Vendor, VendorFormValues, VendorMutationResponse } from '../../models/vendor/vendorModel';

// ─── Fragments / Queries ──────────────────────────────────────────────────────

const VENDOR_FIELDS = `
  vendorId companyName emailId rating address city state country coverage
  status vendorSource requalDue phoneNumber turnaroundTime serviceRequestRoleId serviceRequestRoleName serviceRequestRoleNames
  createdBy createdAt uploadedBy uploadedAt boostApplied
`;

const GET_VENDORS_QUERY = gql`
  query GetVendors { getVendors { ${VENDOR_FIELDS} } }
`;

const GET_VENDOR_BY_ID_QUERY = gql`
  query GetVendorById($vendorId: String!) {
    getVendorById(vendorId: $vendorId) { ${VENDOR_FIELDS} }
  }
`;

const CREATE_VENDOR_MUTATION = gql`
  mutation CreateVendor($input: VendorInput!) {
    createVendor(input: $input) { success message vendorId }
  }
`;

const UPDATE_VENDOR_MUTATION = gql`
  mutation UpdateVendor($vendorId: String!, $input: VendorInput!) {
    updateVendor(vendorId: $vendorId, input: $input) { success message vendorId }
  }
`;

const DELETE_VENDOR_MUTATION = gql`
  mutation DeleteVendor($vendorId: String!) {
    deleteVendor(vendorId: $vendorId) { success message }
  }
`;

// ─── Service Functions ────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getVendors: Vendor[] }>({
      query: GET_VENDORS_QUERY, fetchPolicy: 'network-only',
    });
    return data?.getVendors ?? [];
  } catch (err) { logError(err, 'vendorService.getVendors'); throw err; }
}

export async function getVendorById(vendorId: string): Promise<Vendor> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getVendorById: Vendor }>({
      query: GET_VENDOR_BY_ID_QUERY, variables: { vendorId }, fetchPolicy: 'network-only',
    });
    if (!data?.getVendorById) throw new Error('Vendor not found');
    return data.getVendorById;
  } catch (err) { logError(err, 'vendorService.getVendorById'); throw err; }
}

function toInput(values: VendorFormValues) {
  return {
    companyName:          values.companyName,
    emailId:              values.emailId,
    phoneNumber:          values.phoneNumber,
    serviceRequestRoleId: values.serviceRequestRoleId,
    rating:               values.rating ? parseFloat(values.rating) : 0,
    address:              values.address,
    city:                 values.city,
    state:                values.state,
    country:              values.country,
    turnaroundTime:       values.turnaroundTime,
    createdBy:            'admin',
    uploadedBy:           'admin',
  };
}

export async function createVendor(values: VendorFormValues): Promise<VendorMutationResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ createVendor: VendorMutationResponse }>({
      mutation: CREATE_VENDOR_MUTATION, variables: { input: toInput(values) },
    });
    if (!data?.createVendor) throw new Error('No response');
    return data.createVendor;
  } catch (err) { logError(err, 'vendorService.createVendor'); throw err; }
}

export async function updateVendor(vendorId: string, values: VendorFormValues): Promise<VendorMutationResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ updateVendor: VendorMutationResponse }>({
      mutation: UPDATE_VENDOR_MUTATION, variables: { vendorId, input: toInput(values) },
    });
    if (!data?.updateVendor) throw new Error('No response');
    return data.updateVendor;
  } catch (err) { logError(err, 'vendorService.updateVendor'); throw err; }
}

export async function deleteVendor(vendorId: string): Promise<VendorMutationResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ deleteVendor: VendorMutationResponse }>({
      mutation: DELETE_VENDOR_MUTATION, variables: { vendorId },
    });
    if (!data?.deleteVendor) throw new Error('No response');
    return data.deleteVendor;
  } catch (err) { logError(err, 'vendorService.deleteVendor'); throw err; }
}

const GET_VENDOR_PANEL_QUERY = gql`
  query GetVendorPanelVendors { getVendorPanelVendors { ${VENDOR_FIELDS} } }
`;

const ACTIVATE_VENDOR_MUTATION = gql`
  mutation ActivateVendorFromPanel($vendorId: String!, $performedBy: String) {
    activateVendorFromPanel(vendorId: $vendorId, performedBy: $performedBy) { success message vendorId }
  }
`;

export async function getVendorPanelVendors(): Promise<Vendor[]> {
  try {
    const client = getApolloClient();
    const { data } = await client.query<{ getVendorPanelVendors: Vendor[] }>({
      query: GET_VENDOR_PANEL_QUERY, fetchPolicy: 'network-only',
    });
    return data?.getVendorPanelVendors ?? [];
  } catch (err) { logError(err, 'vendorService.getVendorPanelVendors'); throw err; }
}

export async function activateVendorFromPanel(vendorId: string, performedBy?: string): Promise<VendorMutationResponse> {
  try {
    const client = getApolloClient();
    const { data } = await client.mutate<{ activateVendorFromPanel: VendorMutationResponse }>({
      mutation: ACTIVATE_VENDOR_MUTATION, variables: { vendorId, performedBy },
    });
    if (!data?.activateVendorFromPanel) throw new Error('No response');
    return data.activateVendorFromPanel;
  } catch (err) { logError(err, 'vendorService.activateVendorFromPanel'); throw err; }
}
