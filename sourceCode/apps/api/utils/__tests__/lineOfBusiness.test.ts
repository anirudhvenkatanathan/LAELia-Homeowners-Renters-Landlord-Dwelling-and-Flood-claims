import { mapClaimTypeToLOB, LINE_OF_BUSINESS_OPTIONS } from '../lineOfBusiness';

describe('mapClaimTypeToLOB', () => {
  it('has exactly the five property lines', () => {
    expect([...LINE_OF_BUSINESS_OPTIONS]).toEqual(['Homeowners', 'Renters', 'Landlord', 'Dwelling', 'Flood']);
  });

  it.each([
    ['Homeowners', 'Homeowners'], ['homeowners', 'Homeowners'], ['HO3', 'Homeowners'], ['HO-5', 'Homeowners'],
    ['HO6', 'Homeowners'], ['Condo', 'Homeowners'],
    ['Renters', 'Renters'], ['HO4', 'Renters'], ['Renters Insurance', 'Renters'],
    ['Landlord', 'Landlord'], ['DF3-DL', 'Landlord'], ['Dwelling Landlord', 'Landlord'], ['Rental property', 'Landlord'],
    ['Dwelling', 'Dwelling'], ['DF1', 'Dwelling'], ['DF-1', 'Dwelling'], ['DF3-DO', 'Dwelling'], ['Dwelling Fire', 'Dwelling'],
    ['Flood', 'Flood'], ['SFIP', 'Flood'], ['NFIP flood', 'Flood'],
  ])('maps %s to %s', (input, expected) => {
    expect(mapClaimTypeToLOB(input)).toBe(expected);
  });

  it.each([[''], ['  '], [null], [undefined], ['WCM'], ['Workers compensation'], ['Auto'], ['General Liability']])(
    'returns null (no default LOB) for %p', (input) => {
      expect(mapClaimTypeToLOB(input as string | null | undefined)).toBeNull();
    });
});
