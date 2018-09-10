import BaseExpression from './base';
import { implicitCast, checkExpression, checkMaxArguments } from './utils';

import RampImage from './RampImage';
import RampGeneric from './RampGeneric';

/**
* Create a ramp: a mapping between an input (a numeric or categorical expression) and an output (a color palette or a numeric palette, to create bubble maps)
*
* Categories to colors
* Categorical expressions can be used as the input for `ramp` in combination with color palettes. If the number of categories exceeds the number of available colors in the palette new colors will be generated by
* using CieLAB interpolation.
*
* Categories to numeric
* Categorical expression can be used as the input for `ramp` in combination with numeric palettes. If the number of input categories doesn't match the number of numbers in the numeric palette, linear interpolation will be used.
*
* Numeric expressions to colors
* Numeric expressions can be used as the input for `ramp` in combination with color palettes. Colors will be generated by using CieLAB interpolation.
*
* Numeric expressions to numeric
* Numeric expressions can be used as the input for `ramp` in combination with numeric palettes. Linear interpolation will be used to generate intermediate output values.
*
* @param {Number|Category} input - The input expression to give a color
* @param {Palette|Color[]|Number[]} palette - The color palette that is going to be used
* @return {Number|Color}
*
* @example <caption>Mapping categories to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), [1, 4, 8])
*   color: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), s.palettes.PRISM)
* });
*
* @example <caption>Mapping categories to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(buckets($dn, [20, 50, 120]), [1, 10,4])
*   color: ramp(buckets($dn, [20, 50, 120]), prism)
* `);
*
*
* @example <caption>Mapping numeric expressions to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.linear(s.prop('dn'), 40, 100), [1, 8])
*   color: s.ramp(s.linear(s.prop('dn'), 40, 100), s.palettes.PRISM)
* });
*
* @example <caption>Mapping numeric expressions to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(linear($dn, 40, 100), [1, 10,4])
*   color: ramp(linear($dn, 40, 100), prism)
* `);
*
* @memberof carto.expressions
* @name ramp
* @function
* @api
*/
export default class Ramp extends BaseExpression {
    constructor (input, palette, others = 'default') {
        checkMaxArguments(arguments, 3, 'ramp');

        input = implicitCast(input);
        palette = implicitCast(palette);

        checkExpression('ramp', 'input', 0, input);
        checkExpression('ramp', 'palette', 1, palette);

        super({ input, palette });
        this.palette = palette;
        this.others = others; // FIXME, others is not a children
    }

    _bindMetadata (metadata) {
        super._bindMetadata(metadata);
        switch (this.palette.type) {
            case 'image-list':
                Object.setPrototypeOf(this, RampImage.prototype);
                break;
            default:
                Object.setPrototypeOf(this, RampGeneric.prototype);
                break;
        }
        return this._bindMetadata(metadata);
    }

    /**
     * Get the value associated with each category
     *
     * @param {object} config - Optional configuration
     * @param {string} config.defaultOthers - Name for other category values. Defaults to 'Others'.
     * @param {number} config.samples - Number of samples for numeric values to be returned. Defaults to 10. The maximum number of samples is 100.
     * @return {object} - { type, data }. 'type' could be category or number. Data is an array of { key, value } objects. 'key' depends on the expression type. 'value' is the result evaluated by the ramp. There is more information in the examples.
     *
     * @example <caption>Get the color associated with each category</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.prop('vehicles'), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Others', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the color associated with each category (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp($vehicles, PRISM)
     * ´);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Others', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the image url associated with each category</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   symbol: s.ramp(s.prop('vehicles'), s.imageList([s.BICYCLE, s.CAR, s.BUS]))
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.symbol.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: bicycleImageUrl },
     *   //       { key: 'Car', value: carImageUrl },
     *   //       { key: 'Bus', value: bicycleImageUrl },
     *   //       { key: 'Others', value:  ''}
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the image url associated with each category (String)</caption>
     * const viz = new carto.Viz(`
     *   symbol: ramp('$vehicles'), imageList([BICYCLE, CAR, BUS]))
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.symbol.getLegend();
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: bicycleImageUrl },
     *   //       { key: 'Car', value: carImageUrl },
     *   //       { key: 'Bus', value: bicycleImageUrl },
     *   //       { key: 'Others', value:  ''}
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the top 3 categories and set default category name</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.top(s.prop('vehicles')), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *      defaultOthers: 'Other Vehicles'
     *   });
     *
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Other Vehicles', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get the top 3 categories and set default category name (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp(top($vehicles, 5), PRISM)
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *      defaultOthers: 'Other Vehicles'
     *   });
     *
     *   // legend = {
     *   //    type: 'category',
     *   //    data: [
     *   //       { key: 'Bicycle', value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 'Car', value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 'Bus', value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 'Other Vehicles', value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get 4 samples for a linear color ramp</caption>
     * const s = carto.expressions;
     * const viz = new carto.Viz({
     *   color: s.ramp(s.linear(s.prop('numvehicles'), 1, 100), s.palettes.PRISM)
     * });
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *       samples: 4
     *   });
     *
     *   // legend = {
     *   //    type: 'number',
     *   //    name: 'numvehicles',
     *   //    data: [
     *   //       { key: 25, value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 50, value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 75, value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 100, value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @example <caption>Get 4 samples for a linear color ramp (String)</caption>
     * const viz = new carto.Viz(`
     *   color: ramp(linear($numvehicles, 1, 100), PRISM)
     * `);
     *
     * layer.on('loaded', () => {
     *   const legend = layer.viz.color.getLegend({
     *       samples: 4
     *   });
     *
     *   // legend = {
     *   //    type: 'number',
     *   //    name: 'numvehicles',
     *   //    data: [
     *   //       { key: 25, value: { r: 95, g: 70, b: 144, a: 1 } },
     *   //       { key: 50, value: { r: 29, g: 105, b: 150, a: 1 ] },
     *   //       { key: 75, value: { r: 56, g: 166, b: 165, a: 1 ] },
     *   //       { key: 100, value: { r: 15, g: 133, b: 84, a: 1 ] }
     *   //     ]
     *   // }
     * });
     *
     * @memberof carto.expressions.Ramp
     * @name getLegend
     * @instance
     * @api
     */
}
