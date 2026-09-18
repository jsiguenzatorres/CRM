import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// No default role defined yet — this app only adds a command menu item and a
// front component, both read-only against Person; revisit once it also
// writes call-log records (see docs/CLICK_TO_CALL_DESIGN.md).
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'jsiguenzatorres/CRM',
  category: 'Sales',
});
