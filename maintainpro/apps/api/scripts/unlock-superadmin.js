db = db.getSiblingDB('nelna');
db.User.updateOne(
  { email: 'superadmin@maintainpro.local' },
  { $set: { failedLoginAttempts: NumberInt(0), lockedUntil: null } },
);
printjson(db.User.findOne({ email: 'superadmin@maintainpro.local' }, { failedLoginAttempts: 1, lockedUntil: 1 }));
