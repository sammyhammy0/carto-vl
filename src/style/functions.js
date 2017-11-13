
function implicitCast(value) {
    if (Number.isFinite(value)) {
        return Float(value);
    }
    return value;
}
var gl = null;
function setGL(_gl) {
    gl = _gl;
}
export { Blend, Now, Near, Color, Float, RampColor, FloatMul, FloatDiv, FloatAdd, FloatSub, FloatPow, setGL };


/*
    Each styling function should:
        - Create their own objects, i.e.: be used without "new"
        - Check input validity on user input (constructor and exposed functions).
        - Have certain functions that never fail:
            - _applyToShaderSource should use uniformIDMaker and propertyTIDMaker to get unique uniform IDs and property IDs as needed
            - _postShaderCompile should get uniform location after program compilation as needed
            - _preDraw should set any program's uniforms as needed
            - isAnimated should return true if the function output could change depending on the timestamp
        - Have a type property declaring the GLSL output type: 'float', 'color'
*/

/*
    TODO
        - Type checking. Types: float, category, RGB, RGBA, HSV, HSVA
        - Allow multiplication, division and pow() to color expressions
        - Dead code removal. Blending should be done with FloatBlend / ColorBlend. anything else is historical code
        - HSV
        - Integrated color palettes
        - Now() with speed parameter
        - Think about "Date" type.
        - Heatmaps (renderer should be improved to accommodate this)
*/

function Now() {
    return new _Now();
}
function _Now() {
    this.type = 'float';
    this.float = Float(0);
}
_Now.prototype._applyToShaderSource = function (uniformIDMaker) {
    return this.float._applyToShaderSource(uniformIDMaker);
}
_Now.prototype._postShaderCompile = function (program) {
    return this.float._postShaderCompile(program);
}
_Now.prototype._preDraw = function () {
    this.float.expr = Date.now() * 0.1 % 400;
    this.float._preDraw();
}
_Now.prototype.isAnimated = function () {
    return true;
}

const FloatMul = genFloatBinaryOperation((x, y) => x * y, (x, y) => `(${x} * ${y})`);
const FloatDiv = genFloatBinaryOperation((x, y) => x / y, (x, y) => `(${x} / ${y})`);
const FloatAdd = genFloatBinaryOperation((x, y) => x + y, (x, y) => `(${x} + ${y})`);
const FloatSub = genFloatBinaryOperation((x, y) => x - y, (x, y) => `(${x} - ${y})`);
const FloatPow = genFloatBinaryOperation((x, y) => Math.pow(x, y), (x, y) => `pow(${x}, ${y})`);

function genFloatBinaryOperation(jsFn, glsl) {
    function BinaryOp(a, b) {
        if (Number.isFinite(a) && Number.isFinite(b)) {
            return Float(jsFn(a, b));
        }
        if (Number.isFinite(a)) {
            a = Float(a);
        }
        if (Number.isFinite(b)) {
            b = Float(b);
        }
        if (a.type == 'float' && b.type == 'float') {
            this.type = 'float';
        } else {
            console.warn(a, b);
            throw new Error(`Binary operation cannot be performed between '${a}' and '${b}'`);
        }
        return new _BinaryOp(a, b);
    }
    function _BinaryOp(a, b) {
        this.type = 'float';
        this.a = a;
        this.b = b;
        a.parent = this;
        b.parent = this;
    }
    _BinaryOp.prototype._applyToShaderSource = function (uniformIDMaker, propertyTIDMaker) {
        const a = this.a._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
        const b = this.b._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
        return {
            preface: a.preface + b.preface,
            inline: glsl(a.inline, b.inline)
        };
    }
    _BinaryOp.prototype._postShaderCompile = function (program) {
        this.a._postShaderCompile(program);
        this.b._postShaderCompile(program);
    }
    _BinaryOp.prototype._preDraw = function (l) {
        this.a._preDraw(l);
        this.b._preDraw(l);
    }
    _BinaryOp.prototype.isAnimated = function () {
        return this.a.isAnimated() || this.b.isAnimated();
    }
    _BinaryOp.prototype.replaceChild = function (toReplace, replacer) {
        if (this.a = toReplace) {
            this.a = replacer;
        } else {
            this.b = replacer;
        }
        replacer.parent = this;
        replacer.notify = toReplace.notify;
    }
    _BinaryOp.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
        genericFloatBlend(this, finalValue, duration, blendFunc);
    }
    return BinaryOp;
}

