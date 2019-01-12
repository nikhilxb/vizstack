import {DagEdgeLayoutSpec, DagNodeLayoutSpec} from "./layout";
import ELK from "elkjs";

class GraphProperties {
    constructor(nodes: Array<DagNodeLayoutSpec>, edges: Array<DagEdgeLayoutSpec>) {
        this._nodes = {};
        nodes.forEach((node) => (this._nodes[node.id] = node));

        this._nodeParents = {};
        nodes.forEach((node) => {
            this._nodeParents[node.id] = null;
        });
        nodes.forEach((node) => {
            node.children.forEach((childId) => {
                this._nodeParents[childId] = node.id;
            });
        });

        this._nodeHierarchyHeights = {};
        nodes.forEach(({ id }) => {
            this._setHierarchyHeight(id);
        });
        console.log(this._nodeHierarchyHeights);

        this._edges = {};
        edges.forEach((edge) => (this._edges[edge.id] = edge));

        this._sideMap = {
            'left': 'WEST',
            'right': 'EAST',
            'up': 'NORTH',
            'down': 'SOUTH',
        }
    }

    _setHierarchyHeight(nodeId: DagElementId) {
        if (nodeId in this._nodeHierarchyHeights) {
            return;
        }
        const children = this._nodes[nodeId].children;
        if (children.length === 0) {
            this._nodeHierarchyHeights[nodeId] = 0;
            return;
        }
        children.forEach((childId) => {
            this._setHierarchyHeight(childId);
        });
        console.log(nodeId, children.map((childId) => this._nodeHierarchyHeights[childId]));
        this._nodeHierarchyHeights[nodeId] =
            Math.max(...children.map((childId) => this._nodeHierarchyHeights[childId])) + 1;
    }

    getCommonAncestor(nodeId1: DagElementId, nodeId2: DagElementId): DagElementId {
        while (nodeId1 !== nodeId2) {
            console.log(nodeId1, nodeId2);
            if (nodeId2 === null || this.getHierarchyHeight(nodeId1) < this.getHierarchyHeight(nodeId2)) {
                nodeId1 = this.getParent(nodeId1);
            }
            else {
                nodeId2 = this.getParent(nodeId2);
            }
        }
        return nodeId1;
    }

    getEdgeIds(): Array<DagEdgeId> {
        return Object.keys(this._edges);
    }

    getHierarchyHeight(nodeId: DagElementId): number {
        return this._nodeHierarchyHeights[nodeId];
    }

    getParent(nodeId: DagElementId): DagElementId {
        return this._nodeParents[nodeId];
    }

    getOrientation(nodeId: DagElementId): 'horizontal' | 'vertical' {
        return nodeId === null ? 'vertical' : this._nodes[nodeId].orientation;
    }

    getParentOrientation(nodeId: DagElementId): 'horizontal' | 'vertical' {
        return this.getParent(nodeId) ? this.getOrientation(this.getParent(nodeId)) : 'vertical';
    }

    getStartSide(edgeId: DagEdgeId): 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' {
        return this._sideMap[this._edges[edgeId].startSide];
    }

    getEndSide(edgeId: DagEdgeId): 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' {
        return this._sideMap[this._edges[edgeId].endSide];
    }

    getStartId(edgeId: DagEdgeId): DagElementId {
        return this._edges[edgeId].startId;
    }

    getEndId(edgeId: DagEdgeId): DagElementId {
        return this._edges[edgeId].endId;
    }
}

export default function layout(
    nodes: Array<DagNodeLayoutSpec>,
    edges: Array<DagEdgeLayoutSpec>,
    callback: (number, number, Array<DagNodeLayoutSpec>, Array<DagEdgeLayoutSpec>) => void,
): void {
    layoutElkGraph(nodes, edges, getElkGraph(nodes, edges), callback);
}

// =====================================================================================================================
// Convert a `dagbuilder` generic graph into an engine-ready graph.
// ----------------------------------------------------------------
// `DAGBuilder` objects store a general representation of a DAG, but that format is not directly used by the layout
// algorithm. To lay out the graph, an engine-ready graph must first be created and then fed to the layout engine.
// =====================================================================================================================

