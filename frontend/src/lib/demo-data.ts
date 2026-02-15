/**
 * Hardcoded demo data for Aruba S.p.A. DSA compliance assessment.
 * This data drives the fake API routes for the standalone demo.
 */

import type {
  CompanyMatchResult,
  CompanyResearchResult,
  ComplianceReport,
  SearchSource,
} from "@/types/api";

// =============================================================================
// Company Matcher Data
// =============================================================================

export const COMPANY_MATCH_SOURCES: SearchSource[] = [
  { title: "Aruba S.p.A. | LinkedIn", url: "https://www.linkedin.com/company/aruba-spa" },
  { title: "Aruba S.p.A. - Sito Ufficiale", url: "https://www.aruba.it/about-us.aspx" },
  { title: "Aruba S.p.A. Leadership", url: "https://www.linkedin.com/company/aruba-spa/people" },
  { title: "Tecnopolo Tiburtino - Aruba Data Center", url: "https://www.tecnopolo.it/aruba" },
  { title: "Aruba Cloud Services", url: "https://www.aruba.it/cloud" },
  { title: "Aruba S.p.A. - Wikipedia", url: "https://en.wikipedia.org/wiki/Aruba_S.p.A." },
  { title: "Aruba PEC - Certified Email", url: "https://www.aruba.it/pec.aspx" },
  { title: "Aruba Domain Registration", url: "https://www.aruba.it/domini.aspx" },
];

export const COMPANY_MATCH_RESULT: CompanyMatchResult = {
  input_name: "Aruba s.p.a",
  exact_match: {
    name: "Aruba S.p.A.",
    top_domain: "aruba.it",
    confidence: "exact",
    summary_short: "Italian company providing cloud services, data centers, web hosting, email, and domain registration.",
    summary_long:
      "Aruba S.p.A. is an Italian company founded in 1994 that is one of Europe's primary providers of cloud services, data centers, web hosting, email services, domain registration services and PEC certified email. The company manages over 2.7 million registered domains and has 16 million users across its infrastructure.",
  },
  suggestions: [],
};

// =============================================================================
// Deep Research Data
// =============================================================================

export const RESEARCH_SOURCES: SearchSource[] = Array.from({ length: 278 }, (_, i) => ({
  title: `Research Source ${i + 1}`,
  url: `https://source-${i + 1}.example.com/aruba-research`,
}));

// Overwrite first ~30 with realistic sources
const REALISTIC_RESEARCH_SOURCES: SearchSource[] = [
  { title: "Aruba S.p.A. Company Profile - Creditsafe", url: "https://www.creditsafe.com/it/aruba-spa" },
  { title: "Aruba Cloud Hosting Plans", url: "https://hosting.aruba.it/cloud-hosting.aspx" },
  { title: "Aruba Customer Support", url: "https://assistenza.aruba.it" },
  { title: "Aruba User Guides", url: "https://guide.aruba.it" },
  { title: "TechRadar - Aruba Hosting Review", url: "https://www.techradar.com/web-hosting/aruba-hosting-review" },
  { title: "Aruba e-Billing", url: "https://www.aruba.it/e-billing.aspx" },
  { title: "Aruba Pratiche.it", url: "https://www.pratiche.it" },
  { title: "Aruba Domain Services", url: "https://www.aruba.it/domini.aspx" },
  { title: "EU Geo-blocking Regulation", url: "https://www.europe-consommateurs.eu/en/geo-blocking" },
  { title: "Aruba PEC - App Store", url: "https://apps.apple.com/app/aruba-pec/id123456" },
  { title: "Aruba LinkedIn Company Page", url: "https://www.linkedin.com/company/aruba-spa" },
  { title: "Aruba Financial Data - Aziende.it", url: "https://www.aziende.it/aruba-spa" },
  { title: "Aruba HiSpeed Cache", url: "https://hosting.aruba.it/hispeed-cache.aspx" },
  { title: "Aruba Business Guide", url: "https://guide.arubabusiness.it" },
  { title: "Aruba DSA Transparency Report", url: "https://www.aruba.it/dsa-transparency.aspx" },
  { title: "Aruba Cloud Services Overview", url: "https://www.aruba.it/cloud" },
  { title: "Aruba Data Centers", url: "https://www.aruba.it/data-center.aspx" },
  { title: "Aruba PEC Services", url: "https://www.aruba.it/pec.aspx" },
  { title: "Aruba Enterprise Solutions", url: "https://www.aruba.it/enterprise.aspx" },
  { title: "URLERT - Aruba Service Analysis", url: "https://urlert.com/aruba.it" },
  { title: "Aruba Business Mobile App", url: "https://play.google.com/store/apps/details?id=it.aruba.business" },
  { title: "Aruba Mail App", url: "https://apps.apple.com/app/aruba-mail/id789012" },
  { title: "Aruba E-Commerce Tools", url: "https://hosting.aruba.it/ecommerce.aspx" },
  { title: "Aruba.it - Wikipedia Italia", url: "https://it.wikipedia.org/wiki/Aruba_S.p.A." },
  { title: "Aruba Certification Services", url: "https://www.aruba.it/firma-digitale.aspx" },
  { title: "Aruba Cloud VPS", url: "https://www.cloud.it/vps.aspx" },
  { title: "Aruba Global Cloud Data Center", url: "https://www.arubacloud.com/data-centers.aspx" },
  { title: "Aruba Register .cloud TLD", url: "https://www.aruba.it/cloud-registry.aspx" },
  { title: "Aruba Annual Report 2023", url: "https://www.aruba.it/annual-report-2023.aspx" },
  { title: "Aruba S.p.A. Sede Legale", url: "https://www.aruba.it/sede-legale.aspx" },
];

