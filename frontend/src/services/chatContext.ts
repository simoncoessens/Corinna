/**
 * Shared context-building logic for chat components.
 * Extracted from ChatPopup.tsx (the superset version).
 */

import type { ChatContext, ChatPhase } from "@/components/assessment/ChatPopup";

const phaseLabels: Record<ChatPhase, string> = {
  company_match: "Company Lookup",
  deep_research: "Deep Research in Progress",
  review_scope: "Reviewing Territorial scope",
  review_size: "Reviewing Company Size",
  review_type: "Reviewing Service Type",
  classify: "Service Classification",
  report: "Compliance Report",
};

export function buildContextString(context: ChatContext): string {
  const parts: string[] = [];

  parts.push(`Current Step: ${phaseLabels[context.phase]}`);

  if (context.visibleUi) {
    const ui = context.visibleUi;

    if (ui.app) {
      parts.push("\n--- Visible UI: App State ---");
      parts.push(`Current phase: ${ui.app.currentPhase}`);
      if (ui.app.researchStep)
        parts.push(`Research step: ${ui.app.researchStep}`);
      if (ui.app.isManualEntry !== undefined) {
        parts.push(`Manual entry mode: ${ui.app.isManualEntry ? "Yes" : "No"}`);
      }
      if (ui.app.completedPhases && ui.app.completedPhases.length > 0) {
        parts.push(`Completed phases: ${ui.app.completedPhases.join(", ")}`);
      }
    }

    if (ui.companyLookup) {
      parts.push("\n--- Visible UI: Company Lookup ---");
      parts.push(`Screen state: ${ui.companyLookup.state}`);
      if (ui.companyLookup.organizationName !== undefined) {
        parts.push(
          `Organization name input: ${ui.companyLookup.organizationName}`
        );
      }
      if (ui.companyLookup.countryOfEstablishment !== undefined) {
        parts.push(
          `Country of establishment input: ${ui.companyLookup.countryOfEstablishment}`
        );
      }
      if (ui.companyLookup.error) {
        parts.push(`Error: ${ui.companyLookup.error}`);
      }
      if (ui.companyLookup.totalSourceCount !== undefined) {
        parts.push(
          `Sources analyzed (visible): ${ui.companyLookup.totalSourceCount}`
        );
      }
      if (
        ui.companyLookup.visibleSources &&
        ui.companyLookup.visibleSources.length > 0
      ) {
        parts.push("Visible sources:");
        ui.companyLookup.visibleSources.forEach((s) =>
          parts.push(`- ${s.title ? `${s.title} — ` : ""}${s.url}`)
        );
      }
      if (ui.companyLookup.results) {
        parts.push("Visible results:");
        if (ui.companyLookup.results.exact_match) {
          const m = ui.companyLookup.results.exact_match;
          parts.push(
            `- Exact match: ${m.name} (${m.top_domain || "no domain"}) [${
              m.confidence
            }]`
          );
        }
        if (
          ui.companyLookup.results.suggestions &&
          ui.companyLookup.results.suggestions.length > 0
        ) {
          ui.companyLookup.results.suggestions.forEach((s) =>
            parts.push(
              `- Suggestion: ${s.name} (${s.top_domain || "no domain"}) [${
                s.confidence
              }]`
            )
          );
        }
        if (ui.companyLookup.results.selectedCompanyName) {
          parts.push(
            `Selected in UI: ${ui.companyLookup.results.selectedCompanyName}`
          );
        }
      }
    }

    if (ui.deepResearch) {
      parts.push("\n--- Visible UI: Deep Research ---");
      parts.push(`Company: ${ui.deepResearch.companyName}`);
      parts.push(`Phase: ${ui.deepResearch.phase}`);
      parts.push(`Sources analyzed: ${ui.deepResearch.totalSourceCount}`);
      if (ui.deepResearch.visibleSources.length > 0) {
        parts.push("Visible sources:");
        ui.deepResearch.visibleSources.forEach((s) =>
          parts.push(`- ${s.title ? `${s.title} — ` : ""}${s.url}`)
        );
      }
    }

    if (ui.review) {
      parts.push("\n--- Visible UI: Review Findings ---");
      parts.push(`Section: ${ui.review.section}`);
      parts.push(
        `Progress: ${ui.review.currentStep} / ${ui.review.totalSteps}`
      );
      parts.push(
        `Confirmed: ${ui.review.acceptedCount} / ${ui.review.totalFindings} (allAccepted=${ui.review.allAccepted})`
      );
      if (ui.review.editingIndex !== null) {
        parts.push(`Editing index: ${ui.review.editingIndex}`);
        parts.push(`Editing value: ${ui.review.editValue}`);
      }
      parts.push("Visible findings:");
      ui.review.findings.forEach((f) => {
        const flags = [
          f.accepted ? "accepted" : "not accepted",
          f.edited ? "edited" : "not edited",
        ].join(", ");
        parts.push(`Q: ${f.question}`);
        parts.push(`A: ${f.answer}`);
        parts.push(
          `Source: ${f.source} · Confidence: ${f.confidence} · ${flags}`
        );
      });
    }

    if (ui.manualEntry) {
      parts.push("\n--- Visible UI: Manual Data Entry ---");
      parts.push(`Section: ${ui.manualEntry.section}`);
      parts.push(
        `Progress: ${ui.manualEntry.currentStep} / ${ui.manualEntry.totalSteps}`
      );
      parts.push(
        `Answered: ${ui.manualEntry.filledCount} / ${ui.manualEntry.totalQuestions} (allFilled=${ui.manualEntry.allFilled})`
      );
      parts.push("Visible fields:");
      ui.manualEntry.fields.forEach((f) => {
        parts.push(`Q: ${f.question}`);
        parts.push(`A: ${f.answer}`);
      });
    }

    if (ui.classification) {
      parts.push("\n--- Visible UI: Service Classification ---");
      parts.push(`Stage: ${ui.classification.stage}`);
      parts.push(
        `Processing: ${ui.classification.isProcessing ? "Yes" : "No"}`
      );
      if (
        ui.classification.expandedSections &&
        ui.classification.expandedSections.length > 0
      ) {
        parts.push(
          `Expanded sections: ${ui.classification.expandedSections.join(", ")}`
        );
      }
      if (ui.classification.streamedText) {
        parts.push("Streamed text (tail):");
        parts.push(ui.classification.streamedText);
      }
      if (ui.classification.classificationSummary) {
        parts.push(`Summary: ${ui.classification.classificationSummary}`);
      }
      if (ui.classification.classification) {
        const c = ui.classification.classification;
        if (c.territorial) {
          parts.push(
            `Territorial scope: ${
              c.territorial.in_scope ? "In scope" : "Out of scope"
            }`
          );
        }
        if (c.service) {
          parts.push(`Service category: ${c.service.service_category}`);
          parts.push(
            `Flags: intermediary=${c.service.is_intermediary}, platform=${c.service.is_online_platform}, marketplace=${c.service.is_marketplace}, search=${c.service.is_search_engine}`
          );
        }
        if (c.size) {
          parts.push(
            `Size: vlop=${c.size.is_vlop_vlose}, sme_exemption=${
              c.size.qualifies_for_sme_exemption ?? "unknown"
            }`
          );
        }
      }
    }

    if (ui.report) {
      parts.push("\n--- Visible UI: Compliance Report ---");
      parts.push(`Active tab: ${ui.report.activeTab}`);
      if (ui.report.obligationsFilter) {
        parts.push(`Obligations filter: ${ui.report.obligationsFilter}`);
      }
      if (ui.report.selectedObligation) {
        const o = ui.report.selectedObligation;
        parts.push(`Selected obligation: Article ${o.article} — ${o.title}`);
        parts.push(`Applies: ${o.applies ? "Yes" : "No"}`);
        parts.push(`Implications: ${o.implications}`);
        if (o.action_items?.length) {
          parts.push("Action items:");
          o.action_items.forEach((a) => parts.push(`- ${a}`));
        }
      }
      if (
        ui.report.visibleObligations &&
        ui.report.visibleObligations.length > 0
      ) {
        parts.push("Visible obligations list:");
        ui.report.visibleObligations.forEach((o) =>
          parts.push(
            `- Article ${o.article}: ${o.title} (applies=${o.applies}, action_items=${o.action_items_count})`
          )
        );
      }
    }
  }

  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
    if (context.companyUrl) {
      parts.push(`Website: ${context.companyUrl}`);
    }
  }

  if (context.researchData) {
    const { geographicalScope, companySize, serviceType } =
      context.researchData;

    if (geographicalScope && geographicalScope.length > 0) {
      parts.push("\n--- Territorial scope Findings ---");
      geographicalScope.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }

    if (companySize && companySize.length > 0) {
      parts.push("\n--- Company Size Findings ---");
      companySize.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }

    if (serviceType && serviceType.length > 0) {
      parts.push("\n--- Service Type Findings ---");
      serviceType.forEach((item) => {
        parts.push(`Q: ${item.question}`);
        parts.push(`A: ${item.answer} (${item.confidence} confidence)`);
      });
    }
  }

  if (context.classificationData) {
    const c = context.classificationData;
    parts.push("\n--- DSA Classification ---");
    if (c.serviceCategory) {
      parts.push(`Service Category: ${c.serviceCategory}`);
    }
    if (c.isIntermediary !== undefined) {
      parts.push(`Is Intermediary Service: ${c.isIntermediary ? "Yes" : "No"}`);
    }
    if (c.isOnlinePlatform !== undefined) {
      parts.push(`Is Online Platform: ${c.isOnlinePlatform ? "Yes" : "No"}`);
    }
    if (c.isMarketplace !== undefined) {
      parts.push(`Is Marketplace: ${c.isMarketplace ? "Yes" : "No"}`);
    }
    if (c.isSearchEngine !== undefined) {
      parts.push(`Is Search Engine: ${c.isSearchEngine ? "Yes" : "No"}`);
    }
    if (c.isVLOP !== undefined) {
      parts.push(`Is VLOP/VLOSE: ${c.isVLOP ? "Yes" : "No"}`);
    }
    if (c.smeExemption !== undefined) {
      parts.push(
        `SME Exemption: ${c.smeExemption ? "Eligible" : "Not Eligible"}`
      );
    }
  }

  if (context.complianceData) {
    const comp = context.complianceData;
    parts.push("\n--- Compliance Summary ---");
    if (
      comp.applicableObligations !== undefined &&
      comp.totalObligations !== undefined
    ) {
      parts.push(
        `Applicable Obligations: ${comp.applicableObligations} out of ${comp.totalObligations}`
      );
    }
    if (comp.summary) {
      parts.push(`Summary: ${comp.summary}`);
    }
  }

  return parts.join("\n");
}
