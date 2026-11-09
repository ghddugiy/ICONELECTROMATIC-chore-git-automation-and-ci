# GitHub Source Handover Guide

This guide covers transferring repository administration to the client. It is
advisory only: no GitHub ownership, access, branch-protection, or workflow
settings are changed by this document.

## Repository ownership

- Confirm the repository's canonical URL and whether it belongs in a client-
  owned GitHub organization or account.
- The client should control the organization, billing, recovery methods, and
  at least two owner accounts. Do not make a contractor's personal account the
  sole owner.
- Transfer repository ownership through GitHub's supported transfer flow only
  after confirming the destination organization and its policies.
- Keep a client-controlled administrator responsible for organization
  membership, repository visibility, and recovery access.

## Collaborators and permissions

- Give each person an individual GitHub account; do not share accounts.
- Use the least privilege needed for each role. Reserve `Admin` access for
  client maintainers who manage repository settings and security.
- Grant write or maintain access only to people responsible for implementation
  and releases. Use read access for reviewers or auditors who do not need to
  push changes.
- Review outside collaborators and team memberships during handover and
  periodically afterward. Remove access when it is no longer needed.
- Require multi-factor authentication through the organization's policy where
  available.

## Branch protection and pull requests

For the default branch, the client should review and enable rules appropriate
to its release process, including:

- Require changes to arrive through pull requests.
- Require the relevant CI status checks to pass before merging.
- Require at least one independent review where staffing permits.
- Dismiss stale approvals when new commits are pushed and require approval for
  changes to protected workflow or deployment files where supported.
- Restrict force pushes and branch deletion.
- Keep the default branch and release process documented; do not assume a
  repository setting is enabled until a client owner verifies it in GitHub.

## CI workflow ownership

- Keep workflow files in the repository under client-controlled review.
- Assign a client maintainer to review workflow permissions, third-party
  actions, runner settings, and changes that access deployment credentials.
- Store required secrets in GitHub's client-owned repository or organization
  secret store. Never commit secrets, paste them into issues, or print them in
  workflow logs.
- Use narrowly scoped secrets and permissions, rotate inherited credentials
  during transfer, and remove credentials that are no longer required.
- Confirm which workflows run for pull requests, pushes, and releases, and
  whether organization policy requires approval for external contributions.

## Client responsibilities after handover

The client owns ongoing repository access reviews, account recovery, billing,
branch rules, CI workflow approvals, secret storage and rotation, dependency
alerts, release authorization, backups or mirrors, and the decision to grant
future contractors access. The client should keep at least two trusted
maintainers able to administer the source repository and its CI settings.

No ownership transfer or GitHub permission change is implied by this guide.
