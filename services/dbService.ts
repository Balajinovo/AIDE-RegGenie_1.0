
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { RegulationEntry, MonitoringReportLog } from '../types';
import { INITIAL_REGULATIONS } from '../constants';

let db: any = null;
let isInitialized = false;

const initDB = () => {
  if (isInitialized) return db;
  
  let configStr = process.env.firebase_config;
  if (!configStr) {
      configStr = localStorage.getItem('firebase_settings') || undefined;
  }
  
  if (configStr) {
    try {
      const cleanConfig = configStr.replace(/^['"]|['"]$/g, '');
      const config = JSON.parse(cleanConfig);
      const app = initializeApp(config);
      db = getFirestore(app);
      isInitialized = true;
      console.log("🔥 Firebase Firestore Initialized");
    } catch (e) {
      console.error("Failed to initialize Firebase from config", e);
    }
  } else {
    console.log("No Firebase config found. Using local storage/memory.");
  }
  return db;
};

// Generic Persistance Helper
const saveGeneric = async (collectionName: string, id: string, data: any) => {
    const database = initDB();
    
    // Always update local storage first as a safety
    try {
        const localKey = `local_${collectionName}`;
        const currentStr = localStorage.getItem(localKey);
        let current: any[] = currentStr ? JSON.parse(currentStr) : [];
        const index = current.findIndex(e => e.id === id);
        if (index >= 0) {
            current[index] = data;
        } else {
            current = [data, ...current];
        }
        localStorage.setItem(localKey, JSON.stringify(current));
    } catch (e) {
        console.error(`Local storage sync failed for ${collectionName}`, e);
    }

    if (!database) return;
    
    try {
        await setDoc(doc(database, collectionName, id), data);
    } catch (e) {
        console.error(`Error saving to Firestore ${collectionName}`, e);
    }
};

const getGeneric = async (collectionName: string, fallback: any[] = []): Promise<any[]> => {
    const database = initDB();
    const localKey = `local_${collectionName}`;
    
    if (!database) {
        const localData = localStorage.getItem(localKey);
        return localData ? JSON.parse(localData) : fallback;
    }

    try {
        const colRef = collection(database, collectionName);
        const snapshot = await getDocs(colRef);
        if (snapshot.empty) return fallback;
        return snapshot.docs.map(doc => doc.data());
    } catch (e) {
        const localData = localStorage.getItem(localKey);
        return localData ? JSON.parse(localData) : fallback;
    }
};

// Regulation Specifics
export const getAllRegulations = () => getGeneric('regulations', INITIAL_REGULATIONS);
export const saveRegulation = (entry: RegulationEntry) => saveGeneric('regulations', entry.id, entry);
export const updateRegulationInDb = (entry: RegulationEntry) => saveGeneric('regulations', entry.id, entry);

// Monitoring Report Specifics
export const saveMonitoringReport = (report: MonitoringReportLog) => saveGeneric('monitoring_reports', report.id, report);
export const getAllMonitoringReports = (): Promise<MonitoringReportLog[]> => getGeneric('monitoring_reports');
