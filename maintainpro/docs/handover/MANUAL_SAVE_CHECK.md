# Manual save check

Tick by hand. Reload the page before marking the row. Currency LKR. Phone samples use +94. Default tax on the quote row is 18.

| # | Role | Steps | Expected after reload | |
| --- | --- | --- | --- | --- |
| 1 | MANAGER | Create a work order for a Colombo asset. Save. | The new work order is still in the list with the same title and asset. | ☐ |
| 2 | MANAGER | Open that work order and assign a technician. Save. | Assignee is the same technician. | ☐ |
| 3 | TECHNICIAN | Start the work order. Put it on hold. Resume it. | Status is in progress, and the hold then resume are still in the history. | ☐ |
| 4 | TECHNICIAN | Complete the work order with one before photo and one after photo. | Status is completed and both photos are still attached. | ☐ |
| 5 | MANAGER | Verify the completed work order and close it. | Status is closed. | ☐ |
| 6 | MANAGER | Cancel a different open work order and enter a reason. | Status is cancelled and the reason is still shown. | ☐ |
| 7 | ADMIN | On Approvals, approve one item and reject another with a reason. | Approved item stays approved. Rejected item stays rejected with the reason. | ☐ |
| 8 | TECHNICIAN then INVENTORY_KEEPER | Request a part on an open work order. Issue that part from stock. | The request is still there and the issue has reduced the on-hand quantity. | ☐ |
| 9 | TECHNICIAN | Enter a meter reading higher than the previous reading. Save. | The new reading is the latest value for that meter. | ☐ |
| 10 | MANAGER | Create a vendor quote with tax 18 and a line amount in LKR. Save. | Quote reopens with tax 18 and the same LKR amounts. | ☐ |
| 11 | ADMIN | Create an asset under Admin → Assets. Upload a tag file on `/admin/asset-tags` and apply it. | Asset still exists and shows the uploaded tag. | ☐ |
| 12 | ADMIN | Create a user on `/admin/users` and assign a role on `/admin/roles`. | User still exists and still has that role. | ☐ |
