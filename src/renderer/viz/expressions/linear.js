import BaseExpression from './base';
import { checkExpression, implicitCast, checkType, checkMaxArguments, clamp } from './utils';
import { globalMin, globalMax } from '../expressions';
import { timeRange, msToDate } from '../../../utils/util';
/**
* Linearly interpolates the value of a given input between a minimum and a maximum. If `min` and `max` are not defined they will
* default to `globalMin(input)` and `globalMax(input)`.
*
* @param {Number|Date} input - The input to be evaluated and interpolated, can be a numeric property or a date property
* @param {Number|Date} [min=globalMin(input)] - Numeric or date expression pointing to the lower limit
* @param {Number|Date} [max=globalMax(input)] - Numeric or date expression pointing to the higher limit
* @return {Number|Date}
*
* @example <caption> Color by $speed using the CARTOColor Prism by assigning the first color in Prism to features with speeds of 10 or less, the last color in Prism to features with speeds of 100 or more and a interpolated value for the speeds in between.</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   color: s.ramp(s.linear(s.prop('speed'), 10, 100), s.palettes.PRISM)
* });
*
* @example <caption> Color by $speed using the CARTOColor Prism by assigning the first color in Prism to features with speeds of 10 or less, the last color in Prism to features with speeds of 100 or more and a interpolated value for the speeds in between. (String)</caption>
* const viz = new carto.Viz(`
*   color: ramp(linear($speed, 10, 100), PRISM)
* `);
*
* @memberof carto.expressions
* @name linear
* @function
* @api
*/
export default class Linear extends BaseExpression {
    constructor (input, min, max, range) {
        checkMaxArguments(arguments, 4, 'linear');

        input = implicitCast(input);

        if (min && !(min instanceof BaseExpression) && max === undefined && range === undefined) {
            range = min;
            min = undefined;
            max = undefined;
        }

        if (min === undefined && max === undefined) {
            min = globalMin(input);
            max = globalMax(input);
        }

        min = implicitCast(min);
        max = implicitCast(max);

        checkExpression('linear', 'input', 0, input);
        checkExpression('linear', 'min', 1, min);
        checkExpression('linear', 'max', 2, max);

        super({ input, min, max });
        this.type = 'number';

        // range mode is used only for timerange inputs:
        // * 'start' of property between full range (from start of min to end of max)
        // * 'end' of property between full range (from start of min to end of max)
        // * 'unit' (default) range mapped to 0:1
        this._rangeMode = range || 'unit';
    }

    // Given a linear value 0:1, convert it back to the input value
    // for TimeRange and Date inputs the result is an interpolated Date
    converse (value) {
        if (this.input.type === 'date') {
            const min = this.min.eval().getTime();
            const max = this.max.eval().getTime();
            return msToDate(value * (max - min) + min);
        } else if (this.input.type === 'timerange') {
            let min, max;
            switch (this._rangeMode) {
                case 'unit':
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).startValue;
                    break;
                case 'start':
                case 'end':
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).endValue;
                    break;
            }
            return msToDate(value * (max - min) + min);
        }
        const min = this.min.eval();
        const max = this.max.eval();
        return value * (max - min) + min;
    }

    // return min, max, but for time ranges they are returned as Dates
    limits () {
        let min, max;
        if (this.input.type === 'timerange') {
            switch (this._rangeMode) {
                case 'unit':
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).startValue;
                    break;
                case 'start':
                case 'end':
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).endValue;
                    break;
            }
        } else {
            min = this.min.eval();
            max = this.max.eval();
        }
        return [min, max];
    }

    eval (feature) {
        if (this.input.type === 'timerange') {
            let input, min, max;
            switch (this._rangeMode) {
                case 'unit':
                    // choose same side for all three:
                    input = this.input.eval(feature).startValue;
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).startValue;
                    break;
                case 'start':
                    input = this.input.eval(feature).startValue;
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).endValue;
                    break;
                case 'end':
                    input = this.input.eval(feature).endValue;
                    min = timeRange(this.min.eval()).startValue;
                    max = timeRange(this.max.eval()).endValue;
                    break;
            }
            return (input - min) / (max - min);
        }

        const input = this.input.eval(feature);
        const metadata = this._metadata;
        const min = metadata.codec(this.input.propertyName).externalToInternal(this.min.eval(feature))[0];
        const max = metadata.codec(this.input.propertyName).externalToInternal(this.max.eval(feature))[0];
        return (input - min) / (max - min);
    }

    _bindMetadata (metadata) {
        super._bindMetadata(metadata);
        this._metadata = metadata;

        if (this.input.type === 'timerange') {
            let inputIndex, min, max;
            switch (this._rangeMode) {
                case 'unit':
                    // choose same side for all three:
                    inputIndex = 0; // start
                    min = metadata.codec(this.input.propertyName).externalToInternal(this.min.eval())[inputIndex];
                    max = metadata.codec(this.input.propertyName).externalToInternal(this.max.eval())[inputIndex];
                    // min in ms is timeRange(this.min.eval()).startValue;
                    // max in ms is timeRange(this.max.eval()).startValue;
                    break;
                case 'start':
                    inputIndex = 0; // start
                    min = metadata.codec(this.input.propertyName).externalToInternal(this.min.eval())[0]; // start
                    max = metadata.codec(this.input.propertyName).externalToInternal(this.max.eval())[1]; // end
                    // min in ms is timeRange(this.min.eval()).startValue;
                    // max in ms is timeRange(this.max.eval()).endValue;
                    break;
                case 'end':
                    inputIndex = 1; // end
                    min = metadata.codec(this.input.propertyName).externalToInternal(this.min.eval())[0]; // start
                    max = metadata.codec(this.input.propertyName).externalToInternal(this.max.eval())[1]; // end
                    // min in ms is timeRange(this.min.eval()).startValue;
                    // max in ms is timeRange(this.max.eval()).endValue;
                    break;
            }

            this.inlineMaker = (inline) => `((${inline.input[inputIndex]}-(${min.toFixed(20)}))/(${(max - min).toFixed(20)}))`;
        } else {
            checkType('linear', 'input', 0, ['number', 'date'], this.input);
            checkType('linear', 'min', 1, ['number', 'date'], this.min);
            checkType('linear', 'max', 2, ['number', 'date'], this.max);
            // Should actually check:
            // checkType('linear', 'min', 1, this.input.type, this.min);
            // checkType('linear', 'max', 2, this.input.type, this.max);
            // but global aggregations are currently of type number even for dates

            const smin = metadata.codec(this.input.propertyName).externalToInternal(this.min.eval())[0];
            const smax = metadata.codec(this.input.propertyName).externalToInternal(this.max.eval())[0];

            this.inlineMaker = (inline) => `((${inline.input}-(${smin.toFixed(20)}))/(${(smax - smin).toFixed(20)}))`;
        }
    }

    _getLegendData (config) {
        // TODO: timerange support
        const min = this.min.eval();
        const max = this.max.eval();
        const INC = 1 / (config.samples - 1);
        const name = this.toString();
        const data = [];

        for (let i = 0; data.length < config.samples; i += INC) {
            const value = clamp(i, 0, 1);
            const key = i * (max - min) + min;

            data.push({ key, value });
        }

        return { data, min, max, name };
    }
}
