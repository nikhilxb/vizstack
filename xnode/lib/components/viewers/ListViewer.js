'use babel';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { withStyles } from 'material-ui/styles';
import { createSelector } from "reselect";

import Typography from 'material-ui/Typography';
import ColorLightBlue from 'material-ui/colors/lightBlue';
import ColorBlue from 'material-ui/colors/blue';

import { isSymbolId } from '../../services/symbol-utils';


/** Constants for list/sequence visualization. */
const kListItemWidth  = 80;
const kListItemHeight = 40;
const kListItemMargin = 2;


/**
 * This dumb component renders an sequence variable (tuple, list, set).
 */
class ListViewer extends Component {

    /** Prop expected types object. */
    static propTypes = {
        classes: PropTypes.object.isRequired,
        symbolId: PropTypes.string.isRequired,
        viewerId: PropTypes.number.isRequired,
        str: PropTypes.string.isRequired,
        payload: PropTypes.object.isRequired,

        /** Data model rendered by this viewer. */
        model: PropTypes.array.isRequired,

        /** Generates a sub-viewer for a particular element of the list. */
        expandSubviewer: PropTypes.func.isRequired,

        /** Unfreezes this viewer so it reflects the latest version of its symbol. */
        unfreezeViewer: PropTypes.func.isRequired,
    };

    /** Constructor. */
    constructor(props) {
        super(props);
        this.state = {
            hover: null,
            selected: null,
        }
    }

    /**
     * Renders the list, with each item being a fixed-width button. When clicked, the button opens the viewer, if
     * the clicked entry is a non-primitive.
     */
    render() {
        const { classes, model, expandSubviewer, unfreezeViewer } = this.props;
        const { hover, selected } = this.state;

        const listItems = model.map((elem, idx) => {

            let onClick = () => {
                this.setState({
                    selected: idx,
                })
            };
            let onDoubleClick = elem.ref !== null ? (() => expandSubviewer(elem.ref)) : undefined;

            return (
                <div className={classNames({
                    [classes.listItem]: true,
                    [classes.hover]: hover === idx,
                    [classes.selected]: selected === idx,
                })}
                     onClick={onClick}
                     onDoubleClick={onDoubleClick}
                     onMouseEnter={() => this.setState({hover: idx})}
                     onMouseLeave={() => this.setState({hover: null})}
                     key={idx}>
                    <Typography className={classes.listItemText}>{elem.text}</Typography>
                </div>
            );
        });

        return (
            <div className={classes.container} >
                <div className={classes.listBox}>
                    <div className={classes.list}>
                        {listItems}
                    </div>
                </div>
            </div>
        );
    }
}


// To inject styles into component
// -------------------------------

/** CSS-in-JS styling object. */
const styles = theme => ({
    container: {
        width: '100%',
        margin: 'auto',  // center vertically

        display: 'flex',
        flexDirection: 'column',
    },
    listBox: {
        overflow: 'auto',
        textAlign: 'center',
        paddingTop: 16,
        paddingBottom: 16,
    },
    list : {
        display: 'inline-flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
    },
    listItem: {
        margin: kListItemMargin,
        width:  kListItemWidth,
        height: kListItemHeight,
        background: ColorLightBlue[50],
        borderColor: 'transparent',
        borderStyle: 'solid',
        borderRadius: 4,

        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        userSelect: 'none',
    },
    hover: {
        borderColor: ColorLightBlue[400],
    },
    selected: {
        borderColor: ColorBlue[600],
    },
    listItemText: {
        textAlign:      'center',
        overflow:       'hidden',
        textOverflow:   'ellipsis',
        whiteSpace:     'nowrap',
        textTransform:  'none',
    },
});

export default withStyles(styles)(ListViewer);

/**
 * Assembles data model rendered by a ListViewer:
 * [{
 *     text: "List[4]",
 *     ref: "@id:..." | null,
 * },...]
 *
 * @param {object} payload
 *     Payload object as defined in data schema.
 * @param {object} symbolTable
 *     Reference to the application symbol table.
 * @return {array}
 *     Data model rendered by a ListViewer.
 */
export function assembleListModel(payload, symbolTable) {
    const { contents } = payload;
    return contents.map((elem) => {
        let text = '';
        let ref = null;

        if (elem === null) {  // none
            text = 'None';
        } else if (typeof elem === 'number') {  // number
            text = `${elem}`;
        } else if (typeof elem === 'boolean') {  // boolean
            text = elem ? 'True' : 'False';
        } else if (isSymbolId(elem)) {  // symbolId reference
            ref = elem;
            text = symbolTable[elem].str;
        } else {  // string
            text = `"${elem}"`;
        }

        return { text, ref };
    });
}