import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_QUOTE_LINES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The "one" side: a quote lists all of its line items.
export default defineField({
  universalIdentifier: QUOTE_QUOTE_LINES_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'quoteLines',
  label: 'Line items',
  description: 'The priced line items on this quote/contract.',
  icon: 'IconListDetails',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTE_LINE_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
