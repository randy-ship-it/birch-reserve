export type AdInterest = "performance" | "display" | "both" | "guidance";

export interface ConciergeQuestionSignals {
  bookingIntent: boolean;
  awarenessIntent: boolean;
  comparisonIntent: boolean;
  privateReviewIntent: boolean;
  sensitiveContentDetected: boolean;
}

export type GuideQuestionIntent =
  | "sensitive"
  | "not_a_fit"
  | "build_a_hub"
  | "join_provider_network"
  | "performance_fit"
  | "pricing_or_availability"
  | "audience_or_metrics"
  | "self_serve_purchase"
  | "format"
  | "media_kit"
  | "auction_comparison"
  | "display_fit"
  | "general";

export interface GuideQuestionAnalysis {
  intent: GuideQuestionIntent;
  signals: ConciergeQuestionSignals;
}

const providerPattern =
  /\b(provider|physio|physiotherapy|pelvic|msk|clinic|clinician|practitioner)\b/i;
const existingNetworkPattern =
  /\b(already|currently|approved|member|part of|inside)\b.{0,36}\b(clinic hubs?|the hubs?|hub network|curated network)\b|\b(clinic hubs?|the hubs?|hub network|curated network)\b.{0,36}\b(already|currently|approved|member|part of|inside)\b/i;
const hubBuilderPattern =
  /\b(build|create|launch|own|white.label|white label|studio|creator).{0,32}\b(hub|clinic hub|member hub)\b|\b(clinic hub|member hub).{0,32}\b(build|create|launch|own)\b/i;
const nonFitPattern =
  /\b(crypto|cbd|cannabis|adult|political|politics|election|patient.level|retargeting pixel|tracking pixel)\b/i;
const privateReviewPattern =
  /\b(price|pricing|rate|rates|cost|budget|inventory|available|availability|launch date|timeline|forecast|contract|legal|compliance|impressions?|clicks?|conversions?|audience size|reach|cpm|guarantee|guaranteed|results|revenue)\b/i;
const sensitivePattern =
  /\b(patient|member record|medical|health record|diagnosis|condition|symptom|treatment|test result|lab result|medication|prescription|procedure|injury|disease|allergy|doctor|physician|therapist|credit card|card number|bank account|password|api key|access token|social insurance|social security)\b/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){9,14}\d/;

export const SCALE_HEALTH_URLS = {
  providers: "https://scalehealth.ca/providers",
  clinicHubs: "https://scalehealth.ca/clinichubs",
  embeddedRecoveryClinic: "https://scalehealth.ca/embedded-recovery-clinic",
} as const;

export const DISPLAY_FORMATS = {
  confirmation: {
    label: "After checkout",
    message:
      "A confirmation placement is shown after a customer buys from a signed Scale Health brand hub, beside products already trusted in that environment. The public mock shows the context, not a reserved placement.",
  },
  plan: {
    label: "Inside a plan",
    message:
      "A plan placement appears inside the digital recovery or wellness plan the customer is already following. Category and host fit are reviewed privately before any media runs.",
  },
  booking: {
    label: "After a booking",
    message:
      "A booking confirmation placement appears after a customer schedules a recovery, wellness, or fitness service. It reaches the customer inside the existing care journey, not through an open-web impression.",
  },
  hub: {
    label: "Inside a member hub",
    message:
      "A native hub module sits on a signed brand hub home beside member offers and the private Scale Health supplier catalog. The public page illustrates the environment; availability begins only under a final insertion order.",
  },
} as const;

export function classifyGuideQuestion(value: string): GuideQuestionAnalysis {
  const normalized = value.toLowerCase();
  const sensitiveContentDetected =
    emailPattern.test(value) || phonePattern.test(value) || sensitivePattern.test(value);
  const signals: ConciergeQuestionSignals = {
    bookingIntent:
      /\b(performance|booking|bookings|conversion|conversions|appointment|appointments|action)\b/.test(
        normalized,
      ),
    awarenessIntent:
      /\b(display|awareness|brand|attention|creative|environment|broad|consideration)\b/.test(
        normalized,
      ),
    comparisonIntent:
      /\b(both|compare|side[- ]by[- ]side|learning|learn|test|mix|combination)\b/.test(
        normalized,
      ),
    privateReviewIntent: privateReviewPattern.test(normalized),
    sensitiveContentDetected,
  };

  if (sensitiveContentDetected) return { intent: "sensitive", signals };
  if (nonFitPattern.test(normalized)) return { intent: "not_a_fit", signals };
  if (hubBuilderPattern.test(normalized)) return { intent: "build_a_hub", signals };
  if (providerPattern.test(normalized)) {
    if (existingNetworkPattern.test(normalized)) {
      return {
        intent: "performance_fit",
        signals: {
          ...signals,
          bookingIntent: true,
          awarenessIntent: false,
          comparisonIntent: false,
        },
      };
    }
    return { intent: "join_provider_network", signals };
  }
  if (/\b(audience|how big|size|volume|traffic|metrics?)\b/i.test(normalized)) {
    return { intent: "audience_or_metrics", signals };
  }
  if (/\b(self serve|self-serve|buy now|pay now|buy a banner|checkout)\b/i.test(normalized)) {
    return { intent: "self_serve_purchase", signals };
  }
  if (/\b(media kit|deck|case stud|one pager|rate card)\b/i.test(normalized)) {
    return { intent: "media_kit", signals };
  }
  if (/\b(meta|google|auction|programmatic)\b/i.test(normalized)) {
    return { intent: "auction_comparison", signals };
  }
  if (/\b(banner|placement|format|motion|after checkout|recovery plan|member hub)\b/i.test(normalized)) {
    return { intent: "format", signals };
  }
  if (
    /\b(electrolytes?|nutrition|proteins?|topicals?|sleep|mobility|skin|wellness|recovery)\b/i.test(
      normalized,
    )
  ) {
    return { intent: "display_fit", signals };
  }
  if (privateReviewPattern.test(normalized)) {
    return { intent: "pricing_or_availability", signals };
  }
  return { intent: "general", signals };
}