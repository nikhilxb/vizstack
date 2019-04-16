// @flow
import * as React from 'react';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import { createSelector } from 'reselect';

/**
 * This pure dumb component renders visualization for a text string that represents a token.
 */
class ImagePrimitive extends React.PureComponent<{
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

    /** Path at which the image file is saved. */
    filePath: string,
}> {
    /**
     * Renders the text as a 1 element sequence to ensure consistent formatting
     */
    render() {
        const { classes, filePath, mouseProps, isFullyExpanded, isHovered } = this.props;

        return (
            <img
                className={classNames({
                    [classes.image]: true,
                    [classes.compactImage]: !isFullyExpanded,
                    [classes.hovered]: isHovered,
                })}
                src={filePath}
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                        '/Users/Nikhil/Desktop/xnode/xnode/src/components/primitives/ImagePrimitive/img-not-found.png'; // TODO: Remove this hack!
                }}
                title={filePath.replace('/Users/Nikhil/Desktop/xnode/python/demo/', '')}
                {...mouseProps}
            />
        );
    }
}

// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = (theme) => ({
    image: {
        marginLeft: theme.spacing.unit,
        marginRight: theme.spacing.unit,
        borderStyle: theme.shape.border.style,
        borderWidth: theme.shape.border.width,
        borderColor: 'transparent',
    },
    compactImage: {
        width: theme.shape.image.small.width,
    },
    hovered: {
        borderColor: theme.palette.primary.light,
    },
});

export default withStyles(styles)(ImagePrimitive);