for (let i = 0; i < REALISTIC_RESEARCH_SOURCES.length; i++) {
  RESEARCH_SOURCES[i] = REALISTIC_RESEARCH_SOURCES[i];
}

export const RESEARCH_RESULT: CompanyResearchResult = {
  company_name: "Aruba S.p.A.",
  answers: [
    // GEOGRAPHICAL SCOPE
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "In which country is the service provider's main establishment or registered office located?",
      answer: "Aruba S.p.A.'s main establishment and registered office is located at Via San Clemente 53, Ponte San Pietro, Lombardy 24036, Italy.",
      information_found: true,
      source: "Creditsafe",
      confidence: "High",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "What is the estimated number of monthly active users of the service in the European Union?",
      answer: "No Information Found\n\nOur research could not find publicly available information for this question. Please provide the information manually.",
      information_found: false,
      source: "",
      confidence: "Low",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Does the service interface or customer support operate in any official languages of EU Member States?",
      answer: "Aruba S.p.A.'s service interface and customer support primarily operate in Italian and English. Some documentation and legal materials may also be available in German, French, and Spanish.",
      information_found: true,
      source: "hosting.aruba.it, assistenza.aruba.it, guide.aruba.it, TechRadar",
      confidence: "Medium",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Does the service enable transactions in Euro (EUR) or other national currencies of EU Member States (e.g., PLN, SEK, HUF)?",
      answer: "Aruba S.p.A. enables transactions in Euros, as shown by Euro-based pricing on their e-billing page. No information was found regarding transactions in other EU national currencies like PLN, SEK, or HUF.",
      information_found: true,
      source: "aruba.it",
      confidence: "Medium",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Is it possible for users located in the European Union to successfully order products or fully access the service?",
      answer: "Aruba S.p.A. provides web hosting and domain registration services accessible online to EU users, and through their Pratiche.it brand, they offer document delivery services within Italy. Specific details on EU-wide product shipping are not explicitly confirmed but involve third-party providers.",
      information_found: true,
      source: "aruba.it",
      confidence: "Low",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Does the service operate under a Union-specific Top-Level Domain (e.g., .eu) or any national Member State domains (e.g., .it, .de, .fr)?",
      answer: "Aruba S.p.A. operates its primary corporate service under the Italian national Member State domain **aruba.it**. The company also offers Union-specific (.eu) and other national domains to its customers as a registrar, and is the official registry for the .cloud top-level domain.",
      information_found: true,
      source: "aruba.it",
      confidence: "High",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Is your mobile app available for download in European Union countries appstores?",
      answer: "Aruba S.p.A. has multiple mobile apps available for download in EU app stores, including Aruba PEC, Aruba Business, and Aruba Mail on both Google Play Store and Apple App Store.",
      information_found: true,
      source: "apps.apple.com",
      confidence: "High",
    },
    {
      section: "GEOGRAPHICAL SCOPE",
      question: "Is the service technically accessible from IP addresses within the Union (i.e., is it free of geo-blocking measures)?",
      answer: "Under the EU Geo-blocking Regulation, Aruba S.p.A., as an EU-based company, cannot unjustifiably block access to its services from IP addresses within the EU, making it technically accessible without geo-blocking measures.",
      information_found: true,
      source: "europe-consommateurs.eu",
      confidence: "High",
    },
    // COMPANY SIZE
    {
      section: "COMPANY SIZE",
      question: "How many staff members does the provider employ?",
      answer: "Aruba S.p.A. is estimated to employ between 1,000 and 1,500 staff members, with specific sources citing approximately 1,246 employees.",
      information_found: true,
      source: "linkedin.com",
      confidence: "Medium",
    },
    {
      section: "COMPANY SIZE",
      question: "In your last closed financial year, was your company's annual turnover OR its total balance sheet €10 million or less?",
      answer: "No, the company's annual turnover was not €10 million or less. For the last closed financial year (2023), Aruba S.p.A.'s annual turnover was reported as €264,223,630, and more recent data for 2024 shows turnover of €300,407,397.",
      information_found: true,
      source: "aziende.it",
      confidence: "High",
    },
    // TYPE OF SERVICE PROVIDED
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as a 'Mere conduit service' under the DSA? (i.e. you strictly transmit data or provide internet access, without modifying or permanently storing the content)",
      answer: "Aruba S.p.A. does not operate as a 'mere conduit service' under the DSA; it is primarily a hosting service provider offering web hosting, cloud computing, data center services, and domain registration.",
      information_found: true,
      source: "aruba.it",
      confidence: "High",
    },
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as a 'Caching Service' under the DSA? (i.e., your main function is to automatically store temporary copies of data to speed up its delivery to other users)",
      answer: "Aruba S.p.A. operates as a caching service under the DSA definition, as it provides the HiSpeed Cache dynamic cache system and integrates with CDN services to automatically store temporary copies of data for faster content delivery.",
      information_found: true,
      source: "hosting.aruba.it",
      confidence: "High",
    },
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as an 'Online Search Engine' under the DSA? (i.e., you allow users to input queries to perform searches of the entire web)",
      answer: "Based on the available information, Aruba S.p.A. is described as a web hosting, domain registration, cloud services, and data center provider, with no mention of operating a general web search engine that indexes and searches the entire internet.",
      information_found: true,
      source: "aruba.it",
      confidence: "Low",
    },
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as a 'Hosting Service' under the DSA? (i.e., you store information provided by users at their request on a more than temporary basis?)",
      answer: "Aruba S.p.A. operates as a hosting service under the DSA definition, as it stores user information through services like cloud storage and web hosting, and it has published a DSA Transparency Report acknowledging its obligations as an intermediary service provider.",
      information_found: true,
      source: "guide.arubabusiness.it",
      confidence: "High",
    },
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as an 'Online Platform' under the DSA? (i.e., as a primary feature, does your service allow users to publish content that is visible to an indefinite number of people?)",
      answer: "Aruba S.p.A. is a cloud infrastructure and hosting provider, not an online platform under the DSA. It provides technical infrastructure (like web hosting and cloud servers) but does not operate a service that actively disseminates user content to the public as a primary feature.",
      information_found: true,
      source: "urlert.com",
      confidence: "High",
    },
    {
      section: "TYPE OF SERVICE PROVIDED",
      question: "Does your service operate as an 'Online Marketplace'? (i.e., you allow third-party sellers to sell products or services directly to consumers on your platform)",
      answer: "Aruba S.p.A. does not operate as an online marketplace for third-party sellers. It is primarily a web hosting, cloud services, and data center provider that offers e-commerce tools for businesses to build their own online stores.",
      information_found: true,
      source: "hosting.aruba.it",
      confidence: "High",
    },
  ],
};

