/**
 * Types for Company Research
 */

export interface SubQuestionAnswer {
  section: string;
  question: string;
  answer: string;
  source: string;
  confidence: "High" | "Medium" | "Low";
  raw_research?: string;
}

export interface CompanyResearchResult {
  company_name: string;
  generated_at: string;
  answers: SubQuestionAnswer[];
}

export type ResearchSection =
  | "GEOGRAPHICAL SCOPE"
  | "COMPANY SIZE"
  | "TYPE OF SERVICE PROVIDED";

export const RESEARCH_SECTIONS: ResearchSection[] = [
  "GEOGRAPHICAL SCOPE",
  "COMPANY SIZE",
  "TYPE OF SERVICE PROVIDED",
];

export const SECTION_LABELS: Record<ResearchSection, string> = {
  "GEOGRAPHICAL SCOPE": "Geographical Scope",
  "COMPANY SIZE": "Company Size",
  "TYPE OF SERVICE PROVIDED": "Service Type",
};

export const SECTION_DESCRIPTIONS: Record<ResearchSection, string> = {
  "GEOGRAPHICAL SCOPE":
    "The DSA applies to intermediary services offered to recipients in the EU, regardless of where the provider is established. We need to verify the company's connection to the European Union.",
  "COMPANY SIZE":
    "Certain DSA obligations are reduced or exempted for micro and small enterprises as defined in EU Recommendation 2003/361/EC. We need to determine the company's size classification.",
  "TYPE OF SERVICE PROVIDED":
    "The DSA establishes different tiers of obligations based on the type of intermediary service provided. We need to identify which category applies to this company.",
};

export const SECTION_INSTRUCTIONS: Record<ResearchSection, string> = {
  "GEOGRAPHICAL SCOPE":
    "Review each finding below. Accept if the information is correct, or edit to provide more accurate details about the company's EU presence.",
  "COMPANY SIZE":
    "Review the company size classification. Accept if correct, or edit with accurate employee count and revenue figures.",
  "TYPE OF SERVICE PROVIDED":
    "Review how we've classified the company's services. Accept if the categorization is correct, or edit to better describe the services offered.",
};