/**
 * Builds an ELK graph that is ready for layout from arrays of `DAGNode`s and `DAGEdge`s.
 *
 * @param nodes
 *      Array of `DAGNode` objects, containing every node in a DAG.
 * @param edges
 *      Array of `DAGEdge` objects, containing every edge in a DAG.
 * @returns {object}
 *      An ELK graph ready for layout.
 */
function getElkGraph(nodes: Array<DagNodeLayoutSpec>, edges: Array<DagEdgeLayoutSpec>) {
    const graph = new GraphProperties(nodes, edges);
    const { edgeSegments, outPorts, inPorts } = getEdgeSegments(graph);
    const elkNodes = {};
    // Create the ELK nodes
    nodes.forEach(
        (node) =>
            (elkNodes[node.id] = createElkNode(
                node,
                outPorts[node.id],
                inPorts[node.id],
                graph,
            )),
    );
    // Assign ELK nodes to their proper parents
    nodes.forEach((node) => {
        if (graph.getParent(node.id) !== null) {
            elkNodes[graph.getParent(node.id)].children.push(elkNodes[node.id]);
        }
    });
    // Assign edge segments to the ELK nodes that should contain them (first node that is or contains both terminals)
    nodes.forEach((node) => {
        elkNodes[node.id].edges = edgeSegments[node.id];
    });
    const rootNodes = nodes.filter((node) => graph.getParent(node.id) === null);
    return {
        id: kRootNode,
        properties: {
            'elk.algorithm': 'layered',
            'elk.direction': kRootOrientation,
            'elk.layered.spacing.nodeNodeBetweenLayers': kNodeMargin,
            'elk.spacing.nodeNode': kNodeMargin,
            portConstraints: 'FIXED_SIDE',
        },
        children: rootNodes.map((node) => elkNodes[node.id]),
        edges: edgeSegments[kRootNode],
    };
}

/** Returns the string ID of a port on a given node with given index. */
const getPortId = (node, portNum, isInput) => `${node}_${portNum}` + (isInput ? 'i' : 'o');

/**
 * This JS object describes a segment of an edge in a DAG. Since ELK can only lay out edges which connect nodes that
 * share a parent or a parent-child pair themselves, the edges in the DAG must be sliced into segments before being
 * added to the ELK graph to be laid out.
 */
class ELKEdgeSegment {
    /**
     * Constructor.
     * @param edgeId
     *      The `DAGEdge` of which this edge is a segment.
     * @param startNodeId
     *      The `DAGNode` where this segment begins.
     * @param startPortId
     *      The name of the port on `startNode` where this segment begins.
     * @param endNodeId
     *      The `DAGNode` where this segment ends; should be the sibling, child, or parent of `startNode`.
     * @param endPortId
     *      The name of the port on `endNode` where this segment ends.
     * @param graph
     */
    constructor(
        edgeId: DagEdgeId,
        startNodeId: DagElementId,
        startPortId: string,
        endNodeId: DagElementId,
        endPortId: string,
        graph: GraphProperties,
    ) {
        // The position of this segment in the sequence of all segments belonging to `edge`; set with `setIndex()`.
        this._index = null;
        this._edgeId = edgeId;
        this._startPortId = startPortId;
        this._endPortId = endPortId;

        // Find the parent node, the node which is the lowest common ancestor of both the start and end nodes; the
        // segment will be a child of the parent node in the ELK graph
        while (startNodeId !== endNodeId) {
            if (
                startNodeId === null ||
                (endNodeId !== null &&
                    graph.getHierarchyHeight(startNodeId) > graph.getHierarchyHeight(endNodeId))
            ) {
                endNodeId = graph.getParent(endNodeId);
            } else if (
                endNodeId === null ||
                graph.getHierarchyHeight(startNodeId) < graph.getHierarchyHeight(endNodeId)
            ) {
                startNodeId = graph.getParent(startNodeId);
            } else {
                startNodeId = graph.getParent(startNodeId);
                endNodeId = graph.getParent(endNodeId);
            }
        }
        if(this._startPortId + this._endPortId === '1_1o2_0o') {
            console.log(startNodeId, endNodeId);
        }
        if (startNodeId === null) {
            this._parentNodeId = kRootNode;
        } else {
            this._parentNodeId = startNodeId;
        }
    }

