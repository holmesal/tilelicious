
export const sizes = {
    a4: {
        w: 3508,
        h: 2480
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