// =============================================================================
// Compliance Report Data
// =============================================================================

export const COMPLIANCE_REPORT: ComplianceReport = {
  company_name: "Aruba S.p.A.",
  classification: {
    territorial_scope: {
      is_in_scope: true,
      reasoning:
        "The provider is established in the Union. Aruba S.p.A.'s main establishment and registered office is located in Italy (EU Member State), satisfying the territorial scope under Article 2 and Article 3(e) of the DSA.",
    },
    service_classification: {
      is_intermediary: true,
      service_category: "Hosting",
      is_online_platform: false,
      is_marketplace: false,
      is_search_engine: false,
      platform_reasoning:
        "Aruba S.p.A.'s core services (cloud computing, web hosting, data centers) constitute Hosting services under Article 3(g)(iii). The service does not meet the definition of an Online Platform (Article 3(i)) because the primary function is providing IT infrastructure. While customers may use this infrastructure to publish content (e.g., by hosting a website), the act of dissemination to the public is performed by the customer's application, not by Aruba as a service feature. This is consistent with Recital 13, which excludes cloud and web-hosting services from being considered online platforms where dissemination is a minor, ancillary feature of the underlying infrastructure.",
    },
    size_designation: {
      is_vlop_vlose: false,
      qualifies_for_sme_exemption: false,
      reasoning:
        "VLOP/VLOSE status applies only to designated Online Platforms or Online Search Engines. As Aruba is classified as a Hosting service and not an Online Platform or Search Engine, the VLOP/VLOSE threshold is not applicable. The company does not qualify for the SME exemption under Articles 19 or 29 as it exceeds the size thresholds for a small enterprise: it employs over 1,000 persons (well above the 50-employee limit) and has an annual turnover of over €264 million (far exceeding the €10 million financial threshold).",
    },
    summary:
      "Aruba S.p.A. is an Italian-established provider of intermediary services, placing it squarely within the DSA's territorial scope. Its core offerings of cloud computing, web hosting, and data center services are classified as Hosting services. The service does not constitute an Online Platform, Online Marketplace, or Online Search Engine, as its primary function is to provide technical infrastructure rather than to disseminate user-generated content to the public or facilitate consumer-trader contracts. The company is a large enterprise that does not qualify for SME exemptions and is not subject to VLOP/VLOSE obligations due to its service category.",
  },
  obligations: [
    {
      article: "11",
      title: "Points of contact for Member States' authorities",
      applies: true,
      implications:
        "Aruba S.p.A., as a provider of hosting and caching intermediary services under the DSA, must designate a single electronic point of contact for direct communication with EU authorities. This requires making the contact information publicly accessible, specifying communication languages that include Italian (due to its main establishment in Italy) and a widely understood language like English, and ensuring the channel enables rapid, efficient exchanges without obstacles.",
      action_items: [
        "Designate and publish a single electronic point of contact (e.g., a dedicated email address or web form) on Aruba's official website, such as aruba.it, ensuring it is easily findable and kept up to date.",
        "Specify in the published information that communications can be conducted in Italian (as required for the main establishment in Italy) and English (as a broadly understood EU language), aligning with the company's existing service interfaces.",
        "Establish internal protocols to monitor, acknowledge receipt, and respond promptly to all communications from Member States' authorities, the Commission, and the Board via this point of contact.",
      ],
    },
    {
      article: "12",
      title: "Points of contact for recipients of the service",
      applies: true,
      implications:
        "As a provider of hosting and caching services under the DSA, Aruba S.p.A. must establish a dedicated, user-friendly point of contact for its millions of EU-based customers to communicate directly and rapidly about DSA-related matters. This requires offering communication channels that are not solely automated, ensuring recipients can choose methods like email or phone, and allocating sufficient human resources to handle inquiries promptly across its service languages, primarily Italian and English.",
      action_items: [
        "Designate a specific, easily accessible DSA-related point of contact for service recipients, distinct from general customer support, published prominently on aruba.it and related service pages.",
        "Ensure the contact mechanism includes at least one non-automated channel (e.g., a staffed email or phone line) alongside any digital forms.",
        "Allocate and train sufficient personnel to respond to DSA-related inquiries from users in Italian and English in a timely manner.",
      ],
    },
    {
      article: "13",
      title: "Legal representatives",
      applies: false,
      implications:
        "Aruba S.p.A. is established in the EU (Italy) and therefore is exempt from the requirement to appoint a legal representative under Article 13, which applies only to providers not established in the Union.",
      action_items: [],
    },
    {
      article: "14",
      title: "Terms of service",
      applies: true,
      implications:
        "As a provider of hosting services under the DSA, Aruba S.p.A. must ensure its terms of service clearly and accessibly detail its restrictions, content moderation policies, and complaint handling procedures. It must inform users of significant changes and apply restrictions diligently while respecting fundamental rights, but it is exempt from VLOP-specific requirements like multilingual summaries.",
      action_items: [
        "Review and update Aruba's terms of service to explicitly include information on content policies, restrictions, and content moderation practices in clear, plain, and unambiguous language.",
        "Implement a notification system to inform users of significant changes to terms of service before they take effect.",
        "Ensure terms are available in the primary languages of the service (Italian and English) and are easily accessible from key pages.",
      ],
    },
    {
      article: "15",
      title: "Transparency reporting obligations",
      applies: true,
      implications:
        "As a large hosting service provider under the DSA, Aruba S.p.A. must annually publish detailed transparency reports on all content moderation activities, including notices of illegal content, actions taken, and use of automated tools. This obligation stems from its role in storing user data and facilitating access, requiring public accountability for how it handles illegal content and enforces terms and conditions.",
      action_items: [
        "Establish data collection systems to track all content moderation activities, including number and type of notices received, actions taken, and processing times.",
        "Publish an annual transparency report in a machine-readable format, covering all metrics required by Article 15.",
        "Set up internal workflows to review and approve transparency reports before publication.",
      ],
    },
    {
      article: "16",
      title: "Notice and action mechanisms",
      applies: true,
      implications:
        "As a provider of hosting services under the DSA, Aruba S.p.A. is legally required to implement and maintain a formal, user-friendly mechanism that allows anyone to report specific items of allegedly illegal content stored across its vast infrastructure, including its web hosting, cloud storage, and PEC services. This creates a direct, legally-mandated channel for receiving and processing content removal requests, requiring the company to handle each notice in a timely, diligent, and objective manner. The obligation necessitates balancing the removal of illegal content with the fundamental rights of its users, particularly freedom of expression, and establishing clear internal workflows for decision-making and communication with reporters.",
      action_items: [
        "Deploy or update a dedicated, user-friendly online notice submission system accessible from all Aruba service portals.",
        "Develop and document internal procedures for receiving, triaging, and acting on notices within defined timeframes.",
        "Train content moderation and legal teams on the new notice-and-action workflow, including requirements for acknowledging receipt and communicating decisions.",
      ],
    },
    {
      article: "17",
      title: "Statement of reasons",
      applies: true,
      implications:
        "As a hosting service provider, Aruba S.p.A. must issue clear, specific, and timely statements of reasons to any customer whose content is restricted or whose account is affected by a moderation decision. These statements must reference the specific legal or contractual basis for the action, describe the facts, explain any use of automated decision-making, and inform the user of available redress mechanisms.",
      action_items: [
        "Create standardized templates for statements of reasons that include all required information under Article 17.",
        "Implement systems to automatically generate and deliver statements of reasons when moderation actions are taken.",
        "Ensure statements are clear, accessible, and available in the user's service language.",
      ],
    },
    {
      article: "18",
      title: "Notification of suspicions of criminal offences",
      applies: true,
      implications:
        "As a hosting service provider under the DSA, Aruba S.p.A. must establish procedures to identify and promptly report any information giving rise to suspicion that a serious criminal offence involving a threat to the life or safety of persons has taken place, is taking place, or is likely to take place, to the competent law enforcement authorities of the relevant Member State(s).",
      action_items: [
        "Establish clear internal procedures and escalation paths for identifying content that may constitute a serious criminal threat.",
        "Designate responsible personnel and create guidelines for assessing when suspicion thresholds are met for mandatory reporting.",
        "Set up secure communication channels with Italian and relevant EU law enforcement authorities for prompt notifications.",
      ],
    },
  ],
  summary:
    "Aruba S.p.A. is classified under the Digital Services Act (DSA) as a provider of intermediary services, specifically a Hosting service, due to its core offerings of cloud computing, web hosting, and data center infrastructure. Established in Italy, the company falls squarely within the territorial scope of the regulation. It is not designated as an Online Platform, Online Marketplace, or Search Engine, as its primary function is to provide technical infrastructure rather than to disseminate user-generated content to the public.\n\nThe most critical DSA obligations for Aruba stem from its role as a large hosting provider. These include establishing clear points of contact for both authorities (Article 11) and users (Article 12), implementing a robust notice-and-action mechanism for illegal content (Article 16), and providing detailed statements of reasons for any content or account restrictions (Article 17). Furthermore, the company must publish annual transparency reports on its moderation activities (Article 15), maintain compliant terms of service (Article 14), and implement procedures to notify law enforcement of serious criminal suspicions (Article 18).\n\nKey action items to achieve compliance involve updating legal documentation, deploying dedicated user-facing reporting systems, and establishing internal workflows for content moderation, decision documentation, and communication. Significant operational investment is required to build data tracking systems for transparency reporting and to train relevant staff on the new legal protocols.\n\nImportantly, several exemptions apply. Aruba is not subject to the additional stringent obligations for Very Large Online Platforms (VLOPs) or Search Engines (VLOSEs), as it does not meet those classifications. Furthermore, while the company is too large to qualify for Small and Medium-sized Enterprise (SME) exemptions, its establishment within the EU (Italy) means it is exempt from the requirement to appoint a legal representative under Article 13.",
};
