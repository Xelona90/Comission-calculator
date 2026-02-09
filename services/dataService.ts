
import { CommissionProfile, Manager, RepSettings, BetaMapping } from '../types';

// In a real application, replace these with actual API endpoints
// e.g., const API_URL = 'https://your-backend.com/api';

const STORAGE_KEYS = {
  PROFILES: 'commission_app_profiles',
  MANAGERS: 'commission_app_managers',
  REP_SETTINGS: 'commission_app_rep_settings',
  BETA_MAPPINGS: 'commission_app_beta_mappings'
};

export const saveConfiguration = async (
  profiles: CommissionProfile[],
  managers: Manager[],
  repSettings: RepSettings[],
  betaMappings: BetaMapping[] = [] // Added argument
): Promise<boolean> => {
  try {
    console.log("Saving to database...");
    
    // --- REAL API IMPLEMENTATION EXAMPLE ---
    /*
    await fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles, managers, repSettings, betaMappings })
    });
    */

    // --- LOCAL STORAGE MOCK IMPLEMENTATION ---
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEYS.MANAGERS, JSON.stringify(managers));
    localStorage.setItem(STORAGE_KEYS.REP_SETTINGS, JSON.stringify(repSettings));
    localStorage.setItem(STORAGE_KEYS.BETA_MAPPINGS, JSON.stringify(betaMappings));
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log("Saved successfully.");
    return true;
  } catch (error) {
    console.error("Failed to save configuration:", error);
    return false;
  }
};

export const loadConfiguration = async (): Promise<{
  profiles: CommissionProfile[] | null,
  managers: Manager[] | null,
  repSettings: RepSettings[] | null,
  betaMappings: BetaMapping[] | null
}> => {
  try {
    // --- REAL API IMPLEMENTATION EXAMPLE ---
    /*
    const response = await fetch('/api/get-config');
    const data = await response.json();
    return data; 
    */

    // --- LOCAL STORAGE MOCK IMPLEMENTATION ---
    const profilesStr = localStorage.getItem(STORAGE_KEYS.PROFILES);
    const managersStr = localStorage.getItem(STORAGE_KEYS.MANAGERS);
    const repSettingsStr = localStorage.getItem(STORAGE_KEYS.REP_SETTINGS);
    const betaMappingsStr = localStorage.getItem(STORAGE_KEYS.BETA_MAPPINGS);

    return {
      profiles: profilesStr ? JSON.parse(profilesStr) : null,
      managers: managersStr ? JSON.parse(managersStr) : null,
      repSettings: repSettingsStr ? JSON.parse(repSettingsStr) : null,
      betaMappings: betaMappingsStr ? JSON.parse(betaMappingsStr) : null
    };
  } catch (error) {
    console.error("Failed to load configuration:", error);
    return { profiles: null, managers: null, repSettings: null, betaMappings: null };
  }
};
