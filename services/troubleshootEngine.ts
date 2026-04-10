import { TroubleshootingIssue, TroubleshootingStep } from './issueDetector';

interface State {
  issue: TroubleshootingIssue | null;
  stepId: number | null;
}

let state: State = {
  issue: null,
  stepId: null,
};

export function startIssue(issue: TroubleshootingIssue): TroubleshootingStep | undefined {
  state.issue = issue;
  state.stepId = 1;

  return issue.steps.find((s) => s.id === 1);
}

export function handleAnswer(answer: string): { result?: string; question?: string } {
  if (!state.issue || !state.stepId) {
    return { result: "I'm sorry, I lost track of our session. How can I help you today?" };
  }

  const step = state.issue.steps.find((s) => s.id === state.stepId);
  if (!step) {
    return { result: "Oops, something went wrong with the troubleshooting steps." };
  }

  // Very simple yes/no check
  // Note: in a real AI context, we'd maybe check sentiment. Here we just look for 'yes'/'y' or 'no'/'n'
  const isYes = ['yes', 'y', 'yeah', 'yep', 'correct'].includes(answer.trim().toLowerCase());
  const next = isYes ? step.yes : step.no;

  if (typeof next === 'number') {
    state.stepId = next;
    const nextStep = state.issue.steps.find((s) => s.id === next);
    return { question: nextStep?.question };
  }

  // End of flow
  state = { issue: null, stepId: null };
  return { result: typeof next === 'string' ? next : 'Process complete.' };
}
