import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowApprovalActionSettingsSchema } from './approval-action-settings-schema';

export const workflowApprovalActionSchema = baseWorkflowActionSchema.extend({
  type: z.literal('APPROVAL'),
  settings: workflowApprovalActionSettingsSchema,
});
