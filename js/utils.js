export function traverseDepthFirst(node, callback, level = 0) {
    callback(node, level);
    for (let child of node.children) {
        traverseDepthFirst(child, callback, level + 1);
    }
}

export function mapValue(value, fromRange, toRange) {
    let fromMin = fromRange[0];
    let fromMax = fromRange[1];
    let toMin = toRange[0];
    let toMax = toRange[1];

    let fromSpan = fromMax - fromMin;
    if (fromSpan == 0) return 0;

    let toSpan = toMax - toMin;

    let valueScaled = (value - fromMin) / fromSpan;

    return toMin + (valueScaled * toSpan);
}