    /** Returns the ID of the `DAGNode` whose corresponding ELK node should contain this segment. */
    getParentNodeId = () => this._parentNodeId;

    /**
     * Sets the edge's order in the sequence of segments belonging to its `DAGEdge`.
     *
     * This index will be used to unify the edge segments into a single edge before being returned to clients.
     *
     * @param {number} index
     *      The 0-indexed order of this segment among all segments belong to the original `DAGEdge`.
     */
    setIndex = (index) => (this._index = index);

    /**
     * Returns a version of this segment ready to be placed into the ELK graph representation.
     *
     * @returns {{id: string, sources: string[], targets: string[], notElk: {edgeId: number, index: number, z: number}}}
     */
    toElkEdge() {
        return {
            id: this._startPortId + this._endPortId,
            sources: [this._startPortId],
            targets: [this._endPortId],
            notElk: {
                edgeId: this._edgeId,
                index: this._index,
                z: 0,
            },
        };
    }
}

/**
 * Returns the first node, starting from `node` and moving through its ancestry, that should currently be visible in
 * the graph.
 *
 * Any node which is a descendant of a contracted node will not be visible in the graph. If it has any edges that start
 * or end at it, those edges should start or end at its first visible ancestor. This function finds that first visible
 * ancestor (or returns `node` itself if it is visible).
 *
 * @param {DAGNode} node
 *      The node whose first visible ancestor should be returned.
 * @returns {DAGNode}
 *      The first visible ancestor of `node`, or `node` itself if it is visible.
 */
function getFirstVisible(node) {
    while (!node.getIsVisible()) {
        node = node.getParent();
    }
    return node;
}

/**
 * Divides a `DAGEdge` into segment objects that are ready to be inserted into an ELK graph.
 *
 * Since ELK can only lay out edges which connect nodes that share a parent or a parent-child pair themselves,
 * `DAGEdge`s must be sliced into segments that connect siblings or parent-child pairs. This function does that slicing,
 * creating a mapping of node IDs to lists of ELK edge objects that should be added to them in the ELK graph.
 *
 * @param graph
 * @returns {{edgeSegments: {nodeId: object[]}, outPortCounts: {nodeId: number}, inPortCounts: {nodeId: number}}}
 *      The ELK edge objects which should be inserted into the `edges` field of each node's ELK object.
 *      The number of outgoing ports that each ELK node has.
 *      The number of incoming ports that each ELK node has.
 */
