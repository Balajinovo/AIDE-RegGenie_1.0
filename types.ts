
export enum Category {
  ClinicalResearch = 'Clinical Research & Trials',
  Manufacturing = 'Manufacturing & Quality Systems',
  Pharmacovigilance = 'Pharmacovigilance & Drug Safety',
  RegulatorySubmissions = 'Regulatory Submissions & Compliance',
  MedicalDevices = 'Medical Devices & Diagnostics',
  Biologics = 'Biotechnology, Biologics & Biosimilars',
  DataIntegrity = 'Data Integrity & Electronic Records',
  QualityAssurance = 'Quality Assurance & Risk Management',
  Advertising = 'Advertising, Promotion & Labeling',
  DrugDevelopment = 'Drug Development & Regulatory Science',
  ControlledSubstances = 'Controlled Substances & Safety Controls',
  MarketAccess = 'Health Technology Assessment & Market Access',
  Privacy = 'Privacy, Security & Compliance',
  Environmental = 'Environmental, Occupational & Facility Regulations',
  SupplyChain = 'Supply Chain, Import/Export & Logistics'
}

export enum Region {
  US = 'United States (FDA)',
  EU = 'European Union (EMA)',
  APAC = 'Asia Pacific',
  Global = 'Global (ICH/WHO)',
  UK = 'United Kingdom (MHRA)'
}

export enum ImpactLevel {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
  Unknown = 'Unknown'
}

export enum FunctionalGroup {
  ClinicalOperations = 'Clinical Operations',
  RegulatoryAffairs = 'Regulatory Affairs',
  QualityAssurance = 'Quality Assurance',
  Pharmacovigilance = 'Pharmacovigilance',
  Other = 'Other Functions'
}

export enum TranslationDocType {
  EssentialDocuments = 'Essential Documents',
  RegulatorySubmissions = 'IRB/EC/Regulatory Submissions',
  PatientFacing = 'Patient Facing Materials',
  ProtocolTechnical = 'Protocol and Other Technical Documents',
  Communication = 'Communication'
}

export enum TranslationDimension {
  PatientCentric = 'Patient Centric',
  RegulatoryFocused = 'Regulatory Focused',
  MedicalAccuracy = 'Medical Accuracy',
  LegalAspects = 'Legal Aspects'
}

export type PageRange = '1-10' | '10-50' | '50-100' | '100-500';
export type PageSize = 'A2' | 'A3' | 'A4';

export enum MQMSeverity {
  Minor = 'Minor',
  Major = 'Major',
  Critical = 'Critical'
}

export enum MQMType {
  Terminology = 'Terminology',
  Accuracy = 'Accuracy',
  Fluency = 'Fluency',
  Style = 'Style'
}

export interface CorrectionRationale {
  originalText: string;
  updatedText: string;
  rationale: string;
  timestamp: number;
  pageIndex: number;
  wordIndex: number;
  mqmSeverity: MQMSeverity;
  mqmType: MQMType;
}

export interface TranslationLog {
  id: string;
  trackingId: string;
  functionalGroup: FunctionalGroup;
  docType: TranslationDocType;
  dimension?: TranslationDimension;
  culturalNuances?: boolean;
  pageRange?: PageRange;
  projectNumber: string;
  timestamp: number;
  sourceLanguage: string;
  targetLanguage: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  mode: string;
  provider: string;
  qualityScore?: number; // Calculated MQM Yield (0-100)
  mqmErrorScore?: number; // Weighted error total
  status: 'Draft' | 'QC Pending' | 'QC Finalized' | 'Downloaded';
  humanCorrectionVolume?: number;
  qcTimeSpentSeconds: number; 
  workflowTimeCodes: Array<{ event: string; timestamp: number }>;
  estimatedCost?: number;
  rationales?: CorrectionRationale[];
  backTranslation?: string[];
  qcReviewerName?: string;
  certifiedAt?: number;
}

export interface RegulationEntry {
  id: string;
  trackingId: string;
  title: string;
  agency: string;
  region: Region;
  country: string; 
  date: string;
  effectiveDate?: string;
  category: Category;
  summary: string;
  impact: ImpactLevel;
  status: 'Draft' | 'Final' | 'Consultation';
  content: string; 
  url?: string; 
  riskLevel?: string;
  riskRationale?: string;
  adminApproved?: boolean;
  lastChecked?: number;
  isNew?: boolean;
}

export interface MonitoringReportLog {
  id: string;
  projectNumber: string;
  sponsor: string;
  visitDate: string;
  visitNumber: string;
  visitType: string;
  contentHtml: string;
  rawNotes: string;
  audit: {
    explainability: string;
    traceability: string;
    modelAccuracy: number;
    timestamp: number;
  };
}

export type AppTab = 'translation' | 'translation-metrics' | 'monitoring-report' | 'chat' | 'dose-management' | 'agentic-monitoring' | 'competency-dashboard';

export interface AnalysisResult {
  summary: string;
  complianceRisk: string;
  operationalImpact: string;
  actionItems: string[];
}

export interface NewsItem {
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
}

export interface TMFDocument {
  zone: string;
  documentName: string;
  description: string;
  mandatory: boolean;
  localRequirement?: string;
}

export interface GapAnalysisResult {
  complianceScore: number;
  executiveSummary: string;
  missingElements: {
    requirement: string;
    gap: string;
    severity: 'High' | 'Medium' | 'Low';
  }[];
  remediationPlan: {
    action: string;
    priority: 'High' | 'Medium' | 'Low';
    suggestedText?: string;
  }[];
}

export interface DatabaseFilters {
  status?: string[];
  impact?: string[];
  category?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingMetadata?: any;
}

export interface GenieFeedback {
  id: string;
  rating: number;
  comment: string;
  timestamp: number;
  querySnippet?: string;
  topic?: string;
  responseSnippet?: string;
}

export type SubTab = 'gemini' | 'chatgpt' | 'copilot';
