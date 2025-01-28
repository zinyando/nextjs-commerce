import { Mastra } from '@mastra/core';

import { shopifyVectorWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    shopifyVectorWorkflow,
  },
});