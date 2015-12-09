
export const sizes = {
    //a4: {
    //    w: 2480,
    //    h: 3508
    //},
    //a1: {
    //    w: 7016,
    //    h: 9933
    //},
    //debug: {
    //    w: 256,
    //    h: 256
    //},
    //test: {
    //    w: 600 * 2,
    //    h: 848.4 * 2
    //},
    '18x24': {
        printWidth: 5400,
        printHeight: 7200,
        mapWidth: 4592,
        mapHeight: 5584,
        paddingTop: 300,
        fontSize: 120,
        letterSpacing: 18
    },
    '12x16': {
        printWidth: 3600,
        printHeight: 4800,
        mapWidth: 3062,
        mapHeight: 3723,
        paddingTop: 300,
        fontSize: 120,
        letterSpacing: 18
    },
    preview: {
        printWidth: 1200,
        printHeight: 1600,
        mapWidth: 1020,
        mapHeight: 1241,
        paddingTop: 100,
        fontSize: 40,
        letterSpacing: 6
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