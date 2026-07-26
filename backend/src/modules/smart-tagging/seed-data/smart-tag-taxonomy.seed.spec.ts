import * as fs from 'fs';
import * as path from 'path';

interface SmartTagSeedDefinition {
  code: string;
  entityTypes: string[];
  displayConfig: { color: string; backgroundColor: string };
}

describe('default smart tag taxonomy seed data', () => {
  it('contains unique, valid bootstrap definitions', () => {
    const filePath = path.resolve(
      process.cwd(),
      'scripts/data/smart-tag-taxonomy.default.json',
    );
    const definitions = JSON.parse(
      fs.readFileSync(filePath, 'utf8'),
    ) as SmartTagSeedDefinition[];
    const codes = definitions.map((definition) => definition.code);

    expect(definitions).toHaveLength(11);
    expect(new Set(codes).size).toBe(definitions.length);
    expect(
      definitions.every((definition) => definition.entityTypes.length > 0),
    ).toBe(true);
    expect(
      definitions.every(
        (definition) =>
          definition.displayConfig.color &&
          definition.displayConfig.backgroundColor,
      ),
    ).toBe(true);
  });
});