function getEdgeSegments(graph: GraphProperties) {
    const edgeSegments = new Proxy(
        {},
        {
            get: (target, name) => (name in target ? target[name] : (target[name] = [])),
        },
    );
    // We use a port list for outputs because we want edges with the same group ID to go through the same output ports.
    const outPorts = new Proxy(
        {},
        {
            get: (target, name) => (name in target ? target[name] : (target[name] = [])),
        },
    );
    // We use a count for inputs because each input should have a separate port (this can maybe be changed to
    // accommodate lists passed as arguments to ops)
    const inPorts = new Proxy(
        {},
        {
            get: (target, name) => (name in target ? target[name] : (target[name] = [])),
        },
    );
    graph.getEdgeIds().forEach((edgeId) => {
        // As we move up through the node hierarchy, we keep track of edges coming _from_ the starting node separate
        // from those going _to_ the end node. This allows us to put the edge segments in proper order when the edge
        // has been completely subdivided.
        let fromEdgeSegments = [];
        let toEdgeSegments = [];
        let startId = graph.getStartId(edgeId);
        let endId = graph.getEndId(edgeId);
        let firstInPortAssigned = false;

        outPorts[startId].push(graph.getStartSide(edgeId));

        // this encourages too long of edges when the port isn't on a side pointed to by the alignment
        // let inPortSide = undefined;
        // let outPortSide = undefined;
        // const commonAncestor = graph.getCommonAncestor(startId, endId);
        // if (commonAncestor !== null && graph.getOrientation(commonAncestor) === 'horizontal') {
        //     inPortSide = 'WEST';
        //     outPortSide = 'EAST';
        // }
        // else {
        //     inPortSide = 'SOUTH';
        //     outPortSide = 'NORTH';
        // }

        const inMap = {
            'horizontal': 'WEST',
            'vertical': 'SOUTH',
        };
        const outMap = {
            'horizontal': 'EAST',
            'vertical': 'NORTH',
        };

        // Move from the terminals up through the node parent hierarchy until a common ancestor is found; then, link
        // the edge segments built along the way
        while (true) {
            // When we find a common ancestor, create the final segment, assign every segment their proper index, and
            // add them to `edgeSegments`
            if (graph.getParent(startId) === graph.getParent(endId)) {
                fromEdgeSegments.push(
                    new ELKEdgeSegment(
                        edgeId,
                        startId,
                        // subtract 1 since we already added the port
                        getPortId(startId, outPorts[startId].length - 1, false),
                        endId,
                        getPortId(endId, inPorts[endId].length, true),
                        graph,
                    ),
                );
                inPorts[endId].push(firstInPortAssigned ? inMap[graph.getOrientation(graph.getParent(endId))] : graph.getEndSide(edgeId));
                fromEdgeSegments.concat(toEdgeSegments.reverse()).forEach((edgeSegment, i) => {
                    edgeSegment.setIndex(i);
                    edgeSegments[edgeSegment.getParentNodeId()].push(edgeSegment.toElkEdge());
                });
                break;
            }
            // If the start node is at a greater height than the end node, add a new segment connecting the end node to
            // its parent
            if (
                graph.getParent(startId) === null ||
                (graph.getParent(endId) !== null &&
                    graph.getHierarchyHeight(graph.getParent(startId)) >
                    graph.getHierarchyHeight(graph.getParent(endId)))
            ) {
                toEdgeSegments.push(
                    new ELKEdgeSegment(
                        edgeId,
                        graph.getParent(endId),
                        getPortId(
                            graph.getParent(endId),
                            inPorts[graph.getParent(endId)].length,
                            true,
                        ),
                        endId,
                        getPortId(endId, inPorts[endId].length, true),
                        graph,
                    ),
                );
                inPorts[endId].push(firstInPortAssigned ? inMap[graph.getOrientation(graph.getParent(endId))] : graph.getEndSide(edgeId));
                firstInPortAssigned = true;
                endId = graph.getParent(endId);
                continue;
            }
            // Otherwise, add a new segment from the start node to its parent
            fromEdgeSegments.push(
                new ELKEdgeSegment(
                    edgeId,
                    startId,
                    // subtract 1 since we already added the port
                    getPortId(startId, outPorts[startId].length - 1, false),
                    graph.getParent(startId),
                    getPortId(
                        graph.getParent(startId),
                        outPorts[graph.getParent(startId)].length,
                        false,
                    ),
                    graph,
                ),
            );
            startId = graph.getParent(startId);
            outPorts[startId].push(outMap[graph.getOrientation(startId)]);
        }
    });
    console.log(outPorts, inPorts);
    return { edgeSegments, outPorts, inPorts };
}

/**
 * Translates a `DAGNode` into an ELK node.
 *
 * The new node will not have any assigned edges or children, which should be added after creation.
 *
 * @param node
 *      The `DAGNode` for which an ELK node object should be created.
 * @param numOutPorts
 *      The number of output ports that the ELK node object should have.
 * @param numInPorts
 *      The number of input ports that the ELK node object should have; does not include lateral edges, as these are
 *      handled separately.
 * @param graph
 * @returns {object}
 *      An ELK node object with no edges or children.
 */
