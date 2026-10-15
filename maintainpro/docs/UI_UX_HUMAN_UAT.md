# MaintainPro human UAT pack

Date: 2026-10-12. Branch `fix/ux-confirmed-defects`. No tester has completed this pack. Do not treat an empty sign-off as a pass.

## How to run the remaining manual checks

Use the local web app at `http://127.0.0.1:3011` with the API already running on port 3000. Sign in once per role with the seeded non-production account: `tech@`, `supervisor@`, `manager@`, `inventory@`, `security@`, or `admin@maintainpro.local`. The password is the local seed value. Do not write that password into this file, a screenshot, or a chat.

For each row, record success, time, errors, severity, tester, and Pass or Fail in the table. Leave a cell blank if that check was not done. Do not gate a vehicle, issue stock, approve money, save a setting, or delete a record. If a step needs a write, mark that step NOT TESTED and stop.

Screen-reader checks are separate and are NOT TESTED until someone actually runs a screen reader. Axe results and the accessibility tree do not fill this pack. When a reader is available, start at My Jobs, the work-order drawer, Inventory, Fleet Gate, and Notifications. Listen for the page heading, the selected queue or filter, and whether Escape returns focus to the control that opened the drawer. Record what was heard. Do not invent that result.

Severity: Critical means the task cannot be finished or the wrong record could change. Major means the task can be finished with a workaround. Minor means wording or layout only.

| ID | Role | Start | Task | Expected | Success | Time | Errors | Severity | Tester | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-01 | Technician | My Jobs | Open Overdue and find one assigned job. Do not start it. | The overdue sentence matches assigned, not-finished jobs. Start is visible and unused. | Filter stays `filter=overdue`. | | | | | |
| UAT-02 | Technician | That job | Open the drawer with the keyboard and move across Overview and Assignment. Press Escape. | Focus stays in the drawer, then returns to the list. | No status change. | | | | | |
| UAT-03 | Supervisor | Requests, Triage | Read why a request is in triage. Do not accept it. | Triage includes New, Under Review, and Needs Information. Accepted requests are not in this view. | `view=triage` stays. | | | | | |
| UAT-04 | Manager | Work Orders, Overdue | Read the queue sentence and open one job. Close it with Escape. | The sentence matches the overdue rule. The drawer closes. | No assignment or status write. | | | | | |
| UAT-05 | Manager | Preventive Maintenance, Overdue | Read the overdue definition. Do not pause or evaluate. | The button states which plans are past due. | `due=overdue` stays. | | | | | |
| UAT-06 | Storekeeper | Inventory | Open one part and read snapshot, reserved, and advisory. | Advisory is the ERP snapshot minus reservations. Bileeta remains the stock authority. | No issue, count, or export. | | | | | |
| UAT-07 | Gate officer | Fleet Gate | Select a vehicle and read the readiness line. Type a negative meter only if the field is shown, then clear it. | A blocked vehicle does not offer a movement. A negative meter is described as an error. | No gate in or gate out. | | | | | |
| UAT-08 | Administrator | Notifications | Open one row that names a record. Do not mark it read. | The link text is the next action, not the notifications page itself. | The record opens or the row says there is no linked record. | | | | | |
| UAT-09 | Administrator | Reports, Work orders | Read the completion sentence and the load time. Do not export. | The sentence applies only to that category. The load line says it is not an accounting close. | No file download. | | | | | |
| UAT-10 | Administrator | Settings, Security | Open the Security tab with the keyboard. Do not save. | The address contains `tab=security`. | No profile or password change. | | | | | |
| UAT-11 | Each role above | Administration | Open `/admin`. | Only an administrator stays on the admin console. Others return home. | System Health is not shown unless the product owner has approved that role. | | | | | |

## Sign-off

| Name | Role tested | Date | Result | Notes |
| --- | --- | --- | --- | --- |
| | | | Not started | |