function Animation(duration) {
    return new _Animation(duration);
}
function _Animation(duration) {
    if (!Number.isFinite(duration)){
        throw new Error("Animation only supports number literals");
    }
    this.type = 'float';
    this.aTime = Date.now();
    this.bTime = this.aTime + Number(duration);
}
_Animation.prototype._applyToShaderSource = function (uniformIDMaker, propertyTIDMaker) {
    this._uniformID = uniformIDMaker();
    return {
        preface: `uniform float anim${this._uniformID};\n`,
        inline: `anim${this._uniformID}`
    };
}
_Animation.prototype._postShaderCompile = function (program) {
    this._uniformLocation = gl.getUniformLocation(program, `anim${this._uniformID}`);
}
_Animation.prototype._preDraw = function (l) {
    const time = Date.now();
    this.mix = (time - this.aTime) / (this.bTime - this.aTime);
    if (this.mix > 1.) {
        gl.uniform1f(this._uniformLocation, 1);
    } else {
        gl.uniform1f(this._uniformLocation, this.mix);
    }
}
_Animation.prototype.isAnimated = function () {
    return !this.mix || this.mix <= 1.;
}

function Near(property, center, threshold, falloff) {
    const args = [property, center, threshold, falloff].map(implicitCast);
    if (args.some(x => x === undefined || x === null)) {
        return null;
    }
    return new _Near(...args);
}

function _Near(property, center, threshold, falloff) {
    if (center.type!='float'||threshold.type!='float' || falloff.type!='float'){
        throw new Error('Near(): invalid parameter type');
    }
    this.type = 'float';
    this.property = property;
    this.center = center;
    this.threshold = threshold;
    this.falloff = falloff;
}
_Near.prototype._applyToShaderSource = function (uniformIDMaker, propertyTIDMaker) {
    this._UID = uniformIDMaker();
    const tid = propertyTIDMaker(this.property);
    const center = this.center._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    const threshold = this.threshold._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    const falloff = this.falloff._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    return {
        preface:
        center.preface + threshold.preface + falloff.preface,
        inline: `1.-clamp((abs(p${tid}-${center.inline})-${threshold.inline})/${falloff.inline},
                        0., 1.)`
    };
}
_Near.prototype._postShaderCompile = function (program) {
    this.center._postShaderCompile(program);
    this.threshold._postShaderCompile(program);
    this.falloff._postShaderCompile(program);
}
_Near.prototype._preDraw = function () {
    this.center._preDraw();
    this.threshold._preDraw();
    this.falloff._preDraw();
}
_Near.prototype.isAnimated = function () {
    return this.center.isAnimated();
}