function createElkNode(
    node: DagNodeLayoutSpec,
    outPorts: Array<'NORTH' | 'SOUTH' | 'EAST' | 'WEST'>,
    inPorts: Array<'NORTH' | 'SOUTH' | 'EAST' | 'WEST'>,
    graph: GraphProperties,
) {
    console.log(node.orientation);
    const elkNode = {
        id: node.id,
        properties: {
            'elk.direction': node.orientation === 'vertical' ? 'UP' : 'RIGHT',
            portConstraints: 'FIXED_SIDE',
            'elk.layered.spacing.nodeNodeBetweenLayers': kNodeMargin,
            'elk.spacing.nodeNode': kNodeMargin,
            'elk.algorithm': 'layered',
        },
        edges: [],
        ports: [],
        children: [],
        notElk: {
            z: -graph.getHierarchyHeight(node.id),
        },
    };
    if (node.width !== undefined) {
        elkNode.width = node.width;
        elkNode.height = node.height;
    }
    inPorts.forEach((portSide, i) => {
        let newPort = {
            id: getPortId(node.id, i, true),
            properties: portSide ? {
                'port.side': portSide,
            } : {},
        };
        elkNode.ports.push(newPort);
    });
    outPorts.forEach((portSide, i) => {
        let newPort = {
            id: getPortId(node.id, i, false),
            properties: portSide ? {
                'port.side': portSide,
            } : {},
        };
        elkNode.ports.push(newPort);
    });
    return elkNode;
}

// =====================================================================================================================
// Lay out an engine-ready graph.
// ------------------------------
// After a `DAGBuilder` graph has been converted to an engine-ready version, it can be laid out. After layout, a
// callback function is executed, passing the new node and edge transforms to a user (typically a `DAGBuilder`).
// =====================================================================================================================

/**
 * Assigns positions and sizes to nodes and edges in an ELK graph.
 *
 * After the graph is laid out, `onComplete` is called, passing the positions and sizes of the graph's nodes and edges
 * to the caller for rendering.
 *
 * @param {object} graph
 *      An ELK graph, ready to be laid out.
 * @param {function} onComplete
 *      A function accepting argument `(graphWidth, graphHeight, nodeTransforms, edgeTransforms)` to be executed when
 *      the graph has been laid out. `nodeTransforms` is an object of the form:
 *          {
 *              nodeId: {
 *                  x,
 *                  y,
 *                  z,
 *                  width,
 *                  height,
 *              }
 *              ...
 *          }
 *      where one entry exists for each visible node in the graph. `edgeTransforms` is an object of the form:
 *          {
 *              edgeId: {
 *                  z,
 *                  points,
 *              }
 *              ...
 *          }
 *      where one entry exists for each visible edge in the graph.
 */
function layoutElkGraph(
    nodes: Array<DagNodeLayoutSpec>,
    edges: Array<DagEdgeLayoutSpec>,
    graph,
    onComplete,
) {
    console.log(graph);
    const elk = new ELK();
    elk.layout(graph).then(() => {
        onComplete(
            graph.width,
            graph.height,
            elkGraphToNodeTransforms(graph, nodes),
            elkGraphToEdgeTransforms(graph, edges),
        );
    }).catch(console.error);
    // layoutElkGraphRecurse(elk, getNodeLayoutOrder(graph), nodes, edges, onComplete);
}

/**
 * A recursive function which lays out ELK graph nodes in a specified order.
 *
 * ELK does not support our layout of lateral nodes natively, so we cannot just lay out the whole graph at once
 * and have it look as intended. Therefore, we have to manually lay out lateral nodes side-by-side. We cannot do
 * this after the graph has been laid out, as edges and other nodes would not be placed properly relative to the new
 * lateral node positions. Instead, we lay the graph out bottom-up, manually rearranging lateral nodes as
 * they appear, so that higher levels can route edges and place other nodes with knowledge of their new positions.
 *
 * ELK will raise an exception on `elk.layout(node)` if `node.edges` includes edges that connect the children of `node`
 * to itself. This is frustrating. To work around this, we actually don't lay out a node unless it is the root or
 * contains temporal containers. This way, most containers aren't laid out directly, avoiding the bug. However, there
 * are still problems if a series of lateral nodes are nested within an abstractive container that then connects
 * to some node outside of itself TODO.
 *
 * After a node is laid out, the relative positions of its contents are fixed, so that subsequent layouts do not change
 * its arrangement (which would undo our manual temporal container layout).
 *
 * ELK lays out graphs in place and asynchronously, so `graph` will point to the newly laid-out graph object and a
 * callback is triggered when layout is complete.
 *
 * @param {ELKNode} elk
 *      An ELK object which performs the layout.
 * @param {object[]} toLayout
 *      An array of node objects in ELK format, in the order in which the nodes should be laid out. Likely produced by
 *      `getNodeLayoutOrder()`.
 * @param {function} onComplete
 *      A function with signature `(graphWidth, graphHeight, nodeTransforms, edgeTransforms)` to be executed when
 *      the graph has been laid out.
 */
