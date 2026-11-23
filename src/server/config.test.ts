import { assert, describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

describe('parseConfig', () => {
  it('listens on 127.0.0.1:8080 when HOST and PORT are unset', () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      value: { host: '127.0.0.1', port: 8080 },
    });
  });

  it('reads HOST and PORT from the environment', () => {
    expect(parseConfig({ HOST: '0.0.0.0', PORT: '3000' })).toEqual({
      ok: true,
      value: { host: '0.0.0.0', port: 3000 },
    });
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
