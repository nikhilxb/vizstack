// @flow
/** This file exports the `Event` type, `Event` subtypes which are shared across `Viewer`s, and
 * `getViewerMouseFunctions()`, which allows `Viewer` components to publish mouse-related events.*/

import * as React from 'react';

import type { ViewerId } from './manager';

export type Event = {
    +topic: string,
    +message: { [string]: any },
};

export type ViewerDidMouseOverEvent = {|
    topic: 'Viewer.DidMouseOver',
    message: {|
        viewerId: ViewerId,
    |},
|};

export type ViewerDidClickEvent = {|
    topic: 'Viewer.DidClick',
    message: {|
        viewerId: ViewerId,
    |},
|};

export type ViewerDidDoubleClickEvent = {|
    topic: 'Viewer.DidDoubleClick',
    message: {|
        viewerId: ViewerId,
    |},
|};

export type ViewerDidMouseOutEvent = {|
    topic: 'Viewer.DidMouseOut',
    message: {|
        viewerId: ViewerId,
    |},
|};

export type ViewerDidMouseEvent =
    | ViewerDidMouseOverEvent
    | ViewerDidClickEvent
    | ViewerDidDoubleClickEvent
    | ViewerDidMouseOutEvent;

export type ViewerDidHighlightEvent =
    | {|
          topic: 'Viewer.DidHighlight',
          message: {|
              viewerId: ViewerId,
          |},
      |}
    | {|
          topic: 'Viewer.DidUnhighlight',
          message: {|
              viewerId: ViewerId,
          |},
      |};

export type MouseEventProps = {
    onClick: (e: SyntheticEvent<>) => void,
    onDoubleClick: (e: SyntheticEvent<>) => void,
    onMouseOver: (e: SyntheticEvent<>) => void,
    onMouseOut: (e: SyntheticEvent<>) => void,
};

/**
 * Creates an object which, when spread on an HTML element, causes that element to publish mouse
 * events.
 *
 * @param emitEvent: The function which publishes the event to an `InteractionManager`.
 * @param viewerId: The `ViewerId` of the `Viewer` which is rendering the `HTMLElement` that
 *                  publishes the events.
 * @returns {{onMouseOut: onMouseOut, onMouseOver: onMouseOver, onClick: onClick, onDoubleClick: onDoubleClick}}
 */
export function getViewerMouseFunctions(
    emitEvent: <E: ViewerDidMouseEvent>(
        $PropertyType<E, 'topic'>,
        $PropertyType<E, 'message'>,
    ) => void,
    viewerId: ViewerId,
): MouseEventProps {
    return {
        onClick: (e) => {
            e.stopPropagation();
            emitEvent('Viewer.DidClick', {
                viewerId,
            });
        },
        onDoubleClick: (e) => {
            e.stopPropagation();
            emitEvent('Viewer.DidDoubleClick', {
                viewerId,
            });
        },
        onMouseOver: (e) => {
            e.stopPropagation();
            emitEvent('Viewer.DidMouseOver', {
                viewerId,
            });
        },
        onMouseOut: (e) => {
            e.stopPropagation();
            emitEvent('Viewer.DidMouseOut', {
                viewerId,
            });
        },
    };
}