function layoutElkGraphRecurse(
    elk,
    toLayout,
    nodes: Array<DagNodeLayoutSpec>,
    edges: Array<DagEdgeLayoutSpec>,
    onComplete,
) {
    // let elkNode = toLayout[0];
    let elkNode = toLayout[toLayout.length - 1];
    if (elkNode.id !== kRootNode) {
        elkNode = {
            id: 'temp',
            properties: {
                'elk.algorithm': 'layered',
                'elk.direction': elkNode.properties['elk.direction'],
                'elk.layered.spacing.nodeNodeBetweenLayers': kNodeMargin,
                'elk.spacing.nodeNode': kNodeMargin,
            },
            children: [elkNode],
            edges: [],
        };
    }
    // `elk.layout(elkNode)` will crash if `elkNode` contains edges that connect itself to its children. Thus, we only
    // lay out when `elkNode` is the root node (which cannot connect to its children) and when `elkNode` contains
    // lateral nodes.
    console.log('starting', elkNode.id, elkNode);
    elk.layout(elkNode).then(() => {
        console.log('finished', elkNode.id);
        if (elkNode.id === 'temp') {
            elkNode = elkNode.children[0];
        }
        // lockElkNodeLayout(elkNode);
        if (elkNode.id !== kRootNode) {
            layoutElkGraphRecurse(elk, toLayout.splice(1), nodes, edges, onComplete);
        } else {
            onComplete(
                elkNode.width,
                elkNode.height,
                elkGraphToNodeTransforms(elkNode, nodes),
                elkGraphToEdgeTransforms(elkNode, edges),
            );
        }
    }).catch(console.error);
}

/** Changes an ELK node's settings so that its children cannot be rearranged by future `layout()` calls. */
const lockElkNodeLayout = (elkNode) => {
    elkNode.properties['elk.algorithm'] = 'elk.fixed';
};

/**
 * Builds a mapping of node IDs and port IDs to their height, width, and absolute position relative to the graph origin.
 *
 * When manually laying out lateral edges after the ELK layout process has been completed, the edges must be drawn
 * between absolute positions, while the x and y attributes of each node are relative to its parent. Thus, we build this
 * mapping so that the edges can be drawn correctly.
 *
 * @param {object} elkNode
 *      An object in ELK JSON format with an x and y position.
 * @param {object} positions
 *      A mapping of node and port IDs to objects of the form {x, y}.
 * @param {{x: number, y: number}} offset
 *      The positional offset of `elkNode` from the graph's root.
 * @returns {{node or port ID: {x, y, height}}}
 *      A mapping of node and port IDs to absolute positions; height is also included for spacing lateral edges
 *      properly.
 */
function getNodeAndPortTransforms(elkNode, positions = {}, offset = { x: 0, y: 0 }) {
    positions[elkNode.id] = { ...offset, height: elkNode.height };
    if (elkNode.children) {
        elkNode.children.forEach((child) => {
            getNodeAndPortTransforms(child, positions, {
                x: offset.x + child.x,
                y: offset.y + child.y,
            });
        });
    }
    if (elkNode.ports) {
        elkNode.ports.forEach((port) => {
            getNodeAndPortTransforms(port, positions, {
                x: offset.x + port.x,
                y: offset.y + port.y,
            });
        });
    }
    return positions;
}

/**
 * Returns an array of ELK node objects in the order in which they should be laid out.
 *
 * @param {object} graph
 *      The object representing the root of the graph to be laid out, in ELK JSON format.
 * @returns {object[]}
 *      An array of objects in ELK JSON format, where each node is at a lower index than its ancestors.
 */
function getNodeLayoutOrder(graph) {
    return getNodeLayoutOrderRecurse([graph], 0);
}

