import * as React from 'react';
import ReactDOM from "react-dom";
import clsx from 'clsx';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import Measure from 'react-measure';

import defaultTheme from '../../theme';

/** The pixel width of the interactive border surrounding expansible/collapsible nodes. */
const kBorderWidth = 8;
const kMargin = 10;

/**
 * This pure dumb component renders a graph node as an SVG component that contains a Viewer.
 */
type DagNodeProps = {
    /** React components within opening & closing tags. */
    children?: React.ReactNode;

    /** Position and size properties. */
    x: number;
    y: number;
    width: number;
    height: number;

    /** Expansion state. */
    isExpanded: boolean;
    isInteractive?: boolean;
    isVisible?: boolean;

    /** Mouse event handlers which should be spread on the interactive region of the node. */
    mouseHandlers: {
        onClick?: (e: React.SyntheticEvent) => void;
        onDoubleClick?: (e: React.SyntheticEvent) => void;
        onMouseOver?: (e: React.SyntheticEvent) => void;
        onMouseOut?: (e: React.SyntheticEvent) => void;
    };

    /** Whether the node should highlight if expanded and not invisible. */
    light: 'lowlight' | 'normal' | 'highlight' | 'selected';

    /** Callback on component resize. */
    onResize: (width: number, height: number) => void;
};

class DagNode extends React.PureComponent<DagNodeProps & InternalProps> {
    static defaultProps: Partial<DagNodeProps> = {
        isInteractive: true,
        isVisible: true,
    };

    content: HTMLDivElement | undefined = undefined;
    width: number = 0;
    height: number = 0;

    constructor(props: DagNodeProps & InternalProps) {
        super(props);
        this.setContentRef = this.setContentRef.bind(this);
    }

    updateSize() {
        const { isInteractive, onResize } = this.props;
        const DOMNode = ReactDOM.findDOMNode(this.content);
        if (DOMNode) {
            const width = (DOMNode as any).offsetWidth;
            const height = (DOMNode as any).offsetHeight;
            isInteractive
                ? onResize(
                        width + kBorderWidth * 2 + kMargin * 2,
                        height + kBorderWidth * 2 + kMargin * 2,
                    )
                : onResize(width + kMargin * 2, height + kMargin * 2);
            this.width = width;
            this.height = height;
        }
    }
    
    componentDidUpdate() {
        this.updateSize();
    }

    setContentRef(ref: HTMLDivElement) {
        this.content = ref;
        this.updateSize();
    }

    render() {
        const {
            classes,
            x,
            y,
            width,
            height,
            children,
            isVisible,
            isInteractive,
            light,
            isExpanded,
            mouseHandlers,
        } = this.props;

        // If the node is expanded, render an interactive rectangle
        if (isExpanded) {
            return (
                <g>
                    <rect
                        x={x - width / 2}
                        y={y - height / 2}
                        width={width}
                        height={height}
                        className={clsx({
                            [classes.expandedOuterInvisible]: isVisible === false,
                            [classes.expandedOuterVisible]: isVisible !== false,
                        })}
                        {...mouseHandlers}
                    />
                    <rect
                        x={x - width / 2 + kBorderWidth}
                        y={y - height / 2 + kBorderWidth}
                        width={width - kBorderWidth * 2}
                        height={height - kBorderWidth * 2}
                        className={clsx({
                            [classes.expandedInnerInvisible]: isVisible === false,
                            [classes.expandedInnerVisible]: isVisible !== false,
                        })}
                    />
                </g>
            );
        }

        // If not expanded, render the node, surrounded by an interactive border if `isInteractive`
        const foreignObjectPos = isInteractive
            ? {
                  x: x - width / 2 + kBorderWidth + kMargin,
                  y: y - height / 2 + kBorderWidth + kMargin,
                  width: width - kBorderWidth * 2 - kMargin * 2,
                  height: height - kBorderWidth * 2 - kMargin * 2,
              }
            : {
                  x: x - width / 2 + kMargin,
                  y: y - height / 2 + kMargin,
                  width: width - kMargin * 2,
                  height: height - kMargin * 2,
              };

        return (
            <g>
                {isInteractive ? (
                    <g>
                        <rect
                            x={x - width / 2 + kMargin}
                            y={y - height / 2 + kMargin}
                            width={width - kMargin * 2}
                            height={height - kMargin * 2}
                            fill={'black'}
                            {...mouseHandlers}
                        />
                    </g>
                ) : null}
                <foreignObject
                    {...foreignObjectPos}
                    className={clsx({
                        [classes.node]: true,
                    })}
                >
                    <div ref={this.setContentRef} style={{ display: 'inline-block' }}>
                        {children}
                    </div>
                </foreignObject>
            </g>
        );
    }
}

const styles = (theme: Theme) =>
    createStyles({
        node: {
            // fillOpacity: 0.2,
            // stroke: 'transparent', // TODO: Remove this?
            // strokeWidth: 4,
            // rx: 4,
            // ry: 4,
            // transition: [
            //     theme.transitions.create(['width', 'height', 'x', 'y'], {
            //         duration: theme.transitions.duration.short,
            //     }),
            //     theme.transitions.create(['fill-opacity'], {
            //         duration: theme.transitions.duration.shortest,
            //         delay: theme.transitions.duration.short,
            //     }),
            // ].join(', '),
        },

        expandedOuterInvisible: {

        },

        expandedOuterVisible: {
            fill: 'black',
        },

        expandedInnerInvisible: {

        },

        expandedInnerVisible: {
            fill: 'white',
        },

        nodeInvisible: {
            fill: '#FFFFFF', // TODO: Change this.
            fillOpacity: 0.0,
        },

        nodeExpanded: {
            backgroundColor: 'transparent',
            borderWidth: 4,
            borderColor: 'black',
        },

        nodeHighlighted: {
            borderColor: 'blue',
        },
    });

type InternalProps = WithStyles<typeof styles>;

export default withStyles(styles, { defaultTheme })(DagNode) as React.ComponentClass<DagNodeProps>;
