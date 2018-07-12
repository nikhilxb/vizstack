'use babel';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';


/**
 * This dumb component creates a header bar for a display frame that horizontally lays out its children components.
 * A header is thicker and is emphasized with an accent color; it will typically contain title/subtitle text and icons,
 * grouped with `div`s appropriately for the desired spacing.
 */
class DisplayFrameHeader extends Component {

    /** Prop expected types object. */
    static propTypes = {
        /** CSS-in-JS styling object. */
        classes:  PropTypes.object.isRequired,

        /** React components within opening & closing tags. */
        children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),

        /** Class tags to allow additional styling of container. */
        className: PropTypes.string,
    };

    /**
     * Renders a header container with specific styling and horizontal layout properties.
     */
    render() {
        const { classes, children, className } = this.props;
        return (
            <div className={classNames('xn-display-frame-header', classes.header, className)}>
                {children}
            </div>
        );
    }
}

// To inject styles into component
// -------------------------------

/** CSS-in-JS styling function. */
const styles = theme => ({
    header: {
        // Layout child components horizontally
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',

        // No text selection within header
        userSelect: 'none',

        // Padding
        paddingTop: 2,
        paddingBottom: 2,
        paddingLeft: theme.spacing.unit,
        paddingRight: theme.spacing.unit,

        // Fixed height (no change)
        flex: 'none',

        // Text styling
        '& span': {
            flex: 1,
            overflow: 'hidden',
            fontFamily: theme.typography.monospace.fontFamily,
            fontSize: '9pt', // TODO: Dehardcode this
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        },

        // Transitions
        transition: theme.transitions.create(['background'], { duration: theme.transitions.duration.shortest })
    },

});

export default withStyles(styles)(DisplayFrameHeader);
