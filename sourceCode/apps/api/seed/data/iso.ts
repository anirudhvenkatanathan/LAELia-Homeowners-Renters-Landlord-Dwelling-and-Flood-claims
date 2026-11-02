// ISO ClaimSearch results seeded per claim, so the Claim Intelligence panel and the rule engine see the same facts.
// Each type maps to the rule flag(s) it sets (and so the services it triggers):
//   PropertyClaimClustering, SharedRepresentation, PropertyFrequencySpike, ClaimFrequency -> Desk investigations
//   CrossCarrierMatch  -> multiple_insurer_iso_hit_flag (Desk investigations)
//   PriorClaimsHistory -> prior_claim_history_flag (Desk investigations, Independent Adjusters)
//   ContractorUtilizationOutlier -> Estimate & Invoice Review, Deductible Waiver Review
export const ISO_FLAG_FIELDS: Record<string, string> = {
  PropertyClaimClustering: 'iso_property_claim_clustering_flag',
  SharedRepresentation: 'iso_shared_representation_flag',
  PropertyFrequencySpike: 'iso_property_frequency_spike_flag',
  ClaimFrequency: 'iso_claim_frequency_flag',
  CrossCarrierMatch: 'multiple_insurer_iso_hit_flag',
  PriorClaimsHistory: 'prior_claim_history_flag',
  ContractorUtilizationOutlier: 'iso_contractor_utilization_outlier_flag',
};

// key "<LOB>:<n>" -> ISO flag types (most significant first, at most two). Shared representation only where someone represents the insured.
export const ISO_CLAIMS: Record<string, string[]> = {
  'Homeowners:5': ['SharedRepresentation', 'PropertyClaimClustering'],
  'Homeowners:6': ['PriorClaimsHistory'],
  'Homeowners:7': ['SharedRepresentation'],
  'Homeowners:9': ['CrossCarrierMatch'],
  'Renters:6': ['ClaimFrequency'],
  'Renters:8': ['SharedRepresentation'],
  'Landlord:3': ['ContractorUtilizationOutlier'],
  'Landlord:6': ['SharedRepresentation'],
  'Landlord:11': ['ContractorUtilizationOutlier'],
  'Dwelling:5': ['SharedRepresentation', 'PropertyClaimClustering'],
  'Dwelling:6': ['ContractorUtilizationOutlier'],
  'Dwelling:9': ['PropertyFrequencySpike'],
  'Flood:4': ['CrossCarrierMatch'],
};
