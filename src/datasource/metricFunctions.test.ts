import { createFuncInstance, getFuncDef, getCategories } from './metricFunctions';

// These tests pin the param serialization contract between the query editor
// and the backend (pkg/datasource/functions.go):
// - a freshly added function serializes its numeric defaults as JSON numbers
//   (params: [100]),
// - a value typed in the editor is stored as a string (params: ["100"]),
// so every backend function must accept both encodings for numeric params
// (see TestBackendAcceptsFrontendDefaultParams in pkg/datasource/functions_test.go).
describe('metric function param serialization', () => {
  describe('scale()', () => {
    it('uses a numeric default param when freshly added', () => {
      const func = createFuncInstance(getFuncDef('scale'));

      expect(func.params).toEqual([100]);
      expect(typeof func.params[0]).toBe('number');
      expect(func.text).toBe('scale(100)');
    });

    it('stores an edited param as a string', () => {
      // Same contract as onFuncParamChange in QueryFunctionsEditor.tsx, which
      // stores the raw editor input (a string) into params.
      const func = createFuncInstance(getFuncDef('scale'));
      func.updateParam('100', 0);

      expect(func.params).toEqual(['100']);
      expect(typeof func.params[0]).toBe('string');
    });

    it('bindFunction converts both param encodings to a number', () => {
      for (const params of [[100], ['100']]) {
        const processingFunc = jest.fn();
        const func = createFuncInstance(getFuncDef('scale'), params);
        const boundFunc = func.bindFunction({ scale: processingFunc });
        boundFunc('datapoints');

        expect(processingFunc).toHaveBeenCalledWith(100, 'datapoints');
      }
    });
  });

  it('every int/float-typed default param is serialized as a JSON number', () => {
    // The backend accepts numeric params as JSON numbers or strings, but the
    // defaults documented here are what a freshly added function sends.
    const categories = getCategories();
    for (const category of Object.keys(categories)) {
      for (const def of categories[category]) {
        def.params.forEach((paramDef, i) => {
          if ((paramDef.type === 'int' || paramDef.type === 'float') && def.defaultParams[i] !== undefined) {
            expect(typeof def.defaultParams[i]).toBe('number');
          }
        });
      }
    }
  });
});
