'use babel';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import { withStyles } from 'material-ui/styles';
import classNames from 'classnames';

// Grid layout
import GridLayout from 'react-grid-layout';
import { SizeMe } from 'react-sizeme'

// Common viewer frame
import ViewerDisplayFrame from './viewers/ViewerDisplayFrame';

// Custom data type viewers
// import NumberViewer from './viewers/NumberViewer';
import StringViewer from './viewers/StringViewer';
// import TensorViewer from './viewers/TensorViewer';
// import GraphViewer, { assembleGraphModel }  from './viewers/GraphViewer';
import ListViewer from './viewers/ListViewer';

// Custom Redux actions
import { addViewerAction, removeViewerAction, updateLayoutAction } from '../actions/canvas';
import { isSymbolIdFrozen } from '../services/symbol-utils';


/**
 * This smart component serves as an interactive workspace for inspecting variable viewers. It displays a collection
 * of `ViewerFrame` objects using React Grid Layout.
 * TODO: Refactor viewer remove based on viewerId not symbolId, because of clone.
 */
class Canvas extends Component {

    /** Prop expected types object. */
    static propTypes = {
        /** CSS-in-JS styling object (from `withStyles`). */
        classes: PropTypes.object.isRequired,

        /**
         * See `REPL.fetchSymbolData(symbolId)`.
         */
        fetchSymbolData: PropTypes.func.isRequired,

        /**
         * Creates a new viewer for the specified symbol at the end of the Canvas.
         *
         * @param symbolId
         */
        addViewer: PropTypes.func.isRequired,

        /**
         * Removes the viewer with the specified symbol from the Canvas.
         *
         * @param symbolId
         */
        removeViewer: PropTypes.func.isRequired,

        /**
         * Updates the react-grid-layout model for the Canvas.
         *
         * @param layout
         */
        updateLayout: PropTypes.func.isRequired,

        /** See `viewersSelector` in `Canvas`. */
        viewers: PropTypes.array.isRequired,

        /** See `viewerPositions` in `reducers/canvas`. */
        layout:  PropTypes.array.isRequired,

        /** See `symbolTable` in `reducers/program`. */
        symbolTable: PropTypes.object.isRequired,

    };

    // =================================================================================================================
    // Canvas viewer callback functions
    // =================================================================================================================

    // TODO: Factor these out of local definition
    expandSubviewer(symbolId) {
        if(!isSymbolIdFrozen(symbolId)) {
            const { addViewer, fetchSymbolData } = this.props;
            console.debug(`Canvas -- expand subviewer of symbol ${symbolId}`);
            fetchSymbolData(symbolId);
            addViewer(symbolId);
        }
    }

    unfreezeViewer(symbolId) {
        if(isSymbolIdFrozen(symbolId)) {
            console.debug(`Canvas -- unfreeze viewer of symbol ${symbolId}`);
            // TODO
        }
    }

    freezeViewer(symbolId) {
        if(!isSymbolIdFrozen(symbolId)) {
            console.debug(`Canvas -- freeze viewer of symbol ${symbolId}`);
            // TODO
        }
    }

    cloneViewer(symbolId) {
        console.debug(`Canvas -- clone viewer of symbol ${symbolId}`);
    };

    // =================================================================================================================
    // Canvas rendering
    // =================================================================================================================

