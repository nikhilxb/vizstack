import * as React from 'react';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import { createSelector } from 'reselect';

import Viewer from '../Viewer';
import type { ViewerProps } from '../Viewer';
import ColorLightBlue from "@material-ui/core/colors/lightBlue";

/**
 * This pure dumb component renders visualization for a 1D sequence of elements.
 * TODO: Allow multi-line wrapping elements.
 * TODO: Allow element-type-specific background coloring.
 * TODO: Merge with MatrixLayout to form generic RowColLayout
 */
class GridLayout extends React.PureComponent<{
    /** CSS-in-JS styling object. */
    classes: {},

    /** Whether the Viz is currently being hovered over by the cursor. */
    isHovered: boolean,

    /** Whether the Viz should lay out its contents spaciously. */
    isFullyExpanded: boolean,

    /** Event listeners which should be assigned to the Viz's outermost node. */
    mouseProps: {
        onClick: (e) => void,
        onMouseOver: (e) => void,
        onMouseOut: (e) => void,
    },

    /** Elements of the sequence that serve as props to `Viewer` sub-components. */
    elements: Array<[ViewerProps, number, number, number, number]>,
}> {
    /** Prop default values. */
    static defaultProps = {
    };

    /**
     * Renders a sequence of `Viewer` elements, optionally numbered with indices. The sequence can
     * have start/end motifs, which are large characters that can be used to indicate a type of
     * sequence (e.g. "{" for sets).
     */
    render() {
        const {
            classes,
            elements,
            isFullyExpanded,
            isHovered,
            mouseProps,
        } = this.props;

        return (
            <div className={classNames({
                [classes.grid]       : true,
                [classes.compactGrid]: !isFullyExpanded,
                [classes.hoveredGrid]    : isHovered,
                [classes.notHoveredGrid] : !isHovered,
            })}
                 {...mouseProps}
            >
                {elements.map(([viewerProps, col, row, width, height]) => {
                    return (
                        <div
                            key={viewerProps.vizId}
                            className={classNames({
                                [classes.cell]           : true,
                                [classes.hoveredCell]    : isHovered,
                                [classes.notHoveredCell] : !isHovered,
                            })}
                            style={{
                                gridColumn: `${col + 1} / ${col + 1 + width}`,
                                gridRow: `${row + 1} / ${row + 1 + height}`,
                            }
                        }>
                            <Viewer {...viewerProps}/>
                        </div>
                    );
                })}
            </div>
        );
    }
}

// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = (theme) => ({
    grid: {
        display: 'inline-grid',
        gridGap: `${theme.spacing.unit}px`,
        justifyContent: 'start',
        gridAutoColumns: 'max-content',
        gridAutoRows: 'max-content',
        borderStyle: theme.shape.border.style,
        borderWidth: theme.shape.border.width,
        borderRadius: theme.shape.border.radius,
        padding: theme.spacing.separate,
    },
    compactGrid: {
        gridGap: `${theme.spacing.tight}px`,
    },
    hoveredGrid: {
        borderColor: theme.palette.primary.light,
    },
    notHoveredGrid: {
        borderColor: 'transparent',
    },
    cell: {
    },
    hoveredCell: {
    },
    notHoveredCell: {
    }
});

export default withStyles(styles)(GridLayout);
