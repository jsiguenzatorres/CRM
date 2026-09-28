import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CALL_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Shows up in the command menu when a Person record is selected. Company has
// no phone field in this codebase (verified: no `phone`/`phones` column on
// company.workspace-entity.ts), so there is no matching command for it.
export default defineCommandMenuItem({
  universalIdentifier: CALL_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Call',
  shortLabel: 'Call',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
