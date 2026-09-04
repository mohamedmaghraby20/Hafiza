# Import support

Hafiza MVP imports UTF-8 CSV and XLSX workbooks with a header row.

- Question/Answer or Front/Back columns are required.
- Tags is optional and accepts semicolon or pipe separators.
- Every file is parsed in a Web Worker and previewed before a transaction.
- Invalid rows are reported and excluded from the confirmed import.

Direct Anki `.apkg` import is deferred. An `.apkg` combines a ZIP archive,
SQLite collections, note models, templates, scheduling metadata, and media.
Shipping a partial parser risks silently changing card semantics or dropping
media. For MVP migration, export the desired Anki note type as text/CSV and
import it through the validated preview flow.
