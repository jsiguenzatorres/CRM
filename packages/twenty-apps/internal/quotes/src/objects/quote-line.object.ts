import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  QUOTE_LINE_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_LINE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The relation back to Quote is declared separately in
// src/fields/quote-line-quote-relation.field.ts.
export default defineObject({
  universalIdentifier: QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quoteLine',
  namePlural: 'quoteLines',
  labelSingular: 'Quote line',
  labelPlural: 'Quote lines',
  description: 'A single priced line item on a quote or contract.',
  icon: 'IconListDetails',
  labelIdentifierFieldMetadataUniversalIdentifier:
    QUOTE_LINE_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: QUOTE_LINE_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'What this line item is, e.g. "Pro plan — annual seat".',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: QUOTE_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Quantity',
      description: 'Units of this line item.',
      icon: 'IconHash',
      defaultValue: '1',
    },
    {
      universalIdentifier: QUOTE_LINE_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'unitPrice',
      label: 'Unit price',
      description: 'Price per unit.',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: QUOTE_LINE_LINE_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'lineTotal',
      label: 'Line total',
      description: 'Quantity times unit price. Computed when the PDF is generated.',
      icon: 'IconSum',
    },
  ],
});
