# Contributing

## Backend API Surface

Use these rules when adding or changing Django REST endpoints:

- Use `GenericViewSet + mixins` for router-backed resource roots.
- Use only the mixins that match the intended public HTTP surface.
- Do not use `ModelViewSet` for router-backed resources unless the resource is a true full CRUD surface with no meaningful restrictions.
- Use `APIView` for flow-oriented, bootstrap, nested, or non-resource endpoints.
- If a method should not exist publicly, do not expose the mixin for it. Do not expose it and reject it later.
- Use kebab-case for multiword custom action paths.
- If an old custom path must be kept for compatibility, add a clearly named alias and keep the frontend on the canonical path.

## Current Router Convention

- `users`: `list`, `retrieve`, `create`, `update`
- `projects`: `list`, `retrieve`, `create`, `update`, `destroy`
- `issues`: `GenericViewSet + mixins` with explicit custom actions
- `attachments`: `GenericViewSet + mixins`
- `notifications`: `GenericViewSet + mixins`
- `tags`: `list`, `create`, `destroy`

## Contract Changes

When changing routes or supported methods:

- update backend endpoint tests first or in the same change
- update `README.md` if the public contract changed
- verify the frontend uses the documented paths
- run `python manage.py check`
- run `python manage.py test apps.bugboardapi.tests`
