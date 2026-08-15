# Screen Content Matrix — Phase 01C

**Document status:** Draft pending owner review — not approved  
**Phase:** 01C — High-fidelity MVP screens and prototype  
**Branch:** `design/figma-high-fidelity-mvp`  
**Created:** 2026-08-05  
**Last updated:** 2026-08-05

**CRITICAL:** Sinhala translations are **PROPOSED** and require linguistic and domain-expert review before final use. Do NOT treat proposed Sinhala text as approved regulatory or certified translation.

**Related documents:**
- [HIGH_FIDELITY_SCREEN_SPEC.md](HIGH_FIDELITY_SCREEN_SPEC.md)
- [CONTENT_AND_LANGUAGE_GUIDE.md](CONTENT_AND_LANGUAGE_GUIDE.md)
- [ACCESSIBILITY_AND_USABILITY.md](ACCESSIBILITY_AND_USABILITY.md)

This document maps content keys to English and proposed Sinhala translations for all MVP screens. Approval status is **Pending** for all content.

---

## Content matrix structure

| Content Key | English (EN) | Proposed Sinhala (SI) | Context / Audience | Approval Status |
| --- | --- | --- | --- | --- |
| `key.dot.notation` | English text | සිංහල පෙළ (proposed) | Screen / persona | Pending |

**Sinhala proposal source:** Google Translate baseline + manual review for food-safety domain terms. **NOT** certified translation.

**Required next steps:** Sinhala linguistic review + domain-expert review (food safety terms) + owner approval.

---

## AUTH — Authentication

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `auth.login.title` | Login | පිවිසීම | AUTH-LGN header | Pending |
| `auth.login.employee_code` | Employee Code | සේවක කේතය | AUTH-LGN form label | Pending |
| `auth.login.password` | Password | මුරපදය | AUTH-LGN form label | Pending |
| `auth.login.submit` | Login | පිවිසෙන්න | AUTH-LGN button | Pending |
| `auth.login.forgot_password` | Forgot password? | මුරපදය අමතකද? | AUTH-LGN link | Pending |
| `auth.login.error.invalid` | Invalid employee code or password | වැරදි සේවක කේතය හෝ මුරපදය | AUTH-LGN error | Pending |
| `auth.login.error.locked` | Account locked. Contact administrator. | ගිණුම අගුළු වී ඇත. පරිපාලකයා සම්බන්ධ කරන්න. | AUTH-LGN error | Pending |
| `auth.login.offline` | You are offline. Cannot log in. | ඔබ නොසම්බන්ධයි. පිවිසිය නොහැක. | AUTH-LGN banner | Pending |
| `auth.forced_change.title` | Change Password | මුරපදය වෙනස් කරන්න | AUTH-FPC header | Pending |
| `auth.forced_change.current` | Current Password | වත්මන් මුරපදය | AUTH-FPC form label | Pending |
| `auth.forced_change.new` | New Password | නව මුරපදය | AUTH-FPC form label | Pending |
| `auth.forced_change.confirm` | Confirm New Password | නව මුරපදය තහවුරු කරන්න | AUTH-FPC form label | Pending |
| `auth.forced_change.submit` | Change Password | මුරපදය වෙනස් කරන්න | AUTH-FPC button | Pending |
| `auth.reset.title` | Reset Password | මුරපදය නැවත සකසන්න | AUTH-RST header | Pending |
| `auth.reset.instructions` | Enter your employee code to request a password reset. | මුරපද යළි සැකසීමක් ඉල්ලීමට ඔබේ සේවක කේතය ඇතුළත් කරන්න. | AUTH-RST text | Pending |
| `auth.reset.submit` | Request Reset | යළි සැකසීම ඉල්ලන්න | AUTH-RST button | Pending |
| `auth.locked.title` | Account Locked | ගිණුම අගුළු වී ඇත | AUTH-LCK header | Pending |
| `auth.locked.message` | Your account has been locked. Please contact your administrator. | ඔබගේ ගිණුම අගුළු වී ඇත. කරුණාකර ඔබේ පරිපාලකයා සම්බන්ධ කරන්න. | AUTH-LCK text | Pending |
| `auth.denied.title` | Access Denied | ප්‍රවේශය ප්‍රතික්ෂේප විය | AUTH-DEN header | Pending |
| `auth.denied.message` | You do not have permission to access this resource. | මෙම සම්පතට ප්‍රවේශ වීමට ඔබට අවසර නැත. | AUTH-DEN text | Pending |
| `auth.expired.title` | Session Expired | සැසිය කල් ඉකුත් විය | AUTH-EXP header | Pending |
| `auth.expired.message` | Your session has expired. Please log in again. | ඔබගේ සැසිය කල් ඉකුත් වී ඇත. කරුණාකර නැවත පිවිසෙන්න. | AUTH-EXP text | Pending |

