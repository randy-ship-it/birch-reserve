---
name: GitHub connector boundary
description: How GitHub API authorization differs from shell Git authentication in this workspace.
---

GitHub connector authorization can create and manage repositories through the connector proxy, but it does not expose credentials to shell Git operations. A repository created through the connector may still require the owner to link GitHub in Replit’s Git tool before the first push.

**Why:** The connector deliberately keeps OAuth credentials out of the workspace shell, so an HTTPS remote can exist while `git push` still reports an invalid username or token.

**How to apply:** Use the connector for GitHub API operations. For full repository synchronization, configure the remote and have the owner complete the one-time Git-tool account link; then verify the first push before promising external collaborators that the repository contains the project.