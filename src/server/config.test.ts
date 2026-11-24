import { assert, describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

describe('parseConfig', () => {
  it('listens on 127.0.0.1:8080 and keeps data in "data" when nothing is set', () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      value: { host: '127.0.0.1', port: 8080, dataDir: 'data' },
    });
  });

  it('reads HOST, PORT and DATA_DIR from the environment', () => {
    expect(
      parseConfig({ HOST: '0.0.0.0', PORT: '3000', DATA_DIR: '/data' }),
    ).toEqual({
      ok: true,
      value: { host: '0.0.0.0', port: 3000, dataDir: '/data' },
    });
  });

  it('rejects an empty DATA_DIR, naming the variable', () => {
    const result = parseConfig({ DATA_DIR: '' });

    assert(!result.ok);
    expect(result.error).toContain('DATA_DIR');
  });

  it('rejects a PORT outside the TCP port range, naming the variable', () => {
    const result = parseConfig({ PORT: '80800' });

    assert(!result.ok);
    expect(result.error).toContain('PORT');
  });

  it('rejects a HOST that is not an IPv4 address, naming the variable', () => {
    const result = parseConfig({ HOST: 'localhost' });

    assert(!result.ok);
    expect(result.error).toContain('HOST');
  });
});