/**
 * A recursive function which extends an array of ELK JSON objects with the children of one of the array's members.
 *
 * @param {object[]} toLayout
 *      An array of ELK JSON objects, in the order in which they should be laid out.
 * @param {number} i
 *      An index into `toLayout`; `toLayout` will be extended with the children of `toLayout[i]`.
 * @returns {object[]}
 *      An array containing node objects in ELK JSON format, where each node is at a lower index than its ancestors.
 */
function getNodeLayoutOrderRecurse(toLayout, i) {
    if (i === toLayout.length) {
        return toLayout.reverse();
    }
    toLayout[i].children.forEach((child) => {
        toLayout.push(child);
    });
    return getNodeLayoutOrderRecurse(toLayout, i + 1);
}

// Extract node and edge transforms from a laid-out ELK graph.
// -----------------------------------------------------------

/**
 * Creates a mapping of edge IDs (as found in the `DAGEdge` object) to the edge's path and z-order.
 *
 * The `onComplete` callback passed to `layoutElkGraph()` expects a mapping of edge IDs to edge transforms. In ELK
 * format, each node object has a list of edges between itself and its children, causing edges which pass through
 * parent boundaries to be "sliced" into multiple pieces. In addition, these slices contain fields which are relevant
 * only for the ELK layout process. These slices must be unified and aggregated before `onComplete` can be called.
 *
 * @param {object} graph
 *      The root node of a graph in ELK JSON format.
 * @returns {object}
 *      A mapping of edge IDs to their transforms; see `layoutElkGraph()`.
 */
function elkGraphToEdgeTransforms(graph, edges: Array<DagEdgeLayoutSpec>) {
    const edgeGroups = elkGraphToEdgeGroups(graph);
    const edgeTransforms = {};
    Object.entries(edgeGroups).forEach(([groupId, edgeGroup]) => {
        let edgeGroupSorted = edgeGroup.edgeSlices
            .splice(0)
            .sort(({ order: order1 }, { order: order2 }) => order1 - order2);
        let newEdge = [edgeGroupSorted[0].points[0]];
        edgeGroupSorted.forEach(({ points }) =>
            points.forEach((point, i) => {
                if (i > 0) {
                    newEdge.push(point);
                }
            }),
        );
        edgeTransforms[groupId] = {
            points: newEdge,
            z: edgeGroup.z,
        };
    });
    edges.forEach((edgeLayoutSpec) => {
        edgeLayoutSpec.points = edgeTransforms[edgeLayoutSpec.id].points;
        edgeLayoutSpec.z = edgeTransforms[edgeLayoutSpec.id].z;
    });
    return edges;
}

/**
 * Groups together edge segments in an ELK graph which should be drawn as a single edge.
 *
 * To connect nodes in an ELK graph which do not share an immediate parent, the edge connecting them must be sliced into
 * pieces whose start and end points share a direct common parent. When the graph must be rendered, those slices must be
 * reunified.
 *
 * This function outputs an object, where each key is a unique ID for a new unified edge (matching that on the original
 * `DAGEdge`) and each value has the required information to form that unified edge.
 *
 * @param {object} graph
 *      The root node of an ELK graph.
 * @returns {{
 *      edgeGroupId: {
 *          z: number
 *          edgeSlices: [{
 *              points: {x: number, y: number}[],
 *              order: number
 *          }]
 *      }
 *   }}
 *   where `z` is the draw order of the unified edge and `order` is the index of the edge segment in the sequence of
 *   edge segments.
 */
function elkGraphToEdgeGroups(graph) {
    return elkGraphToEdgeGroupsRecurse(graph, {}, { x: 0, y: 0 });
}

/**
 * Recursive function which groups all edges in a single node and then calls itself for each of that node's children.
 *
 * @param {object} elkNode
 *      An object in ELK JSON format whose edges should be added to groups.
 * @param {{}} edgeGroups
 *      An object which maps edge group ids to properties of the group and an array of edges. See
 *      `elkGraphToEdgeGroups()`.
 * @param {{x: number, y: number}} offset
 *      The position of `elkNode` relative to the graph origin.
 * @returns {{}}
 *      The `edgeGroups` object with the edges of `elkNode` and all of its descendants added.
 */
