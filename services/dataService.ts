
import { CommissionProfile, Manager, RepSettings, BetaMapping, SavedReportMetadata, FullReportSnapshot } from '../types';

export const saveConfiguration = async (
  profiles: CommissionProfile[],
  managers: Manager[],
  repSettings: RepSettings[],
  betaMappings: BetaMapping[] = [] 
): Promise<boolean> => {
  // Always save to LocalStorage as a cache/backup
  try {
    localStorage.setItem('commission_profiles', JSON.stringify(profiles));
    localStorage.setItem('managers', JSON.stringify(managers));
    localStorage.setItem('rep_settings', JSON.stringify(repSettings));
    localStorage.setItem('beta_mappings', JSON.stringify(betaMappings));
    console.log("Configuration cached to LocalStorage.");
  } catch (e) {
    console.warn("Failed to write to LocalStorage", e);
  }

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles, managers, repSettings, betaMappings })
    });

    if (!response.ok) {
      console.warn(`API Save Failed: ${response.status} ${response.statusText}`);
      // We already saved to LocalStorage above, so we just return false to indicate DB sync failed
      return false; 
    }

    console.log("Configuration saved successfully to database.");
    return true;
  } catch (error) {
    console.error("Failed to save configuration to API (Network Error), using LocalStorage cache:", error);
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
    // Try to load from API
    const response = await fetch('/api/config');
    
    if (response.ok) {
       const data = await response.json();
       // If API returns data, update LocalStorage cache to keep it in sync
       if (data.profiles) localStorage.setItem('commission_profiles', JSON.stringify(data.profiles));
       if (data.managers) localStorage.setItem('managers', JSON.stringify(data.managers));
       if (data.repSettings) localStorage.setItem('rep_settings', JSON.stringify(data.repSettings));
       if (data.betaMappings) localStorage.setItem('beta_mappings', JSON.stringify(data.betaMappings));

       return {
         profiles: data.profiles || null,
         managers: data.managers || null,
         repSettings: data.repSettings || null,
         betaMappings: data.betaMappings || null
       };
    } else {
       console.warn(`API not available (${response.status}), loading from LocalStorage`);
       throw new Error(response.statusText);
    }
  } catch (error) {
    console.log("Loading local configuration (Offline/Fallback Mode)");
    // Fallback to LocalStorage
    const p = localStorage.getItem('commission_profiles');
    const m = localStorage.getItem('managers');
    const r = localStorage.getItem('rep_settings');
    const b = localStorage.getItem('beta_mappings');

    return { 
       profiles: p ? JSON.parse(p) : null, 
       managers: m ? JSON.parse(m) : null, 
       repSettings: r ? JSON.parse(r) : null,
       betaMappings: b ? JSON.parse(b) : null
    };
  }
};

// --- Report Functions ---

export const fetchReportsList = async (): Promise<SavedReportMetadata[]> => {
  try {
    const response = await fetch('/api/reports');
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch reports list:", error);
    return [];
  }
};

export const fetchReportDetail = async (id: number): Promise<FullReportSnapshot | null> => {
  try {
    const response = await fetch(`/api/reports/${id}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch report detail:", error);
    return null;
  }
};

export const saveReport = async (year: number, month: number, snapshotData: FullReportSnapshot): Promise<boolean> => {
  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, snapshotData })
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to save report:", error);
    return false;
  }
};
