import type { AdvertiserIntakeInput } from "@workspace/api-client-react";

export type IntakeProfile = Partial<
  Omit<AdvertiserIntakeInput, 'email' | 'source' | 'followUpConsent'>
>;
