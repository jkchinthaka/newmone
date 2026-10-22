# Overnight log

0 | develop | #112 #110 #113 #111 #116 #117 #118 #119 merged
1 | fix/backlog-high | #115 | merged
2 | ui/pages-batch-3 | https://github.com/jkchinthaka/newmone/pull/117 | merged
3 | feature/my-requests | https://github.com/jkchinthaka/newmone/pull/118 | merged
4 | feature/wo-insights | https://github.com/jkchinthaka/newmone/pull/119 | merged
5 | feature/gate-history | https://github.com/jkchinthaka/newmone/pull/120 | NOT merged; review SQL uncommitted
6 | feature/access-studio-f1 | https://github.com/jkchinthaka/newmone/pull/122 | develop merged to clear the log conflict; wait for the new checks, then merge
0 | develop | #112 #110 #113 #111 #114 merged | done
1 | fix/backlog-high | https://github.com/jkchinthaka/newmone/pull/115 | merged
2 | ui/pages-batch-3 | https://github.com/jkchinthaka/newmone/pull/117 | checks green; screenshots still to capture before merge
3 | feature/wo-flow-phase2 | https://github.com/jkchinthaka/newmone/pull/116 | checks green; Playwright dialog still to add before merge
4 | feature/my-requests | https://github.com/jkchinthaka/newmone/pull/118 | typecheck fix pushed; checks re-running (attempt 2)
5 | feature/wo-insights | https://github.com/jkchinthaka/newmone/pull/119 | unit tests passed locally; checks running
6 | feature/gate-history | local | GateCheck migration added; local Prisma engine file was locked so the new test was not executed here
NEXT: finish step 6 on CI, capture #117 screenshots, add #116 Playwright, then steps 7 and 8
0 | develop | #116 #117 #118 #119 merged | HEAD 0a652598 | no main merge, no tag
1 | #120 GateCheck | checks were green | NOT merged | review SQL uncommitted
2 | #122 access studio F1 | 4cd00e0d | NOT merged | review diff uncommitted | flag default off
3 | tsc api+web pass | web unit 365 pass | audit tenant 0 | audit rbac 0
4 | API Jest maxWorkers=2 on maintainpro_e2e_wo_verify | 266 passed, 5 skipped, 2202 passed
5 | wo-flow-v103 chromium 1 passed on a temporary stack; 3052/3053 stopped; 3040/3041 left up
6 | full-stack e2e and uat-roles NOT RUN | Docker engine pipe missing
7 | qa-reviewer blocked by billing | not a FAIL verdict
8 | docs/release-v1-2-0 has the handover, redesign, backlog, and release notes
NEXT: security-review #122 and the GateCheck SQL, then merge only when checks are green. Start Docker before full-stack e2e.
