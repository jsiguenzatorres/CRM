import { defineApplication, FieldType } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  TWILIO_ACCOUNT_SID_ENV_VAR_NAME,
  TWILIO_API_KEY_SECRET_ENV_VAR_NAME,
  TWILIO_API_KEY_SID_ENV_VAR_NAME,
  TWILIO_AUTH_TOKEN_ENV_VAR_NAME,
  TWILIO_CALLER_ID_ENV_VAR_NAME,
  TWILIO_TWIML_APP_SID_ENV_VAR_NAME,
} from 'src/constants/universal-identifiers';

// No default role defined yet — this app only adds a command menu item and a
// front component, both read-only against Person; revisit once it also
// writes call-log records (see docs/CLICK_TO_CALL_DESIGN.md).
//
// serverVariables below are Twilio Voice credentials for the Fase 2 embedded
// dialer (docs/CLICK_TO_CALL_DESIGN.md). Declaring them here is what makes
// the fields show up for an admin to fill in after installing the app — the
// logic functions that actually read them (token minting, TwiML webhook,
// status callback) are still sketches in the design doc, not real files yet.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'jsiguenzatorres/CRM',
  category: 'Sales',
  serverVariables: {
    [TWILIO_ACCOUNT_SID_ENV_VAR_NAME]: {
      description: 'Twilio Account SID (starts with AC...). Not secret by itself, but scoped to your account.',
      isSecret: false,
      isRequired: true,
      type: FieldType.TEXT,
    },
    [TWILIO_AUTH_TOKEN_ENV_VAR_NAME]: {
      description:
        'Twilio Auth Token. Used to verify the X-Twilio-Signature header on inbound voice/status webhooks — never sent to the browser.',
      isSecret: true,
      isRequired: true,
      type: FieldType.TEXT,
    },
    [TWILIO_API_KEY_SID_ENV_VAR_NAME]: {
      description: 'Twilio API Key SID (starts with SK...), created under Account > API keys & tokens.',
      isSecret: false,
      isRequired: true,
      type: FieldType.TEXT,
    },
    [TWILIO_API_KEY_SECRET_ENV_VAR_NAME]: {
      description: 'Secret paired with the API Key SID above. Twilio only shows it once at creation time.',
      isSecret: true,
      isRequired: true,
      type: FieldType.TEXT,
    },
    [TWILIO_TWIML_APP_SID_ENV_VAR_NAME]: {
      description:
        'TwiML App SID (starts with AP...) whose Voice URL points at this app’s /voip/voice route. Required to mint Voice Access Tokens.',
      isSecret: false,
      isRequired: true,
      type: FieldType.TEXT,
    },
    [TWILIO_CALLER_ID_ENV_VAR_NAME]: {
      description: 'Twilio phone number (E.164, e.g. +15551234567) shown as the caller ID on outbound calls.',
      isSecret: false,
      isRequired: true,
      type: FieldType.TEXT,
    },
  },
});