---

## OP — Operator

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `op.home.title` | Home | මුල් පිටුව | OP-HOME header | Pending |
| `op.home.due_tasks` | Due Tasks | නියමිත කාර්යයන් | OP-HOME card | Pending |
| `op.home.overdue` | Overdue | කල් ඉකුත් | OP-HOME card | Pending |
| `op.home.view_tasks` | View My Tasks | මාගේ කාර්යයන් බලන්න | OP-HOME button | Pending |
| `op.tasks.title` | My Tasks | මාගේ කාර්යයන් | OP-TASKS header | Pending |
| `op.tasks.empty` | No tasks assigned | කාර්යයන් පවරා නැත | OP-TASKS empty state | Pending |
| `op.tasks.filter.all` | All | සියල්ල | OP-TASKS filter | Pending |
| `op.tasks.filter.due_today` | Due Today | අද නියමිත | OP-TASKS filter | Pending |
| `op.tasks.filter.overdue` | Overdue | කල් ඉකුත් | OP-TASKS filter | Pending |
| `op.task.title` | Task Detail | කාර්ය විස්තර | OP-TASK header | Pending |
| `op.task.checklist` | Checklist | පරීක්ෂණ ලැයිස්තුව | OP-TASK label | Pending |
| `op.task.site` | Site | ස්ථානය | OP-TASK label | Pending |
| `op.task.batch` | Batch | කඩාව | OP-TASK label | Pending |
| `op.task.due` | Due | නියමිත කාලය | OP-TASK label | Pending |
| `op.task.status` | Status | තත්ත්වය | OP-TASK label | Pending |
| `op.task.start` | Start Checklist | පරීක්ෂණය ආරම්භ කරන්න | OP-TASK button | Pending |
| `op.task.resume` | Resume Checklist | පරීක්ෂණය නැවත ආරම්භ කරන්න | OP-TASK button | Pending |
| `op.task.view_record` | View Record | වාර්තාව බලන්න | OP-TASK button | Pending |
| `op.checklist.title` | Checklist | පරීක්ෂණ ලැයිස්තුව | OP-CHK header | Pending |
| `op.checklist.progress` | Item {current} of {total} | අයිතමය {current} / {total} | OP-CHK progress | Pending |
| `op.checklist.pass` | Pass | සමත් | OP-CHK button | Pending |
| `op.checklist.fail` | Fail | අසමත් | OP-CHK button | Pending |
| `op.checklist.next` | Next | ඊළඟ | OP-CHK button | Pending |
| `op.checklist.previous` | Previous | පෙර | OP-CHK button | Pending |
| `op.checklist.save_draft` | Save Draft | කෙටුම්පත සුරකින්න | OP-CHK button | Pending |
| `op.checklist.draft_saved` | Draft saved | කෙටුම්පත සුරැකිණි | OP-CHK toast | Pending |
| `op.failure.title` | Failure Details | අසමත් විස්තර | OP-FAIL header | Pending |
| `op.failure.reason` | Reason | හේතුව | OP-FAIL label | Pending |
| `op.failure.measurement` | Measurement | මිණුම | OP-FAIL label | Pending |
| `op.failure.capture_evidence` | Capture Evidence | සාක්ෂි ග්‍රහණය කරන්න | OP-FAIL button | Pending |
| `op.failure.save` | Save Failure Details | අසමත් විස්තර සුරකින්න | OP-FAIL button | Pending |
| `op.evidence.title` | Evidence Capture | සාක්ෂි ග්‍රහණය | OP-EVD header | Pending |
| `op.evidence.capture_photo` | Capture Photo | ඡායාරූපය ග්‍රහණය කරන්න | OP-EVD button | Pending |
| `op.evidence.capture_video` | Capture Video | වීඩියෝව ග්‍රහණය කරන්න | OP-EVD button | Pending |
| `op.evidence.confirm` | Confirm | තහවුරු කරන්න | OP-EVD button | Pending |
| `op.evidence.uploading` | Uploading... | උඩුගත කරමින්... | OP-EVD status | Pending |
| `op.evidence.uploaded` | Uploaded | උඩුගත කළා | OP-EVD status | Pending |
| `op.evidence.failed` | Upload failed | උඩුගත කිරීම අසාර්ථකයි | OP-EVD status | Pending |
| `op.review.title` | Review Before Submit | ඉදිරිපත් කිරීමට පෙර සමාලෝචනය | OP-REV header | Pending |
| `op.review.complete` | All items complete | සියලුම අයිතම සම්පූර්ණයි | OP-REV status | Pending |
| `op.review.incomplete` | Incomplete. Please complete all items. | අසම්පූර්ණයි. කරුණාකර සියලුම අයිතම සම්පූර්ණ කරන්න. | OP-REV error | Pending |
| `op.review.failures` | Failures | අසමත් | OP-REV label | Pending |
| `op.review.evidence` | Evidence | සාක්ෂි | OP-REV label | Pending |
| `op.review.attestation` | I certify this record is accurate | මෙම වාර්තාව නිවැරදි බව මම සහතික කරමි | OP-REV checkbox | Pending |
| `op.review.submit` | Submit | ඉදිරිපත් කරන්න | OP-REV button | Pending |
| `op.result.success.title` | Submitted Successfully | සාර්ථකව ඉදිරිපත් කරන ලදී | OP-RES header | Pending |
| `op.result.success.message` | Your checklist has been submitted. | ඔබගේ පරීක්ෂණ ලැයිස්තුව ඉදිරිපත් කර ඇත. | OP-RES text | Pending |
| `op.result.success.record_id` | Record ID | වාර්තා හැඳුනුම්පත | OP-RES label | Pending |
| `op.result.success.view_record` | View Record | වාර්තාව බලන්න | OP-RES button | Pending |
| `op.result.success.back_to_tasks` | Back to Tasks | කාර්යයන් වෙත ආපසු | OP-RES button | Pending |
| `op.result.failure.title` | Submission Failed | ඉදිරිපත් කිරීම අසාර්ථකයි | OP-RES header | Pending |
| `op.result.failure.message` | Could not submit. Please try again. | ඉදිරිපත් කළ නොහැක. කරුණාකර නැවත උත්සාහ කරන්න. | OP-RES text | Pending |
| `op.result.failure.retry` | Retry | නැවත උත්සාහ කරන්න | OP-RES button | Pending |
| `op.record.title` | Record Detail | වාර්තා විස්තර | OP-REC header | Pending |
| `op.record.status.submitted` | Submitted (Awaiting Review) | ඉදිරිපත් කළා (සමාලෝචනය සඳහා රැඳී සිටී) | OP-REC status | Pending |
| `op.record.status.approved` | Approved | අනුමත කළා | OP-REC status | Pending |
| `op.record.status.returned` | Returned for Correction | නිවැරදි කිරීම සඳහා ආපසු යවන ලදී | OP-REC status | Pending |
| `op.more.title` | More | තව | OP-MORE header | Pending |
| `op.more.profile` | Profile | පැතිකඩ | OP-MORE section | Pending |
| `op.more.language` | Language | භාෂාව | OP-MORE section | Pending |
| `op.more.sync_status` | Sync Status | සමමුහුර්ත තත්ත්වය | OP-MORE link | Pending |
| `op.more.logout` | Logout | පිටවීම | OP-MORE button | Pending |
| `op.more.logout_warning` | You have unsaved changes. Logout anyway? | ඔබට නොසුරකින ලද වෙනස්කම් ඇත. කෙසේ වෙතත් පිටවන්නද? | OP-MORE modal | Pending |

