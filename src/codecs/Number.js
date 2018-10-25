import IdentityCodec from './Identity';
import { FP32_DESIGNATED_NULL_VALUE } from '../renderer/viz/expressions/constants';

export default class NumberCodec extends IdentityCodec {

    sourceToInternal (propertyValue) {
        if (isNaN(propertyValue) || propertyValue == null) {
            propertyValue = FP32_DESIGNATED_NULL_VALUE;
        }
        return [propertyValue];
    }

    internalToExternal (value) {
        if (value === FP32_DESIGNATED_NULL_VALUE) {
            value = null;
        }
        return value;
    }

    externalToInternal (value) {
        if (value === null) {
            value = FP32_DESIGNATED_NULL_VALUE;
        }
        return [value];
    }
}
