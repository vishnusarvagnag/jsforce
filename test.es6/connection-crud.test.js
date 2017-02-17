import test from './util/ava/ext';
import ConnectionManager from './helper/connection-manager';
import config from './config';
import { isObject } from './util';

const connMgr = new ConnectionManager(config);
const conn = connMgr.createConnection();

/**
 *
 */
test.before('establish connection', async () => {
  await connMgr.establishConnection(conn);
});

/**
 *
 */
test.group('single record crud', (test) => {
  let accountId;
  let account;

  //
  test.serial('create account and get created obj', async (t) => {
    const ret = await conn.sobject('Account').create({ Name: 'Hello' });
    t.true(ret.success);
    t.true(typeof ret.id === 'string');
    accountId = ret.id;
  });

  //
  test.serial('retrieve account and return a record', async (t) => {
    const record = await conn.sobject('Account').retrieve(accountId);
    t.true(typeof record.Id === 'string');
    t.true(isObject(record.attributes));
    account = record;
  });

  //
  test.serial('update account, get successful result, and retrieve the updated record', async (t) => {
    const ret = await conn.sobject('Account').record(account.Id).update({ Name: 'Hello2' });
    t.true(ret.success);
    const record = await conn.sobject('Account').record(accountId).retrieve();
    t.true(record.Name === 'Hello2');
    t.true(isObject(record.attributes));
  });

  //
  test.serial('update account with options headers, get successfull result, and retrieve the updated record', async (t) => {
    const options = {
      headers: {
        'SForce-Auto-Assign': 'FALSE',
      },
    };
    const ret = await conn.sobject('Account').record(account.Id).update({ Name: 'Hello3' }, options);
    t.true(ret.success);
    const record = await conn.sobject('Account').record(accountId).retrieve(options);
    t.true(record.Name === 'Hello3');
    t.true(isObject(record.attributes));
  });
});

/**
 *
 */
test.group('multiple records crud', (test) => {
  let accountIds;
  let accounts;

  //
  test.serial('create multiple accounts and get successfull results', async (t) => {
    const rets = await conn.sobject('Account').create([
      { Name: 'Account #1' },
      { Name: 'Account #2' },
    ]);
    t.true(Array.isArray(rets));
    rets.forEach((ret) => {
      t.true(ret.success);
      t.true(typeof ret.id === 'string');
      accountIds = rets.map(({ id }) => id);
    });
  });

  //
  test.serial('retrieve multiple accounts and get specified records', async (t) => {
    const records = await conn.sobject('Account').retrieve(accountIds);
    t.true(Array.isArray(records));
    records.forEach((record, i) => {
      t.true(typeof record.Id === 'string');
      t.true(isObject(record.attributes));
      t.true(record.Name === `Account #${i + 1}`);
    });
    accounts = records;
  });

  //
  test.serial('update multiple accounts, get successfull results, and get updated records', async (t) => {
    const rets = await conn.sobject('Account').update(
      accounts.map(({ Id, Name }) => ({ Id, Name: `Updated ${Name}` })),
    );
    t.true(Array.isArray(rets));
    rets.forEach((ret) => {
      t.true(ret.success);
    });
    const records = await conn.sobject('Account').retrieve(accountIds);
    t.true(Array.isArray(records));
    records.forEach((record, i) => {
      t.true(record.Name === `Updated Account #${i + 1}`);
      t.true(isObject(record.attributes));
    });
  });

  //
  test.serial('delete multiple accounts, get successfull results, and not get any records', async (t) => {
    const rets = await conn.sobject('Account').destroy(accountIds);
    t.true(Array.isArray(rets));
    rets.forEach((ret) => {
      t.true(ret.success);
    });
    try {
      await conn.sobject('Account').retrieve(accountIds);
      t.fail();
    } catch (err) {
      t.true(err instanceof Error);
      t.true(err.errorCode === 'NOT_FOUND');
    }
  });
});


/**
 *
 */
test.group('upsert', (test) => {
  const extId = `ID${Date.now()}`;
  let recId;
  //
  test.serial('upsert not exisiting record and get successfull result', async (t) => {
    const rec = { Name: 'New Record', [config.upsertField]: extId };
    const ret = await conn.sobject(config.upsertTable).upsert(rec, config.upsertField);
    t.true(ret.success);
    t.true(typeof ret.id === 'string');
    recId = ret.id;
  });

  test.serial('upsert already existing record, get successfull result, and get updated record', async (t) => {
    const rec = { Name: 'Updated Record', [config.upsertField]: extId };
    const ret = await conn.sobject(config.upsertTable).upsert(rec, config.upsertField);
    t.true(ret.success);
    t.true(typeof ret.id === 'undefined');
    const record = await conn.sobject(config.upsertTable).retrieve(recId);
    t.true(record.Name === 'Updated Record');
  });

  test.serial('upsert duplicated external id record and get multiple choise error', async (t) => {
    const rec1 = { Name: 'Duplicated Record', [config.upsertField]: extId };
    await conn.sobject(config.upsertTable).create(rec1);
    try {
      const rec2 = { Name: 'Updated Record, Twice', [config.upsertField]: extId };
      await conn.sobject(config.upsertTable).upsert(rec2, config.upsertField);
      t.fail();
    } catch (err) {
      t.true(err instanceof Error);
      t.true(err.name === 'MULTIPLE_CHOICES');
      t.true(Array.isArray(err.content));
      t.true(typeof err.content[0] === 'string');
    }
  });
});

/**
 *
 */
test.after('close connection', async () => {
  await connMgr.closeConnection(conn);
});
