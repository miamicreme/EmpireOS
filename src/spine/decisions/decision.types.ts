/** Decision types re-exported for module-local imports. */
export type {
  Decision,
  DecisionOption,
  DecisionVote,
  DecisionStatus,
  DecisionType,
  DecisionContext,
} from '../types';

import type { Decision, DecisionOption, DecisionVote } from '../types';

/** A decision joined with its options and advisor votes. */
export interface DecisionWithVotes extends Decision {
  options: DecisionOption[];
  votes: DecisionVote[];
}
