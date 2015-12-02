
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
    }
};

export const getDims = (size) => {
    if (sizes[size]) {
        return sizes[size];
    } else {
        throw new Error('we don\'t have paper in that size....');
    }
};