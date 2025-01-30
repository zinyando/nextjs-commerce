import { Mastra } from '@mastra/core';

import { shopifyRagWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    shopifyRagWorkflow,
  },
});