---

## SV — Supervisor

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `sv.overview.title` | Supervisor Overview | අධීක්ෂක දළ විශ්ලේෂණය | SV-OVR header | Pending |
| `sv.overview.pending` | Pending Review | සමාලෝචනය රැඳී සිටී | SV-OVR card | Pending |
| `sv.overview.failures` | With Failures | අසමත් සහිත | SV-OVR card | Pending |
| `sv.overview.overdue` | Overdue | කල් ඉකුත් | SV-OVR card | Pending |
| `sv.overview.view_queue` | View Review Queue | සමාලෝචන පෝලිය බලන්න | SV-OVR button | Pending |
| `sv.queue.title` | Review Queue | සමාලෝචන පෝලිය | SV-QUE header | Pending |
| `sv.queue.empty` | No pending reviews | සමාලෝචන රැඳී නැත | SV-QUE empty state | Pending |
| `sv.queue.filter.all` | All | සියල්ල | SV-QUE filter | Pending |
| `sv.queue.filter.failures_only` | Failures Only | අසමත් පමණක් | SV-QUE filter | Pending |
| `sv.queue.filter.overdue` | Overdue | කල් ඉකුත් | SV-QUE filter | Pending |
| `sv.review.title` | Record Review | වාර්තා සමාලෝචනය | SV-REV header | Pending |
| `sv.review.operator` | Operator | ක්‍රියාකරු | SV-REV label | Pending |
| `sv.review.submitted` | Submitted | ඉදිරිපත් කළ දිනය | SV-REV label | Pending |
| `sv.review.failures` | Failures | අසමත් | SV-REV section | Pending |
| `sv.review.evidence` | Evidence | සාක්ෂි | SV-REV section | Pending |
| `sv.review.approve` | Approve | අනුමත කරන්න | SV-REV button | Pending |
| `sv.review.return` | Return for Correction | නිවැරදි කිරීම සඳහා ආපසු යවන්න | SV-REV button | Pending |
| `sv.review.approved` | Record approved successfully | වාර්තාව සාර්ථකව අනුමත කරන ලදී | SV-REV toast | Pending |
| `sv.return.title` | Return for Correction | නිවැරදි කිරීම සඳහා ආපසු යවන්න | SV-RET header | Pending |
| `sv.return.reason` | Reason (required) | හේතුව (අවශ්‍යයි) | SV-RET label | Pending |
| `sv.return.confirm` | Confirm Return | ආපසු යැවීම තහවුරු කරන්න | SV-RET button | Pending |
| `sv.return.returned` | Record returned to operator | වාර්තාව ක්‍රියාකරු වෙත ආපසු යවන ලදී | SV-RET toast | Pending |

