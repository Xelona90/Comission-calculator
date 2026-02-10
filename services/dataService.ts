
import { CommissionProfile, Manager, RepSettings, BetaMapping } from '../types';

export const saveConfiguration = async (
  profiles: CommissionProfile[],
  managers: Manager[],
  repSettings: RepSettings[],
  betaMappings: BetaMapping[] = [] 
): Promise<boolean> => {
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles, managers, repSettings, betaMappings })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    console.log("Configuration saved successfully to database.");
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
    const response = await fetch('/api/config');
    
    if (!response.ok) {
      // If server is not ready or returns 404/500, fallback or throw
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      profiles: data.profiles || null,
      managers: data.managers || null,
      repSettings: data.repSettings || null,
      betaMappings: data.betaMappings || null
    };
  } catch (error) {
    console.error("Failed to load configuration from API:", error);
    return { profiles: null, managers: null, repSettings: null, betaMappings: null };
  }
};
