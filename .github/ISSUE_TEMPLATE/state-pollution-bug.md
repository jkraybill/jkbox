---
name: State Pollution Between Game Phases
about: Template for reporting state boundary violations
title: '[STATE] '
labels: bug, critical, state-management
assignees: ''
---

## Description
Brief description of the state pollution issue.

## Symptoms
What behavior did you observe?
- [ ] Wrong data appearing in wrong phase/round/film
- [ ] Data from previous phase affecting current phase
- [ ] Unexpected values after phase transition

## State Scope Analysis
Which scope level is affected?
- [ ] Game-scoped (affects entire 3-film game)
- [ ] Film-scoped (affects single film, should clear between films)
- [ ] Clip-scoped (affects single clip, should clear between clips)
- [ ] Phase-scoped (affects single phase)

## Root Cause
Which state variable is not being cleared?
- State variable name:
- Current scope:
- Should be cleared in: `advanceToNextFilm()` / `advanceToNextClip()` / other

## Reproduction Steps
1.
2.
3.

## Expected Behavior
What should happen?

## Actual Behavior
What actually happened?

## Fix Checklist
- [ ] Identify state variable scope (game/film/clip)
- [ ] Add clearing logic in appropriate transition function
- [ ] Add regression test to prevent future pollution
- [ ] Update docs/cinema-pippin-state-architecture.md
- [ ] Verify related state variables are also properly scoped

## Testing
- [ ] Added unit test for state clearing
- [ ] Added integration test for multi-film/clip scenario
- [ ] Manually verified fix in gameplay

## Related Issues
<!-- Link to related state management issues -->

---

**See:** `docs/cinema-pippin-state-architecture.md` for state scoping guidelines