---

## QA — QA Officer

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `qa.overview.title` | QA Overview | QA දළ විශ්ලේෂණය | QA-OVR header | Pending |
| `qa.overview.pending` | Pending Verification | සත්‍යාපනය රැඳී සිටී | QA-OVR card | Pending |
| `qa.overview.holds` | Holds | රඳවා ඇති | QA-OVR card | Pending |
| `qa.overview.critical` | Critical Findings | තීරණාත්මක සොයාගැනීම් | QA-OVR card | Pending |
| `qa.overview.view_queue` | View Verification Queue | සත්‍යාපන පෝලිය බලන්න | QA-OVR button | Pending |
| `qa.queue.title` | Verification Queue | සත්‍යාපන පෝලිය | QA-QUE header | Pending |
| `qa.queue.empty` | No pending verifications | සත්‍යාපන රැඳී නැත | QA-QUE empty state | Pending |
| `qa.verification.title` | Record Verification | වාර්තා සත්‍යාපනය | QA-VER header | Pending |
| `qa.verification.operator` | Operator | ක්‍රියාකරු | QA-VER label | Pending |
| `qa.verification.supervisor` | Supervisor | අධීක්ෂක | QA-VER label | Pending |
| `qa.verification.approved_by_supervisor` | Approved by Supervisor | අධීක්ෂක විසින් අනුමත කරන ලදී | QA-VER label | Pending |
| `qa.verification.approval_chain` | Approval Chain | අනුමත දාමය | QA-VER section | Pending |
| `qa.verification.audit_timeline` | Audit Timeline | විගණන කාල රේඛාව | QA-VER section | Pending |
| `qa.verification.verify` | Verify | සත්‍යාපනය කරන්න | QA-VER button | Pending |
| `qa.verification.reject` | Reject | ප්‍රතික්ෂේප කරන්න | QA-VER button | Pending |
| `qa.verification.hold` | Hold | රඳවා තබන්න | QA-VER button | Pending |
| `qa.verification.reinspect` | Reinspect | නැවත පරීක්ෂා කරන්න | QA-VER button | Pending |
| `qa.verification.verified` | Record verified successfully | වාර්තාව සාර්ථකව සත්‍යාපනය කරන ලදී | QA-VER toast | Pending |

