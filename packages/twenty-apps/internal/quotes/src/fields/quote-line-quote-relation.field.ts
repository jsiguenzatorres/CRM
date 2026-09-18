import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_LINE_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_QUOTE_LINES_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The "many" side: a line item belongs to exactly one quote, and is deleted
// along with it — a line item without its parent quote has no meaning.
export default defineField({
  universalIdentifier: QUOTE_LINE_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'quote',
  label: 'Quote',
  description: 'The quote/contract this line item belongs to.',
  icon: 'IconFileInvoice',
  isNullable: false,
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTE_QUOTE_LINES_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'quoteId',
  },
});
