import BaseCodec from './Base';
import * as util from '../utils/util';

export default class DateCodec extends BaseCodec {
    constructor (metadata, propertyName) {
        super();
        const { min } = metadata.stats(propertyName);
        this._min_date = util.castDate(min);
        this._min_ms = this._min_date.getTime();
    }

    sourceToInternal (propertyValue) {
        // numbers (epoch in milliseconds) or Dates are accepted
        return util.castDate(propertyValue).getTime() - this._min_ms;
    }

    internalToExternal (propertyValue) {
        let value = propertyValue;
        value += this._min_ms;
        return util.msToDate(value);
    }

    externalToSource (v) {
        return v.getTime();
    }

    sourceToExternal (v) {
        return util.castDate(v);
    }

    inlineInternalMatch (thisValue, otherCodec) {
        const offset = otherCodec._min_ms - this._min_ms;
        return `(${thisValue}-${offset.toFixed(20)})`;
    }
}
