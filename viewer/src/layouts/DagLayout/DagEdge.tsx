import * as React from 'react';
import clsx from 'clsx';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import cuid from 'cuid';
import { line, curveBasis, curveLinear } from 'd3';

// @ts-ignore
import { roundCorners } from 'svg-path-round-corners/dist/es6/index';
// @ts-ignore
import { parse } from 'svg-path-round-corners/dist/es6/parse';
// @ts-ignore
import { serialize } from 'svg-path-round-corners/dist/es6/serialize';

import defaultTheme from '../../theme';

const kEdgeGap = 6;
const kEdgeCurveRadius = 4;
const kTemporalBump = 20;

/**
 * This pure dumb component renders a graph edge as an SVG component that responds to mouse events
 * based on prop values.
 */
type DagEdgeProps = {
    /** Edge point coordinates. */
    points: { x: number; y: number }[];

    /** Line style. */
    shape?: 'curve' | 'line';

    /** Line color palette. */
    light?: 'normal' | 'highlight' | 'lowlight' | 'selected';

    /** Text string to display on edge. */
    label?: string;

    temporal?: boolean;  // TODO: remove this hack

    /** Mouse event handlers which should be spread on the node. */
    mouseHandlers: {
        onClick?: (e: React.SyntheticEvent) => void;
        onDoubleClick?: (e: React.SyntheticEvent) => void;
        onMouseOver?: (e: React.SyntheticEvent) => void;
        onMouseOut?: (e: React.SyntheticEvent) => void;
    };
};

class DagEdge extends React.PureComponent<DagEdgeProps & InternalProps> {
    static defaultProps: Partial<DagEdgeProps> = {
        points: [],
        shape: 'line',
        light: 'normal',
        temporal: false,
    };

    private _xlinkId = cuid();

    render() {
        const { classes, shape, light, temporal, label, mouseHandlers } = this.props;
        let { points } = this.props;

        if (!points || points.length === 0) return null;

        // Bump end of line to make room for sharp arrowhead
        // if (points.length >= 2) {
        //     points = points.map(({ x, y }) => ({ x , y }));
        //     const [p, q] = points.slice(points.length - 2);
        //     const pq = { x : q.x - p.x, y: q.y - p.y };
        //     const dist = Math.pow(pq.x * pq.x + pq.y * pq.y, 0.5);
        //     if(dist > kEdgeGap) {
        //         q.x -= pq.x / dist * kEdgeGap;
        //         q.y -= pq.y / dist * kEdgeGap;
        //     }
        // }
        let path;
        const startPoint = points[0];
        const endPoint = points[points.length - 1];
        if (temporal) {
            points = [
                startPoint, 
                {x: startPoint.x + kTemporalBump, y: startPoint.y + kTemporalBump}, 
                {x: endPoint.x - kTemporalBump, y: endPoint.y - kTemporalBump},
                endPoint
            ];
            path = line().curve(curveBasis)(points.map(({x, y})=>([x, y])))
        }
        else {
            path = line()(points.map(({x, y})=>([x, y])))
            // path = 'M ' + points.map(({ x, y }) => `${x} ${y}`).join(' L ');
        }
        if(path) {
            // path = serialize(roundCorners(parse(path), kEdgeCurveRadius));
            path = serialize(parse(path));
        }

        return (
            <g>
                {/** Transparent hotspot captures mouse events in vicinity of the edge. */}
                <path
                    d={path || undefined}
                    className={clsx({
                        [classes.hotspot]: true,
                    })}
                    {...mouseHandlers}
                />
                <path
                    id={this._xlinkId}
                    d={path || undefined}
                    pointerEvents='none'
                    className={clsx({
                        [classes.edge]: true,
                        [classes.edgeHighlight]: light === 'highlight',
                        [classes.edgeLowlight]: light === 'lowlight' || temporal,  // TODO: remove this hack
                        [classes.edgeSelected]: light === 'selected',
                    })}
                />
                <text
                    dy='-1.5'
                    textAnchor='end'
                    pointerEvents='none'
                    className={clsx({
                        [classes.edgeLabel]: true,
                        [classes.edgeLabelHighlight]: light === 'highlight',
                        [classes.edgeLabelLowlight]: light === 'lowlight',
                        [classes.edgeLabelSelected]: light === 'selected',
                    })}
                >
                    <textPath xlinkHref={`#${this._xlinkId}`} startOffset='95%'>
                        {label}
                    </textPath>
                </text>
            </g>
        );
    }
}

const styles = (theme: Theme) =>
    createStyles({
        edge: {
            fill: 'none',
            stroke: theme.color.blue.base,
            strokeWidth: 2.5,
            opacity: 1,
            markerEnd: 'url(#arrow-normal)',
        },
        hotspot: {
            fill: 'none',
            stroke: 'transparent',
            strokeWidth: 12,
        },
        edgeHighlight: {
            stroke: theme.color.blue.l1,
            strokeWidth: 3.5,
            markerEnd: 'url(#arrow-highlight)',
            opacity: 1,
        },
        edgeLowlight: {
            stroke: theme.color.gray.d1,
            markerEnd: 'url(#arrow-lowlight)',
            opacity: 0.5,
        },
        edgeSelected: {
            stroke: theme.color.blue.d2,
            strokeWidth: 3.5,
            markerEnd: 'url(#arrow-selected)',
        },
        edgeLabel: {
            opacity: 1,
            textAlign: 'right',
            // fontFamily: theme.fonts.monospace,
            // fontWeight: theme.typography.fontWeightMedium,
            fontSize: '7pt',
            userSelect: 'none',
        },
        edgeLabelHighlight: {
            opacity: 1,
        },
        edgeLabelLowlight: {
            opacity: 0.5,
        },
        edgeLabelSelected: {
            opacity: 1,
        },
    });

type InternalProps = WithStyles<typeof styles>;

export default withStyles(styles, { defaultTheme })(DagEdge) as React.ComponentClass<DagEdgeProps>;
