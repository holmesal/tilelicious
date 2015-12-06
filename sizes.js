
export const sizes = {
    a4: {
        w: 2480,
        h: 3508
    },
    a1: {
        w: 7016,
        h: 9933
    },
    debug: {
        w: 256,
        h: 256
    },
    test: {
        w: 600 * 2,
        h: 848.4 * 2
    },
    '18x24': {
        w: 4592,
        h: 5584
    },
    '12x16': {
        w: 3062,
        h: 3723
    },
    preview: {
        w: 600 * 2,
        h: 730 * 2
    }
};

export const screenSizes = {
    a4: {
        w: 600,
        h: 848.4
    },
    '18x24': {
        w: 600,
        h: 730
    },
    '12x16': {
        w: 600,
        h: 730
    }
};

export const getDims = (size) => {
    if (sizes[size]) {
        return sizes[size];
    } else {
        throw new Error('we don\'t have paper in that size....');
    }
};