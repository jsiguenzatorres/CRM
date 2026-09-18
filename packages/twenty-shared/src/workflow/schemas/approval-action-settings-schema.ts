import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

// MVP scope (see docs/WORKFLOW_APPROVAL_DESIGN.md): the approver is a single
// workspace member picked at design time, not a dynamic variable (e.g. "the
// record's owner") — that's a documented follow-up, not this first version.
export const workflowApprovalActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    assignedWorkspaceMemberId: z.string(),
    instructions: z.string().optional(),
  });
