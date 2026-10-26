import 'reflect-metadata';
import {
  ChartSource,
  FitPreference,
  MeasurementType,
} from '../dto/size-chart.dto';
import { SizeChart } from '../schemas/size-chart.schema';
import { Measurements, recommendSize } from './size-recommendation.engine';

function bodyChart(): SizeChart {
  return {
    source: ChartSource.Manual,
    sourceRevision: 1,
    version: 2,
    status: 'CONFIRMED',
    measurementType: MeasurementType.Body,
    lengthUnit: 'CM',
    weightUnit: 'KG',
    fitRules: [],
    requiredMeasurements: ['chest', 'waist', 'hip'],
    rows: [
      {
        size: 'M',
        chest: { min: 86, max: 89 },
        waist: { min: 68, max: 71 },
        hip: { min: 92, max: 95 },
      },
      {
        size: 'L',
        chest: { min: 90, max: 93 },
        waist: { min: 72, max: 75 },
        hip: { min: 96, max: 99 },
      },
    ],
  };
}
const measurements: Measurements = { chest: 87, waist: 70, hip: 94 };
const run = (chart: SizeChart, body: Measurements) =>
  recommendSize(
    chart,
    chart.rows.map((row) => row.size),
    body,
  );
describe('deterministic product-specific size recommendation', () => {
  it('matches all body constraints and explains each one', () => {
    const result = run(bodyChart(), measurements);
    expect(result).toMatchObject({
      status: 'MATCH',
      recommendedSize: 'M',
      candidates: ['M'],
      chartVersion: 2,
    });
    expect(result.evaluations[0].reasons).toHaveLength(3);
  });
  it('never uses majority vote when waist and other dimensions fall in different sizes', () => {
    expect(run(bodyChart(), { ...measurements, waist: 74 })).toMatchObject({
      status: 'NO_MATCH',
      recommendedSize: null,
      candidates: [],
    });
  });
  it.each([{ chest: 89.01 }, { waist: 71.01 }, { hip: 95.01 }])(
    'rejects a size if a single dimension exceeds its maximum: %j',
    (changed) => {
      const result = run(bodyChart(), { ...measurements, ...changed });
      expect(result.evaluations[0].outcome).toBe('REJECTED');
      expect(result.candidates).not.toContain('M');
    },
  );
  it('accepts exact inclusive boundaries without rounding the input', () => {
    expect(
      run(bodyChart(), { chest: 86, waist: 71, hip: 92 }).recommendedSize,
    ).toBe('M');
  });
  it('returns all matching labels without choosing the smallest or majority label', () => {
    const chart = bodyChart();
    chart.rows[1] = { ...chart.rows[0], size: 'L' };
    expect(run(chart, measurements)).toMatchObject({
      status: 'MULTIPLE_MATCHES',
      recommendedSize: null,
      candidates: ['M', 'L'],
    });
  });
  it('does not force a nearest size when none fits', () => {
    const result = run(bodyChart(), { chest: 150, waist: 120, hip: 140 });
    expect(result).toMatchObject({
      status: 'NO_MATCH',
      recommendedSize: null,
      candidates: [],
    });
    expect(result.closestSizes).toHaveLength(2);
  });
  it('uses body circumferences as fit constraints and keeps height/weight as references', () => {
    const chart = bodyChart();
    chart.rows[0].height = { min: 160, max: 165 };
    chart.rows[0].weight = { min: 50, max: 55 };
    chart.rows[1].height = { min: 165, max: 170 };
    chart.rows[1].weight = { min: 55, max: 60 };
    const result = run(chart, {
      chest: 87,
      waist: 70,
      hip: 94,
      height: 175,
      weight: 65,
    });
    expect(result).toMatchObject({ status: 'MATCH', recommendedSize: 'M' });
    expect(result.evaluations[0].reasons.join(' ')).toContain(
      'ngoài khoảng tham khảo',
    );
    expect(result.evaluations[0].referenceOutliers).toEqual(['height', 'weight']);
    expect(result.warnings.join(' ')).toContain('chiều cao hoặc cân nặng');
  });
  it('ranks conflicting body measurements for explanation without applying a size', () => {
    const chart = bodyChart();
    chart.rows = [
      {
        size: 'S',
        chest: { min: 80, max: 84 },
        waist: { min: 62, max: 66 },
        hip: { min: 86, max: 90 },
      },
      {
        size: 'M',
        chest: { min: 84, max: 88 },
        waist: { min: 66, max: 70 },
        hip: { min: 90, max: 94 },
      },
    ];
    const result = run(chart, { chest: 83, waist: 68, hip: 92 });
    expect(result).toMatchObject({
      status: 'NO_MATCH',
      recommendedSize: null,
      candidates: [],
      closestSizes: ['M', 'S'],
    });
    expect(
      result.evaluations.find((row) => row.size === 'M')?.reasons.join(' '),
    ).toContain('lệch 1 cm');
  });
  it('returns insufficient data for missing/invalid measurements instead of inventing them', () => {
    for (const hip of [undefined, null, NaN, Infinity, 0])
      expect(run(bodyChart(), { ...measurements, hip })).toMatchObject({
        status: 'INSUFFICIENT_DATA',
        recommendedSize: null,
        missingMeasurements: ['hip'],
      });
  });
  it('does not request an absent optional circumference, but checks it when provided', () => {
    const chart = bodyChart();
    chart.requiredMeasurements = ['chest'];
    expect(run(chart, { chest: 87 })).toMatchObject({
      status: 'MATCH',
      recommendedSize: 'M',
      missingMeasurements: [],
    });
    expect(run(chart, { chest: 87, waist: 74 })).toMatchObject({
      status: 'NO_MATCH',
      recommendedSize: null,
    });
  });
  it('checks optional áo dài shoulder width and upper arm only when chart and customer both provide them', () => {
    const chart = bodyChart();
    chart.rows[0].shoulder = { min: 38, max: 40 };
    chart.rows[0].bicep = { min: 27, max: 30 };
    expect(run(chart, measurements).recommendedSize).toBe('M');
    const result = run(chart, { ...measurements, shoulder: 41, bicep: 28 });
    expect(result.status).toBe('NO_MATCH');
    expect(result.evaluations[0].violations).toContainEqual(
      expect.objectContaining({ measurement: 'shoulder', deviation: 1 }),
    );
  });
  it('does not ask for more data if known dimensions already reject every size', () => {
    const result = run(bodyChart(), { chest: 150 });
    expect(result).toMatchObject({
      status: 'NO_MATCH',
      missingMeasurements: [],
      recommendedSize: null,
    });
  });
  it('does not trust a claimed confirmed chart with missing required row data', () => {
    const chart = bodyChart();
    delete chart.rows[0].waist;
    expect(run(chart, measurements).status).toBe('UNAVAILABLE');
  });
  it('rejects missing, draft and stale-size charts', () => {
    expect(recommendSize(null, ['M'], measurements).status).toBe('UNAVAILABLE');
    expect(run({ ...bodyChart(), status: 'DRAFT' }, measurements).status).toBe(
      'UNAVAILABLE',
    );
    expect(
      recommendSize(bodyChart(), ['M', 'L', 'XL'], measurements).status,
    ).toBe('UNAVAILABLE');
  });
  it('supports custom provider size labels and different measurements for the same size name', () => {
    const first = bodyChart();
    first.rows = [{ ...first.rows[0], size: 'NAM-01' }];
    expect(run(first, measurements).recommendedSize).toBe('NAM-01');
    const other = bodyChart();
    other.rows[0].waist = { min: 60, max: 65 };
    expect(run(other, measurements).candidates).not.toContain('M');
  });
  it('converts inch and pound values before comparison', () => {
    const chart = bodyChart();
    chart.lengthUnit = 'IN';
    chart.weightUnit = 'LB';
    chart.rows = [
      {
        size: 'CUSTOM-LABEL',
        chest: { min: 34, max: 35 },
        waist: { min: 27, max: 28 },
        hip: { min: 36, max: 38 },
        weight: { min: 110, max: 120 },
      },
    ];
    expect(
      run(chart, { chest: 86.36, waist: 70, hip: 94, weight: 50 }).status,
    ).toBe('MATCH');
  });
  it('only provides height/weight preliminary candidates when both ranges exist', () => {
    const chart = bodyChart();
    chart.rows[0].height = { min: 160, max: 170 };
    chart.rows[0].weight = { min: 50, max: 60 };
    expect(run(chart, { height: 165, weight: 55 })).toMatchObject({
      status: 'PRELIMINARY',
      candidates: ['M'],
      recommendedSize: null,
    });
    delete chart.rows[0].weight;
    expect(run(chart, { height: 165, weight: 55 }).status).toBe(
      'INSUFFICIENT_DATA',
    );
  });
  it('does not hide a known circumference mismatch behind height/weight preliminary matching', () => {
    const chart = bodyChart();
    chart.rows[0].height = { min: 160, max: 170 };
    chart.rows[0].weight = { min: 50, max: 60 };
    expect(
      run(chart, { height: 165, weight: 55, chest: 100 }).candidates,
    ).not.toContain('M');
  });
  it('a chart with only height and weight remains preliminary, even with supplied circumferences', () => {
    const chart = bodyChart();
    chart.requiredMeasurements = ['height', 'weight'];
    chart.rows = [
      {
        size: 'M',
        height: { min: 160, max: 170 },
        weight: { min: 50, max: 60 },
      },
    ];
    const result = run(chart, { ...measurements, height: 165, weight: 55 });
    expect(result).toMatchObject({ status: 'PRELIMINARY', recommendedSize: null, missingMeasurements: [] });
    expect(result.warnings.join(' ')).toContain('Bảng chỉ có chiều cao/cân nặng');
  });
  it('does not guess a bigger size based on body-chart fit preference', () => {
    expect(
      run(bodyChart(), {
        ...measurements,
        fitPreference: FitPreference.Comfort,
      }).recommendedSize,
    ).toBe('M');
  });
  it('does not silently ignore missing optional circumference constraints on another row', () => {
    const chart = bodyChart();
    chart.requiredMeasurements = ['chest'];
    delete chart.rows[0].waist;
    const result = run(chart, measurements);
    expect(result.candidates).not.toContain('M');
    expect(result.missingChartMeasurements).toContain('waist');
  });
});
describe('garment measurements and explicitly declared allowance', () => {
  function garment(): SizeChart {
    const chart = bodyChart();
    chart.measurementType = MeasurementType.Garment;
    chart.rows = [
      {
        size: 'A',
        chest: { min: 89, max: 90 },
        waist: { min: 72, max: 73 },
        hip: { min: 96, max: 97 },
      },
    ];
    chart.fitRules = [
      {
        preference: FitPreference.Regular,
        chest: { min: 1, max: 3 },
        waist: { min: 1, max: 3 },
        hip: { min: 1, max: 3 },
      },
    ];
    return chart;
  }
  it('compares garment minus body circumference with declared allowance', () => {
    expect(
      run(garment(), { ...measurements, fitPreference: FitPreference.Regular })
        .recommendedSize,
    ).toBe('A');
  });
  it('requires a user preference and a declared rule instead of defaulting to regular', () => {
    expect(run(garment(), measurements).status).toBe('INSUFFICIENT_DATA');
    expect(
      run(garment(), { ...measurements, fitPreference: FitPreference.Comfort })
        .status,
    ).toBe('INSUFFICIENT_DATA');
  });
  it('rejects if any part of a garment measurement range exceeds the allowed ease', () => {
    const chart = garment();
    chart.rows[0].chest = { min: 89, max: 92 };
    const result = run(chart, {
      ...measurements,
      fitPreference: FitPreference.Regular,
    });
    expect(result.status).toBe('NO_MATCH');
    expect(result.evaluations[0].violations).toContainEqual(
      expect.objectContaining({
        measurement: 'chest',
        kind: 'GARMENT_EASE',
        coverage: 'PARTIAL_OVERLAP',
        actual: { min: 2, max: 5 },
        expected: { min: 1, max: 3 },
      }),
    );
  });
  it('distinguishes no ease overlap from partial overlap', () => {
    const chart = garment();
    chart.rows[0].chest = { min: 100, max: 101 };
    const result = run(chart, {
      ...measurements,
      fitPreference: FitPreference.Regular,
    });
    expect(result.evaluations[0].violations[0].coverage).toBe('NO_FIT');
  });
  it('requires declared shoulder ease before using a garment shoulder range', () => {
    const chart = garment();
    chart.rows[0].shoulder = { min: 40, max: 42 };
    expect(run(chart, { ...measurements, shoulder: 39, fitPreference: FitPreference.Regular }).status).toBe('UNAVAILABLE');
    chart.fitRules[0].shoulder = { min: 1, max: 3 };
    expect(run(chart, { ...measurements, shoulder: 39, fitPreference: FitPreference.Regular }).status).toBe('MATCH');
  });
  it('supports explicitly declared negative ease but never fabricates stretch capacity', () => {
    const chart = garment();
    chart.rows[0].chest = { min: 85, max: 86 };
    chart.fitRules[0].chest = { min: -2, max: 0 };
    chart.stretchAllowanceCm = { chest: 2 };
    expect(
      run(chart, { ...measurements, fitPreference: FitPreference.Regular })
        .status,
    ).toBe('MATCH');
    chart.stretchAllowanceCm = {};
    expect(
      run(chart, { ...measurements, fitPreference: FitPreference.Regular })
        .status,
    ).toBe('UNAVAILABLE');
  });
  it('keeps garment length separate from user height', () => {
    const chart = garment();
    chart.rows[0].length = { min: 130, max: 131 };
    const result = run(chart, {
      ...measurements,
      height: 165,
      fitPreference: FitPreference.Regular,
    });
    expect(result.status).toBe('MATCH');
    expect(result.warnings.join(' ')).toContain('Chiều dài áo');
  });
  it('does not reject declared garment ease because height is outside a reference range', () => {
    const chart = garment();
    chart.rows[0].height = { min: 160, max: 165 };
    expect(
      run(chart, {
        ...measurements,
        height: 175,
        fitPreference: FitPreference.Regular,
      }),
    ).toMatchObject({ status: 'MATCH', recommendedSize: 'A' });
  });
});
