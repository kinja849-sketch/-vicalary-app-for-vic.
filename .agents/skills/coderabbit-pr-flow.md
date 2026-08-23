# CodeRabbit & Pull Request Review Workflow Skill

## Workflow Steps
1. **Localhost Verification First**: Verify and test all features on `localhost:3000` before pushing code.
2. **Explicit Push Command**: Only push to GitHub / create a PR after explicit user instruction ("push to GitHub").
3. **Review CodeRabbit Output**: When CodeRabbit analyzes a PR, inspect all path-specific findings (`app/api/**`, `lib/**`, `app/**/*.tsx`).
4. **Address Exact Suggestions**:
   - Create a focused task in `prompts/coderabbit-fix-<pr#>.md`.
   - Implement exact security, type safety, or performance fixes recommended by CodeRabbit.
   - Run typechecks and tests locally.
   - Push fix commits to the PR branch.
5. **Merge Policy**: Never merge PRs with unresolved critical security or secret exposure findings.