function elkGraphToEdgeGroupsRecurse(elkNode, edgeGroups, offset) {
    for (let i = 0; i < elkNode.edges.length; i++) {
        let edge = elkNode.edges[i];
        let edgeGroupId = edge.notElk.edgeId;
        let points = elkEdgeToPointArray(edge, offset);
        if (!(edgeGroupId in edgeGroups)) {
            // All edges of the same group share an `argName`, `zOrder`, `isTemporal`, and `viewerObj`.
            edgeGroups[edgeGroupId] = {
                z: edge.notElk.z,
                edgeSlices: [],
            };
        }
        edgeGroups[edgeGroupId].edgeSlices.push({
            points,
            order: edge.notElk.index,
        });
    }
    for (let i = 0; i < elkNode.children.length; i++) {
        let { x, y } = elkNode.children[i];
        elkGraphToEdgeGroupsRecurse(elkNode.children[i], edgeGroups, {
            x: offset.x + x,
            y: offset.y + y,
        });
    }
    return edgeGroups;
}

/**
 * Returns an array of points through which an ELK edge travels.
 *
 * ELK edges store their path in a bizarre way, with a start point, end point, and array of bend points contained
 * in a single object which is the only item in a `sections` array. The format expected downstream of graph layout
 * is an array of {x, y} objects, which is created here.
 *
 * @param {object} edge
 *      An edge object in ELK JSON format representing a single laid-out edge.
 * @param {{x: number, y: number}} offset
 *     The offset of the edge's parent node from the graph origin.
 * @returns {{x: number, y: number}[]}
 */
function elkEdgeToPointArray(edge, offset) {
    let points = [];
    let { startPoint, endPoint, bendPoints } = edge.sections[0];
    points.push({ x: startPoint.x + offset.x, y: startPoint.y + offset.y });
    if (bendPoints) {
        bendPoints.forEach(({ x, y }) => {
            points.push({ x: x + offset.x, y: y + offset.y });
        });
    }
    points.push({ x: endPoint.x + offset.x, y: endPoint.y + offset.y });
    return points;
}

/**
 * Creates an mapping of node IDs (as found in the original `DAGNode`) to objects containing node positions and sizes.
 *
 * The `onComplete` callback passed to `layoutElkGraph()` expects a mapping of node IDs to their transforms. In ELK
 * format, nodes are deeply nested, and contain fields that are relevant only to the ELK layout process. This function
 * crawls the graph and creates a new object for each encountered node, which contains only positional properties used
 * in rendering.
 *
 * @param {object} graph
 *      The root node of a graph in ELK JSON format
 * @returns {object}
 *      A mapping of node IDs to their transforms; see `layoutElkGraph()`.
 */
function elkGraphToNodeTransforms(graph, nodes: Array<DagNodeLayoutSpec>) {
    return elkGraphToNodeTransformsRecurse(graph, nodes, { x: 0, y: 0 });
}

/**
 * Recursive function which builds a node transform object for each child of the given ELK node, then calls itself for
 * each child.
 *
 * @param {object} elkNode
 *      A node object in ELK JSON format.
 * @param {object} nodes
 *      A mapping of node IDs to transforms to which newly created transforms are added
 * @param {{x: number, y: number}} offset
 *      The position of `elkNode` relative to the graph origin.
 * @returns {object}
 *      A mapping of edge IDs to their transforms; see `layoutElkGraph()`.
 */
function elkGraphToNodeTransformsRecurse(elkNode, nodes: Array<DagNodeLayoutSpec>, offset) {
    for (let i = 0; i < elkNode.children.length; i++) {
        let { width, height, x, y, id, notElk } = elkNode.children[i];
        let { z } = notElk;
        const node = nodes.find((node) => node.id === id);
        node.x = x + offset.x;
        node.y = y + offset.y;
        node.z = z;
        node.width = width;
        node.height = height;

        elkGraphToNodeTransformsRecurse(elkNode.children[i], nodes, {
            x: x + offset.x,
            y: y + offset.y,
        });
    }
    return nodes;
}
