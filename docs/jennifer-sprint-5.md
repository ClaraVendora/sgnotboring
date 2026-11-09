# Jennifer Sprint 5

- SGN-007: seven-day stored Google descriptions, Singapore today highlight, unavailable schedule state, address information card, Maps and existing save actions.
- SGN-005 support: preserve the merged responsive Home grid and desktop navigation.
- SGN-020 support: Home requests batches of 24, loads at the scroll sentinel, provides manual load/retry fallback and end indication; ordinary filters and sorting apply before pagination, with a total count from the API. Open now fetches the full matching list in one request and applies the shared hours calculator in the browser, as required by SGN-003. Requests without `limit` keep the array response.

Remaining validation: throttled 4G/300+ catalogue performance. The API pages in memory after `browse_places()` returns every match; database-side paging may be needed for larger catalogues. No hosted database changes.
