# Async Action Feedback Design

**Goal:** Standardize feedback for all user-triggered async actions so every meaningful operation shows a clear loading, success, or failure state.

## Context

The app currently has partial loading states on some buttons, but success and error feedback are inconsistent:

- some actions only disable the button while running
- some actions only show inline errors
- some successful operations complete silently
- the same action category uses different feedback styles across pages

This makes the app feel unreliable, especially for save, sync, connect, create, update, and delete flows.

## Constraint

All async action buttons must follow the same feedback contract:

1. **Loading**
   - the triggering button enters a loading state immediately
   - repeated clicks are disabled while the action is in progress
   - the button label should reflect the running state when practical

2. **Success**
   - successful completion must produce an explicit success acknowledgement
   - the default acknowledgement surface is a lightweight global toast
   - success copy should be short and action-specific, for example:
     - `设置已保存`
     - `日程已创建`
     - `邮箱已同步`

3. **Failure**
   - failed completion must produce an explicit error acknowledgement
   - the default acknowledgement surface is a lightweight global toast
   - existing inline error text may remain when it helps the user recover, but failure must not be silent

## Preferred UX Pattern

Use one shared feedback pattern across the app:

- local button state for `loading`
- global toast for `success`
- global toast for `error`

This keeps operations visible without making every card or dialog invent its own success banner.

## Toast Rules

- toasts should be lightweight and non-blocking
- toast styling must visually differ by tone: `success`, `error`, optionally `info`
- toasts should auto-dismiss after a short duration
- toasts must stack cleanly without covering primary form controls
- toast content should stay concise and use plain language

## First Implementation Scope

The first rollout should cover the app's current primary async actions:

- settings popup save
- onboarding finish
- schedule create
- schedule update
- schedule delete
- integrations test connection
- integrations save account
- integrations sync account
- integrations delete account
- external schedule review confirm
- external schedule review dismiss

## Documentation Constraint

Going forward, any newly added async action must include:

- a loading state on the triggering control
- a success toast on completion
- an error toast on failure

This should be treated as a UI constraint alongside existing rules for destructive confirmations and modal-only forms.