---

## AD — Administration

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `ad.shell.title` | Administration | පරිපාලනය | AD-SHL header | Pending |
| `ad.shell.users` | Users | පරිශීලකයින් | AD-SHL nav | Pending |
| `ad.shell.roles` | Roles and Scope | භූමිකාවන් සහ විෂය පථය | AD-SHL nav | Pending |
| `ad.shell.organization` | Organization | සංවිධානය | AD-SHL nav | Pending |
| `ad.shell.audit` | Audit | විගණනය | AD-SHL nav | Pending |
| `ad.users.title` | User Management | පරිශීලක කළමනාකරණය | AD-USR header | Pending |
| `ad.users.add` | Add User | පරිශීලකයා එක් කරන්න | AD-USR button | Pending |
| `ad.users.employee_code` | Employee Code | සේවක කේතය | AD-USR label | Pending |
| `ad.users.name` | Name | නම | AD-USR label | Pending |
| `ad.users.role` | Role | භූමිකාව | AD-USR label | Pending |
| `ad.users.status` | Status | තත්ත්වය | AD-USR label | Pending |
| `ad.users.active` | Active | සක්‍රීය | AD-USR status | Pending |
| `ad.users.inactive` | Inactive | අක්‍රීය | AD-USR status | Pending |
| `ad.users.locked` | Locked | අගුළු වැටුණු | AD-USR status | Pending |
| `ad.users.unlock` | Unlock Account | ගිණුම අගුළු අරින්න | AD-USR button | Pending |

---

## MG — Management

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `mg.kpi.title` | Dashboard | උපකරණ පුවරුව | MG-KPI header | Pending |
| `mg.kpi.completion_rate` | Completion Rate | සම්පූර්ණ කිරීමේ අනුපාතය | MG-KPI card | Pending |
| `mg.kpi.failure_rate` | Failure Rate | අසමත් අනුපාතය | MG-KPI card | Pending |
| `mg.kpi.overdue` | Overdue Tasks | කල් ඉකුත් කාර්යයන් | MG-KPI card | Pending |
| `mg.kpi.critical_alerts` | Critical Alerts | තීරණාත්මක ඇඟවීම් | MG-KPI card | Pending |
| `mg.kpi.proposed` | [PROPOSED] | [යෝජිතය] | MG-KPI badge | Pending |
| `mg.alerts.title` | Critical Alerts | තීරණාත්මක ඇඟවීම් | MG-ALT header | Pending |
| `mg.alerts.empty` | No critical alerts | තීරණාත්මක ඇඟවීම් නැත | MG-ALT empty state | Pending |

---

## AU — Auditor

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `au.search.title` | Audit Search | විගණන සෙවුම | AU-SRC header | Pending |
| `au.search.date_range` | Date Range | දින පරාසය | AU-SRC label | Pending |
| `au.search.site` | Site | ස්ථානය | AU-SRC label | Pending |
| `au.search.operator` | Operator | ක්‍රියාකරු | AU-SRC label | Pending |
| `au.search.search` | Search | සොයන්න | AU-SRC button | Pending |
| `au.history.title` | Audit Event History | විගණන සිදුවීම් ඉතිහාසය | AU-HIS header | Pending |
| `au.history.empty` | No events found | සිදුවීම් හමු නොවීය | AU-HIS empty state | Pending |
| `au.pack.title` | Record Pack | වාර්තා පැකේජය | AU-PCK header | Pending |
| `au.pack.read_only` | Read-Only | කියවීම පමණක් | AU-PCK banner | Pending |
| `au.pack.print` | Print | මුද්‍රණය කරන්න | AU-PCK button | Pending |

---

