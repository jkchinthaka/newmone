# 09 UI and UX regression audit

`origin/fix/ux-confirmed-defects` at `99ec9d5b` was not merged. Merge-base with the release HEAD is `4d394657`. The release tree already has a large uncommitted UI diff. Combining them without a dedicated conflict pass would risk the work-order and request screens.

The only UI edit in this session is sending `expectedVersion` from `work-orders-page.tsx`. It was not clicked through in a browser.

Port 3001 is the OneDrive UX app. Port 3023 is the release app. Neither was used as proof for this change.
