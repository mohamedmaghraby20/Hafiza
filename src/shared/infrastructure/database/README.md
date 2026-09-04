# Database migrations

`HafizaDatabase` owns the IndexedDB schema. Version 1 is the released baseline.
Future persistent changes must add a new `version(n).stores(...).upgrade(...)`
declaration; existing version declarations are never rewritten. Upgrade functions
must be deterministic and covered by integration tests from every released
version.
