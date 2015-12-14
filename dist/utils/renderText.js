'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = renderText;
exports.measureSpacedText = measureSpacedText;
// from

/**
 * CanvasRenderingContext2D.renderText extension
 */
// @param  letterSpacing  {float}  CSS letter-spacing property
function renderText(text, x, y, letterSpacing) {
    if (!text || typeof text !== 'string' || text.length === 0) {
        return;
    }

    if (typeof letterSpacing === 'undefined') {
        letterSpacing = 0;
    }

    // letterSpacing of 0 means normal letter-spacing

    var characters = String.prototype.split.call(text, ''),
        index = 0,
        current,
        currentPosition = x,
        align = 1;

    if (this.textAlign === 'right') {
        characters = characters.reverse();
        align = -1;
    } else if (this.textAlign === 'center') {
        var totalWidth = 0;
        for (var i = 0; i < characters.length; i++) {
            totalWidth += this.measureText(characters[i]).width + letterSpacing;
        }
        currentPosition = x - totalWidth / 2;
    }

    while (index < text.length) {
        current = characters[index++];
        this.fillText(current, currentPosition, y);
        currentPosition += align * (this.measureText(current).width + letterSpacing);
    }
}

function measureSpacedText(text, letterSpacing) {
    if (!text || typeof text !== 'string' || text.length === 0) {
        return;
    }

    if (typeof letterSpacing === 'undefined') {
        letterSpacing = 0;
    }

    // letterSpacing of 0 means normal letter-spacing

    var characters = String.prototype.split.call(text, ''),
        index = 0,
        current,
        currentPosition = x,
        align = 1;

    if (this.textAlign === 'right') {
        characters = characters.reverse();
        align = -1;
    } else if (this.textAlign === 'center') {
        var totalWidth = 0;
        for (var i = 0; i < characters.length; i++) {
            totalWidth += this.measureText(characters[i]).width + letterSpacing;
        }
        currentPosition = x - totalWidth / 2;
    }

    while (index < text.length) {
        current = characters[index++];
        this.fillText(current, currentPosition, y);
        currentPosition += align * (this.measureText(current).width + letterSpacing);
    }
}