function Blend(a, b, mix) {
    const args = [a, b, mix].map(implicitCast);
    if (args.some(x => x === undefined || x === null)) {
        return null;
    }
    return new _Blend(...args);
}
function _Blend(a, b, mix) {
    if (a.type == 'float' && b.type == 'float') {
        this.type = 'float';
    } else if (a.type == 'color' && b.type == 'color') {
        this.type = 'color';
    } else {
        console.warn(a, b);
        throw new Error(`Blending cannot be performed between types '${a.type}' and '${b.type}'`);
    }
    this.a = a;
    this.b = b;
    this.mix = mix;
    a.parent = this;
    b.parent = this;
    mix.parent = this;
}
_Blend.prototype._applyToShaderSource = function (uniformIDMaker, propertyTIDMaker) {
    const a = this.a._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    const b = this.b._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    const mix = this.mix._applyToShaderSource(uniformIDMaker, propertyTIDMaker);
    return {
        preface: `${a.preface}${b.preface}${mix.preface}`,
        inline: `mix(${a.inline}, ${b.inline}, ${mix.inline})`
    };
}
_Blend.prototype._postShaderCompile = function (program) {
    this.a._postShaderCompile(program);
    this.b._postShaderCompile(program);
    this.mix._postShaderCompile(program);
}
_Blend.prototype._preDraw = function (l) {
    this.a._preDraw(l);
    this.b._preDraw(l);
    this.mix._preDraw(l);
}
_Blend.prototype.isAnimated = function () {
    return this.a.isAnimated() || this.b.isAnimated() || this.mix.isAnimated();
}
_Blend.prototype.replaceChild = function (toReplace, replacer) {
    if (this.a = toReplace) {
        this.a = replacer;
    } else {
        this.b = replacer;
    }
    replacer.parent = this;
    replacer.notify = toReplace.notify;
}

function genericBlend(initial, final, duration, blendFunc) {
    const parent = initial.parent;
    const blend = Blend(initial, final, Animation(duration));
    parent.replaceChild(initial, blend);
    blend.notify();
}
UniformColor.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
    genericBlend(this, finalValue, duration, blendFunc);
}
_RampColor.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
    genericBlend(this, finalValue, duration, blendFunc);
}

_Near.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
    genericBlend(this, finalValue, duration, blendFunc);
}
UniformFloat.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
    genericBlend(this, finalValue, duration, blendFunc);
}
_Blend.prototype.blendTo = function (finalValue, duration = 500, blendFunc = 'linear') {
    genericBlend(this, finalValue, duration, blendFunc);
}

function Color(color) {
    if (Array.isArray(color)) {
        color = color.filter(x => true);
        if (color.length != 4 || !color.every(Number.isFinite)) {
            return null;
        }
        return new UniformColor(color);
    }
    return null;
}
function UniformColor(color) {
    this.type = 'color';
    this.color = color;
}
UniformColor.prototype._applyToShaderSource = function (uniformIDMaker) {
    this._uniformID = uniformIDMaker();
    return {
        preface: `uniform vec4 color${this._uniformID};\n`,
        inline: `color${this._uniformID}`
    };
}
UniformColor.prototype._postShaderCompile = function (program) {
    this._uniformLocation = gl.getUniformLocation(program, `color${this._uniformID}`);
}
function evalColor(color, time) {
    if (Array.isArray(color)) {
        return color;
    }
    var a = evalColor(color.a, time);
    var b = evalColor(color.b, time);
    var m = (time - color.aTime) / (color.bTime - color.aTime);
    return a.map((va, index) => {
        return (1 - m) * va + m * b[index];//TODO non linear functions
    });
}
function simplifyColorExpr(color, time) {
    if (Array.isArray(color)) {
        return color;
    }
    var m = (time - color.aTime) / (color.bTime - color.aTime);
    if (m >= 1) {
        return color.b;
    }
    return color;
}
UniformColor.prototype._preDraw = function () {
    const t = Date.now();
    this.color = simplifyColorExpr(this.color, t);
    const color = evalColor(this.color, t);
    gl.uniform4f(this._uniformLocation, color[0], color[1], color[2], color[3]);
}
UniformColor.prototype.isAnimated = function () {
    return false;
}

function Float(x) {
    if (!Number.isFinite(x)) {
        return null;
    }
    return new UniformFloat(x);
}

