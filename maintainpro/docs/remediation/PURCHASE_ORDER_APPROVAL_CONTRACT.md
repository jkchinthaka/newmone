# Purchase Order Approval Contract

- Operational approval uses assertMakerCheckerSeparation against createdById.
- Finance approval also maker-checker + blocks same actor as operational unless admin override reason.
- Notifications target creator (createdById) when set.