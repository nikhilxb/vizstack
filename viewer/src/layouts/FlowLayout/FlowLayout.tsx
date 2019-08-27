import * as React from 'react';
import clsx from 'clsx';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';

import defaultTheme from '../../theme';

import { FlowLayoutFragment } from '@vizstack/schema';
import { Viewer, FragmentProps } from '../../Viewer';
import { ViewerId } from '../../interaction';

/**
 * This pure dumb component renders visualization for a 1D sequence of elements.
 * TODO: Allow multi-line wrapping elements.
 * TODO: Allow element-type-specific background coloring.
 * TODO: Merge with MatrixLayout to form generic RowColLayout
 */
type FlowLayoutProps = FragmentProps<FlowLayoutFragment>;

type FlowLayoutState = {
    selectedElementIdx: number,
};

export type FlowLayoutHandle = {
    elements: ViewerId[],
    selectedElementIdx: number,
    doSelectElement: (idx: number) => void,
    doIncrementElement: (delta?: number) => void,
};

type FlowDidSelectElementEvent = {
    topic: 'Flow.DidSelectElement',
    message: {
        viewerId: ViewerId,
        prevSelectedElementIdx: number,
        selectedElementIdx: number,
    },
};

export type FlowLayoutEvent = 
    | FlowDidSelectElementEvent;

class FlowLayout extends React.PureComponent<FlowLayoutProps & InternalProps, FlowLayoutState> {

    private _childViewers: Viewer[] = [];

    private _registerViewer(viewer: Viewer, idx: number) {
        this._childViewers[idx] = viewer;
    }

    constructor(props: FlowLayoutProps & InternalProps) {
        super(props);
        this.state = {
            selectedElementIdx: 0,
        };
    }

    public getHandle(): FlowLayoutHandle {
        const { selectedElementIdx } = this.state;
        return {
            elements: this._childViewers.map((viewer) => viewer.viewerId),
            selectedElementIdx,
            doSelectElement: (idx) => {
                this.setState({ selectedElementIdx: idx });
            },
            doIncrementElement: (delta = 1) => {
                const { elements } = this.props;
                this.setState((state) => {
                    let elementIdx = state.selectedElementIdx + delta;
                    // Ensure wrapping to valid array index.
                    elementIdx = (elementIdx % elements.length + elements.length) % elements.length;
                    return { selectedElementIdx: elementIdx };
                });
            },
        };
    }

    componentDidUpdate(prevProps: any, prevState: FlowLayoutState) {
        const { viewerId, emit } = this.props.interactions;
        const { selectedElementIdx } = this.state;
        if (selectedElementIdx !== prevState.selectedElementIdx) {
            emit<FlowLayoutEvent>('Flow.DidSelectElement', { viewerId, selectedElementIdx, prevSelectedElementIdx: prevState.selectedElementIdx });
        }
    }

    /**
     * Renders a sequence of `Viewer` elements, optionally numbered with indices. The sequence can
     * have start/end motifs, which are large characters that can be used to indicate a type of
     * sequence (e.g. "{" for sets).
     */
    render() {
        const { classes, elements, passdown, interactions } = this.props;
        const { mouseHandlers } = interactions;

        return (
            <div
                className={clsx({
                    [classes.root]: true,
                })}
                {...mouseHandlers}
            >
                {elements.map((fragmentId, idx) => (
                    <React.Fragment>
                        <Viewer
                            ref={(viewer) => this._registerViewer(viewer!, idx)}
                            key={`${idx}-${fragmentId}`}
                            {...passdown}
                            fragmentId={fragmentId}
                        />
                        {idx < elements.length - 1 ? <span className={classes.spacer}/> : null}
                    </React.Fragment>
                ))}
            </div>
        );
    }
}

const styles = (theme: Theme) => createStyles({
    root: {
        borderColor: 'transparent',
    },
    hovered: {
        borderColor: theme.palette.primary.light,
    },
    spacer: {
        marginRight: theme.vars.slot.spacing,
    },
});

type InternalProps = WithStyles<typeof styles>;

export default withStyles(styles, { defaultTheme })(FlowLayout) as React.ComponentClass<FlowLayoutProps>;
