// Central registry of the app's universal identifiers.
// Every entity in a Twenty app carries a stable UUID (its `universalIdentifier`).
// Keeping them in one file makes cross-references (relations, views, layouts)
// easy to follow and guarantees they stay stable across syncs and versions.
// Pattern mirrored from packages/twenty-apps/examples/document-generator.

export const APP_DISPLAY_NAME = 'Quotes & Contracts';
export const APP_DESCRIPTION =
  'Create quotes and contracts with line-item pricing, generate a PDF, and capture customer acceptance from a public link — no external e-signature API required.';

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'ce02c42a-8098-4e92-ad7e-a1fae2cbc5fb';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER =
  '42ecb623-d1b7-4f7a-8637-983b8c98bdd4';

// Quote object + fields
export const QUOTE_OBJECT_UNIVERSAL_IDENTIFIER =
  '9cd19428-81e8-483d-85ba-20bfd4f8bbfb';
export const QUOTE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '95fd105f-aa10-4bd6-a698-0ae5cf782f22';

export const QUOTE_KIND_FIELD_UNIVERSAL_IDENTIFIER =
  '16d0d7ba-a6cb-42b5-8ea4-7facb7d4d127';
export const QUOTE_KIND_OPTION_QUOTE_UNIVERSAL_IDENTIFIER =
  '42583b32-9f94-477c-9fbc-c7e649104842';
export const QUOTE_KIND_OPTION_CONTRACT_UNIVERSAL_IDENTIFIER =
  'd2af202c-e10d-474f-a2ac-d5e904c7f2bb';

export const QUOTE_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  'c67d1eab-1ac5-45b8-931e-d3ea579faf70';
export const QUOTE_STATUS_OPTION_DRAFT_UNIVERSAL_IDENTIFIER =
  '358ccbc5-2225-4393-ad00-95141a0c6efd';
export const QUOTE_STATUS_OPTION_SENT_UNIVERSAL_IDENTIFIER =
  '599fc7c2-f002-40ee-b3bd-c9fb4ef8ad04';
export const QUOTE_STATUS_OPTION_ACCEPTED_UNIVERSAL_IDENTIFIER =
  '577446f6-82bc-44c1-a50a-27176c81b825';
export const QUOTE_STATUS_OPTION_DECLINED_UNIVERSAL_IDENTIFIER =
  'c8028ab9-ff27-4e72-b7a2-ea77c2a21e5c';
export const QUOTE_STATUS_OPTION_EXPIRED_UNIVERSAL_IDENTIFIER =
  '4fde245e-725d-4f6d-9431-6b08e699a96c';

export const QUOTE_VALID_UNTIL_FIELD_UNIVERSAL_IDENTIFIER =
  '23a82746-bcf2-4525-bae1-af33bfc19426';
export const QUOTE_TERMS_FIELD_UNIVERSAL_IDENTIFIER =
  '13401a87-0d80-41a9-bf19-8185abb8b4a3';
export const QUOTE_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  'df38e7fe-6f21-46a5-a2c7-34a7c3f5bfac';
export const QUOTE_TAX_RATE_FIELD_UNIVERSAL_IDENTIFIER =
  'd24cff34-3506-422c-a10e-58a16533daf9';
export const QUOTE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '42afa82e-548c-49d4-bc5b-681a97e845da';
export const QUOTE_FILE_FIELD_UNIVERSAL_IDENTIFIER =
  'b4161fe4-c3be-4d2d-ace7-f5c3ad382bd0';
export const QUOTE_ACCEPTED_BY_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '88213765-44fb-4c4a-bb30-73f42d6f3e6a';
export const QUOTE_ACCEPTED_BY_EMAIL_FIELD_UNIVERSAL_IDENTIFIER =
  '13fd4fc9-48cb-4e83-b1de-dbe7bf0d0bb4';
export const QUOTE_ACCEPTED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'b60a74ed-e615-4380-b28c-4a10b7490d1a';

// The "one" side of the Quote <-> QuoteLine relation: all line items of a quote.
export const QUOTE_QUOTE_LINES_FIELD_UNIVERSAL_IDENTIFIER =
  '2bd66f52-4244-4d25-b8cf-acb7bb37b365';

// QuoteLine object + fields
export const QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER =
  '1d72b002-43df-4d1a-b697-63482a77e7ec';
export const QUOTE_LINE_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER =
  'edbc5c7e-a4bb-495a-934a-6e536e948614';
export const QUOTE_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  'f06da09f-12a5-43fe-a496-1defa220207e';
export const QUOTE_LINE_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER =
  'ab93cbfb-cb75-49c0-9750-ebceb59ad9f1';
export const QUOTE_LINE_LINE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '83314845-15f0-4bd9-abaa-213be376842a';
// The "many" side: each line item points back at its quote.
export const QUOTE_LINE_QUOTE_FIELD_UNIVERSAL_IDENTIFIER =
  '00a9b1c6-e8e6-45e3-be20-148e56e3badf';

// Select option values must be UPPER_CASE. Centralized so the object metadata
// and any handler that writes them can never drift apart.
export const QUOTE_KIND_QUOTE = 'QUOTE';
export const QUOTE_KIND_CONTRACT = 'CONTRACT';

export const QUOTE_STATUS_DRAFT = 'DRAFT';
export const QUOTE_STATUS_SENT = 'SENT';
export const QUOTE_STATUS_ACCEPTED = 'ACCEPTED';
export const QUOTE_STATUS_DECLINED = 'DECLINED';
export const QUOTE_STATUS_EXPIRED = 'EXPIRED';
