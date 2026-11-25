import { assert, describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

const ALLOWED_USERS = 'alex@example.com=alex';

describe('parseConfig', () => {
  it('listens on 127.0.0.1:8080, keeps data in "data" and reports version dev when only ALLOWED_USERS is set', () => {
    expect(parseConfig({ ALLOWED_USERS })).toEqual({
      ok: true,
      value: {
        host: '127.0.0.1',
        port: 8080,
        dataDir: 'data',
        allowedUsers: new Map([['alex@example.com', 'alex']]),
        devUser: undefined,
        version: 'dev',
      },
    });
  });

  it('reads HOST, PORT, DATA_DIR and GIT_SHA from the environment', () => {
    expect(
      parseConfig({
        HOST: '0.0.0.0',
        PORT: '3000',
        DATA_DIR: '/data',
        GIT_SHA: '0123456789abcdef0123456789abcdef01234567',
        ALLOWED_USERS,
      }),
    ).toEqual({
      ok: true,
      value: {
        host: '0.0.0.0',
        port: 3000,
        dataDir: '/data',
        allowedUsers: new Map([['alex@example.com', 'alex']]),
        devUser: undefined,
        version: '0123456789abcdef0123456789abcdef01234567',
      },
    });
  });

  it('rejects an empty DATA_DIR, naming the variable', () => {
    const result = parseConfig({ DATA_DIR: '', ALLOWED_USERS });

    assert(!result.ok);
    expect(result.error).toContain('DATA_DIR');
  });

  // An image built with an empty GIT_SHA would otherwise report no version.
  it('rejects an empty GIT_SHA, naming the variable', () => {
    const result = parseConfig({ GIT_SHA: '', ALLOWED_USERS });

    assert(!result.ok);
    expect(result.error).toContain('GIT_SHA');
  });

  it('rejects a PORT outside the TCP port range, naming the variable', () => {
    const result = parseConfig({ PORT: '80800', ALLOWED_USERS });

    assert(!result.ok);
    expect(result.error).toContain('PORT');
  });

  it('rejects a HOST that is not an IPv4 address, naming the variable', () => {
    const result = parseConfig({ HOST: 'localhost', ALLOWED_USERS });

    assert(!result.ok);
    expect(result.error).toContain('HOST');
  });
});

describe('parseConfig with ALLOWED_USERS', () => {
  it('maps each login, trimmed and in lowercase, to its trimmed short name', () => {
    const result = parseConfig({
      ALLOWED_USERS: ' Alex@Example.com = alex , sam@example.com=sam-2 ',
    });

    assert(result.ok);
    expect(result.value.allowedUsers).toEqual(
      new Map([
        ['alex@example.com', 'alex'],
        ['sam@example.com', 'sam-2'],
      ]),
    );
  });

  it('splits each pair at its last "=", because a login may contain one', () => {
    const result = parseConfig({ ALLOWED_USERS: 'a=b@example.com=ab' });

    assert(result.ok);
    expect(result.value.allowedUsers).toEqual(
      new Map([['a=b@example.com', 'ab']]),
    );
  });

  it('keeps logins such as constructor and __proto__ as ordinary entries', () => {
    const result = parseConfig({
      ALLOWED_USERS: 'constructor=one,__proto__=two',
    });

    assert(result.ok);
    expect([...result.value.allowedUsers]).toEqual([
      ['constructor', 'one'],
      ['__proto__', 'two'],
    ]);
  });

  it.each([
    { case: 'a missing', value: undefined },
    { case: 'an empty', value: '' },
    { case: 'a blank', value: '  ' },
  ])(
    'rejects $case ALLOWED_USERS with a message that says what to set',
    ({ value }) => {
      const result = parseConfig({ ALLOWED_USERS: value });

      assert(!result.ok);
      expect(result.error).toBe(
        '✖ Set ALLOWED_USERS to the allowed Tailscale logins, each with a short name, as comma-separated login=shortname pairs, such as alex@example.com=alex,sam@example.com=sam\n  → at ALLOWED_USERS',
      );
    },
  );

  // Entries are email addresses, and main.ts logs the error (SEC-7).
  it.each([
    { case: 'without "="', entry: 'sam@example.com' },
    { case: 'without a login', entry: '=sam' },
    { case: 'without a short name', entry: 'sam@example.com=' },
    { case: 'that is empty', entry: '' },
  ])(
    'rejects an entry $case, naming its position but not its text',
    ({ entry }) => {
      const result = parseConfig({
        ALLOWED_USERS: `alex@example.com=alex,${entry}`,
      });

      assert(!result.ok);
      expect(result.error).toBe(
        "✖ Entry 2 isn't a login=shortname pair\n  → at ALLOWED_USERS",
      );
    },
  );

  it('rejects a short name with characters other than lowercase letters, digits and hyphens', () => {
    const result = parseConfig({ ALLOWED_USERS: 'alex@example.com=Alex_1' });

    assert(!result.ok);
    expect(result.error).toBe(
      '✖ Entry 1 has a short name with characters other than lowercase letters, digits and hyphens\n  → at ALLOWED_USERS',
    );
  });

  it('rejects a login that is listed twice, in any case, naming both positions', () => {
    const result = parseConfig({
      ALLOWED_USERS:
        'alex@example.com=alex,sam@example.com=sam,ALEX@example.com=al',
    });

    assert(!result.ok);
    expect(result.error).toBe(
      '✖ Entry 3 repeats the login in entry 1\n  → at ALLOWED_USERS',
    );
  });
});

describe('parseConfig with NODE_ENV and DEV_USER', () => {
  it('reads DEV_USER, trimmed and in lowercase, when NODE_ENV is development', () => {
    const result = parseConfig({
      NODE_ENV: 'development',
      ALLOWED_USERS,
      DEV_USER: ' Alex@Example.com ',
    });

    assert(result.ok);
    expect(result.value.devUser).toBe('alex@example.com');
  });

  it('rejects DEV_USER in a production config', () => {
    const result = parseConfig({
      NODE_ENV: 'production',
      ALLOWED_USERS,
      DEV_USER: 'alex@example.com',
    });

    assert(!result.ok);
    expect(result.error).toBe(
      '✖ DEV_USER works only when NODE_ENV is development\n  → at DEV_USER',
    );
  });

  it('rejects DEV_USER when NODE_ENV is unset, because it defaults to production', () => {
    const result = parseConfig({ ALLOWED_USERS, DEV_USER: 'alex@example.com' });

    assert(!result.ok);
    expect(result.error).toBe(
      '✖ DEV_USER works only when NODE_ENV is development\n  → at DEV_USER',
    );
  });

  it('rejects a DEV_USER that is not on ALLOWED_USERS, without naming it', () => {
    const result = parseConfig({
      NODE_ENV: 'development',
      ALLOWED_USERS,
      DEV_USER: 'sam@example.com',
    });

    assert(!result.ok);
    expect(result.error).toBe(
      '✖ DEV_USER must be one of the logins in ALLOWED_USERS\n  → at DEV_USER',
    );
  });

  it('rejects a NODE_ENV other than development or production, naming the variable', () => {
    const result = parseConfig({ NODE_ENV: 'test', ALLOWED_USERS });

    assert(!result.ok);
    expect(result.error).toContain('NODE_ENV');
  });
});