## Common UI elements

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `common.loading` | Loading... | පූරණය වෙමින්... | Loading state | Pending |
| `common.error` | Error | දෝෂය | Error state | Pending |
| `common.retry` | Retry | නැවත උත්සාහ කරන්න | Error button | Pending |
| `common.cancel` | Cancel | අවලංගු කරන්න | Modal button | Pending |
| `common.confirm` | Confirm | තහවුරු කරන්න | Modal button | Pending |
| `common.save` | Save | සුරකින්න | Form button | Pending |
| `common.back` | Back | ආපසු | Navigation | Pending |
| `common.close` | Close | වසන්න | Modal button | Pending |
| `common.yes` | Yes | ඔව් | Confirmation | Pending |
| `common.no` | No | නැත | Confirmation | Pending |
| `common.offline` | You are offline | ඔබ නොසම්බන්ධයි | Banner | Pending |
| `common.offline.features_unavailable` | Some features are unavailable | සමහර විශේෂාංග නොලැබේ | Banner | Pending |
| `common.success` | Success | සාර්ථකයි | Toast | Pending |
| `common.failed` | Failed | අසාර්ථකයි | Toast | Pending |

---

## Status labels

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `status.not_started` | Not Started | ආරම්භ කර නැත | Task status | Pending |
| `status.in_progress` | In Progress | ක්‍රියාත්මකයි | Task status | Pending |
| `status.submitted` | Submitted | ඉදිරිපත් කළා | Record status | Pending |
| `status.approved` | Approved | අනුමත කළා | Record status | Pending |
| `status.verified` | Verified | සත්‍යාපනය කළා | Record status | Pending |
| `status.returned` | Returned for Correction | නිවැරදි කිරීම සඳහා ආපසු යවන ලදී | Record status | Pending |
| `status.hold` | Hold | රඳවා ඇත | Record status | Pending |
| `status.rejected` | Rejected | ප්‍රතික්ෂේප කළා | Record status | Pending |

---

## Accessibility labels (screen reader only)

| Content Key | EN | Proposed SI | Context | Approval |
| --- | --- | --- | --- | --- |
| `a11y.skip_to_main` | Skip to main content | ප්‍රධාන අන්තර්ගතය වෙත මඟ හරින්න | Skip link | Pending |
| `a11y.menu_toggle` | Toggle menu | මෙනුව ටොගල් කරන්න | Hamburger button | Pending |
| `a11y.password_show` | Show password | මුරපදය පෙන්වන්න | Password toggle | Pending |
| `a11y.password_hide` | Hide password | මුරපදය සඟවන්න | Password toggle | Pending |
| `a11y.loading` | Loading content | අන්තර්ගතය පූරණය වෙමින් | Loading state | Pending |
| `a11y.error_message` | Error message | දෝෂ පණිවිඩය | Error announcement | Pending |

---

## Sample data placeholders (not for translation)

These are **SAMPLE DATA** placeholders and should NOT be translated as they represent data, not UI labels:

- `EMP-XXXX` (employee code placeholder)
- `TASK-XXXX` (task ID placeholder)
- `REC-XXXX` (record ID placeholder)
- `SAMPLE-BATCH-XXX` (batch placeholder)
- `XX.X°C` (temperature placeholder)
- `Sample Site` (site placeholder)
- `Sample Checklist` (checklist placeholder)

---

## Content approval workflow

1. **Linguistic review:** Sinhala linguistic expert reviews proposed translations
2. **Domain review:** Food safety domain expert reviews domain-specific terms
3. **Owner approval:** Business owner approves final content
4. **Status update:** Update Approval Status column to "Approved" after owner sign-off

**Current status:** All content is **Pending** approval.

---

## Next steps

1. Sinhala linguistic review (REQUIRED)
2. Food safety domain term review (REQUIRED)
3. Owner approval (REQUIRED)
4. Update matrix with approved translations
5. Export to i18n format (Django i18n, JSON, or CSV) for implementation

---

**Document status:** Draft pending owner review — Sinhala translations PROPOSED only  
**Approval required before:** Figma screen content finalization  
**Related approval form:** [PHASE_01C_HIGH_FIDELITY_APPROVAL.md](../approvals/PHASE_01C_HIGH_FIDELITY_APPROVAL.md)
