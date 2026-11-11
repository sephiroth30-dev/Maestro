jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/config/redis', () => ({ flushReportesCache: jest.fn() }));
jest.mock('../../src/connectors/rest.connector', () => ({ RestConfigSchema: {} }));
jest.mock('../../src/services/normalizacion.service', () => ({ normalizeDescripcion: (s: string) => s }));
jest.mock('../../src/services/connector.service', () => ({ connectorService: {} }));
jest.mock('../../src/services/sync-lock.service', () => ({ adquirirCandadoSync: jest.fn() }));
jest.mock('../../src/services/sheet-atencion-mapper', () => ({ buildCache: jest.fn(), resolveId: jest.fn(), resolveServicioId: jest.fn() }));
jest.mock('../../src/repositories/agenda.repo', () => ({}));

import { statusDe } from '../../src/services/citas-sync.service';

describe('código HTTP de un error del conector', () => {
  it('un 403 de la consulta es falta de permiso', () => {
    expect(statusDe('REST API error: HTTP 403 Forbidden — Usuario no tiene permiso de consulta de agenda de citas (01010202).')).toBe(403);
  });

  it('un fallo del LOGIN no cuenta: no es el permiso de la consulta', () => {
    expect(statusDe('Login falló: HTTP 403 Forbidden')).toBeNull();
    expect(statusDe('Login falló: HTTP 401 Unauthorized')).toBeNull();
  });

  it('sin código, nulo', () => {
    expect(statusDe('ECONNREFUSED')).toBeNull();
  });
});