function UniformFloat(size) {
    this.type = 'float';
    this.expr = size;
}
UniformFloat.prototype._applyToShaderSource = function (uniformIDMaker) {
    this._uniformID = uniformIDMaker();
    return {
        preface: `uniform float float${this._uniformID};\n`,
        inline: `float${this._uniformID}`
    };
}
UniformFloat.prototype._postShaderCompile = function (program) {
    this._uniformLocation = gl.getUniformLocation(program, `float${this._uniformID}`);
}
function evalFloatExpr(expr, time) {
    if (Number.isFinite(expr)) {
        return expr;
    }
    if (typeof expr === "function") {
        return x(time);
    }
    return expr.eval();
}
function simplifyFloatExpr(expr, time) {
    if (Number.isFinite(expr)) {
        return expr;
    }
    return expr.simplify();
}
UniformFloat.prototype._preDraw = function (time) {
    this.expr = simplifyFloatExpr(this.expr, time);
    const v = evalFloatExpr(this.expr, time);
    gl.uniform1f(this._uniformLocation, v);
}
UniformFloat.prototype.isAnimated = function () {
    return !Number.isFinite(this.expr);
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}


function RampColor(property, minKey, maxKey, values) {
    //TODO contiunuos vs discrete should be decided based on property type => cartegory vs float
    const args = [property, minKey, maxKey, values].map(implicitCast);
    if (args.some(x => x === undefined || x === null)) {
        return null;
    }
    return new _RampColor(...args);
}

function _RampColor(property, minKey, maxKey, values) {
    this.type = 'color';
    this.property = property;
    this.minKey = minKey.expr;
    this.maxKey = maxKey.expr;
    this.values = values;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 256;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array(4 * width);
    for (var i = 0; i < width; i++) {
        const vlowRaw = values[Math.floor(i / width * (values.length - 1))];
        const vhighRaw = values[Math.ceil(i / width * (values.length - 1))];
        const vlow = [hexToRgb(vlowRaw).r, hexToRgb(vlowRaw).g, hexToRgb(vlowRaw).b, 255];
        const vhigh = [hexToRgb(vhighRaw).r, hexToRgb(vhighRaw).g, hexToRgb(vhighRaw).b, 255];
        const m = i / width * (values.length - 1) - Math.floor(i / width * (values.length - 1));
        const v = vlow.map((low, index) => low * (1. - m) + vhigh[index] * m);
        pixel[4 * i + 0] = v[0];
        pixel[4 * i + 1] = v[1];
        pixel[4 * i + 2] = v[2];
        pixel[4 * i + 3] = v[3];
    }


    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
        width, height, border, srcFormat, srcType,
        pixel);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

_RampColor.prototype._free = function () {
    gl.deleteTexture(this.texture);
}
_RampColor.prototype._applyToShaderSource = function (uniformIDMaker, propertyTIDMaker) {
    const tid = propertyTIDMaker(this.property);
    this._UID = uniformIDMaker();
    return {
        preface: `
        uniform sampler2D texRamp${this._UID};
        uniform float keyMin${this._UID};
        uniform float keyWidth${this._UID};
        `,
        inline: `texture2D(texRamp${this._UID}, vec2((p${tid}-keyMin${this._UID})/keyWidth${this._UID}, 0.5)).rgba`
    };
}
_RampColor.prototype._postShaderCompile = function (program) {
    this._texLoc = gl.getUniformLocation(program, `texRamp${this._UID}`);
    this._keyMinLoc = gl.getUniformLocation(program, `keyMin${this._UID}`);
    this._keyWidthLoc = gl.getUniformLocation(program, `keyWidth${this._UID}`);
}
_RampColor.prototype._preDraw = function () {
    gl.activeTexture(gl.TEXTURE12);//TODO remove hardcode
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this._texLoc, 12);
    gl.uniform1f(this._keyMinLoc, evalFloatExpr(this.minKey));
    gl.uniform1f(this._keyWidthLoc, evalFloatExpr(this.maxKey) - evalFloatExpr(this.minKey));
}
_RampColor.prototype.isAnimated = function () {
    return false;
}