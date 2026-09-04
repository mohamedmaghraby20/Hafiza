# Feature module boundaries

Each feature owns its `domain`, `application`, `infrastructure`, and `ui`
folders as needed and exposes its supported API through the feature's
`index.ts` file.

Other modules must import that public API through `@modules/<feature>` and
must not deep-import feature internals. UI may depend on application and
domain APIs. Infrastructure implements inward-facing ports; domain code stays
framework- and browser-independent.
