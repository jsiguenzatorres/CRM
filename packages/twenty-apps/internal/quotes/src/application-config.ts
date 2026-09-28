import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// No default role defined yet — pending, see docs/QUOTES_DESIGN.md.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'jsiguenzatorres/CRM',
  category: 'Sales',
});