    /**
     * Returns the [*]Viewer component of the proper type for the given viewer data object.
     *
     * @param {object} viewer
     */
    createViewerComponent(viewer) {
        const { symbolTable } = this.props;
        const { symbolId, viewerId, type, name, str, data} = viewer;

        // TODO: Refactor other viewers
        let viewerContent;
        switch(type) {
            case "number":  // TODO
                // viewerContent = <NumberViewer {...contentProps}/>;
                break;

            case "string":  // TODO
                viewerContent = <StringViewer data={data} />;
                break;

            case "tensor":  // TODO
                // viewerContent = <TensorViewer {...contentProps}/>;
                break;

            case "graphdata":  // TODO
                // viewerContent = <GraphViewer {...contentProps} symbolId={symbolId} symbolTable={symbolTable}/>;
                break;

            case "list":
            case "tuple":
            case "set":
                viewerContent = <ListViewer data={data} symbolTable={symbolTable} expandSubviewer={this.expandSubviewer.bind(this)}/>;
                break;

            default:
                console.warn(`Canvas -- unrecognized data type received; got ${type}`)
                viewerContent = <span>Unrecognized data type</span>;
                break;

            // TODO: Add more viewers
        }

        // TODO: De-hardcode this
        // TODO: What about progress spinner?
        // if (!model) {
        //     return (
        //         <div className={classes.container}>
        //             <div className={classes.progress}>
        //                 <span className='loading loading-spinner-small inline-block' />
        //             </div>
        //         </div>
        //     );
        // }

        return (
            <ViewerDisplayFrame viewerType={type} viewerName={name}
                                isFrozen={true}
                                onClickClose={() => this.props.removeViewer(symbolId)}
                                onClickUnfreeze={() => this.unfreezeViewer.bind(this, symbolId)}
                                onClickFreeze={() => this.freezeViewer.bind(this, symbolId)}
                                onClickClone={() => this.cloneViewer.bind(this, symbolId)}
                                additionalIcons={null} additionalText={null}>
                {viewerContent}
            </ViewerDisplayFrame>
        );
    }

    /**
     * Renders the inspector canvas and any viewers currently registered to it.
     */
    render() {
        const { classes, viewers, layout, updateLayout} = this.props;
        const frames = viewers.map((viewer) => {
            return (
                <div key={viewer.viewerId} className={classes.frameContainer}>
                    {this.createViewerComponent(viewer)}
                </div>
            )
        });

        console.debug(`Canvas -- rendering ${frames.length} viewer frame(s)`, viewers);

        // Lightweight grid layout component that adjusts width according to `size`
        const FlexibleGridLayout = ({ size }) => {
            return (
                <GridLayout width={size.width} cols={1} rowHeight={25} autosize={true} containerPadding={[0, 0]}
                            layout={layout} onLayoutChange={updateLayout} draggableCancel='.ReactGridLayoutNoDrag'>
                    {frames}
                </GridLayout>
            );
        };

        return (
            <div className={classNames(classes.canvasContainer)}>
                <SizeMe>{FlexibleGridLayout}</SizeMe>
            </div>
        );
    }
}


// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = theme => ({
    canvasContainer: {
        height: '100%',
        overflow: 'auto',
        padding: theme.spacing.unit * 2,
    },
    frameContainer: {
        display: 'block',
        boxSizing: 'border-box',
    },
});


// To inject application state into component
// ------------------------------------------

/**
 * Creates derived data structure for `viewers`: [
 *     {
 *         symbolId: "@id:12345",
 *         viewerId: 0,
 *         type: "number",
 *         name: "myInt",
 *         str:  "86",
 *         data: {...}
 *     }
 * ]
 */
// TODO: This selector doesn't seem to be very effective because it's still rerendering each elem in the Canvas
// whenever the symbol table changes.
const viewersSelector = createSelector(
    [(state) => state.canvas.viewerObjects, (state) => state.canvas.viewerPositions, (state) => state.program.symbolTable],
    (viewerObjects, viewerPositions, symbolTable) => {
        return viewerPositions.map((viewerPosition) => {
            let viewerId = parseInt(viewerPosition.i);
            let viewerObj = viewerObjects[viewerId];
            let symbol = symbolTable[viewerObj.symbolId];
            return {
                symbolId: viewerObj.symbolId,
                viewerId: viewerId,
                type:     symbol.type,
                name:     symbol.name,
                str:      symbol.str,
                data:     symbol.data,
            };
        });
    }
);

/** Connects application state objects to component props. */
function mapStateToProps(state, props) {
    return {
        viewers:     viewersSelector(state),
        layout:      state.canvas.viewerPositions,
        symbolTable: state.program.symbolTable,
    };
}

/** Connects bound action creator functions to component props. */
function mapDispatchToProps(dispatch) {
    return bindActionCreators({
        addViewer:    addViewerAction,
        removeViewer: removeViewerAction,
        updateLayout: updateLayoutAction,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(
    withStyles(styles)(Canvas)
);
